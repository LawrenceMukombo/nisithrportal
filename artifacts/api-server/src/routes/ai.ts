import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db, candidatesTable, jobsTable, applicationsTable, aiScoresTable, employeesTable, contractsTable, departmentsTable } from "@workspace/db";
import { AiParseCvBody, AiRankCandidatesBody, AiGenerateInterviewQuestionsBody } from "@workspace/api-zod";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { logger } from "../lib/logger";
import { openai } from "@workspace/integrations-openai-ai-server";
import { extractTextFromUrl } from "../lib/cvParser";
import { ObjectStorageService } from "../lib/objectStorage";
import { canAccessObjectForAgency } from "../lib/objectAcl";

const aiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests — please wait a minute before trying again." },
});

const _cvPrefillMax = parseInt(process.env.AI_CV_PREFILL_RATE_LIMIT ?? "", 10);
const CV_PREFILL_RATE_LIMIT_MAX = Number.isFinite(_cvPrefillMax) && _cvPrefillMax > 0 ? _cvPrefillMax : 10;

const _cvPrefillWindowMs = parseInt(process.env.AI_CV_PREFILL_RATE_LIMIT_WINDOW_MS ?? "", 10);
const CV_PREFILL_RATE_LIMIT_WINDOW_MS = Number.isFinite(_cvPrefillWindowMs) && _cvPrefillWindowMs > 0 ? _cvPrefillWindowMs : 60_000;

const cvPrefillRateLimit = rateLimit({
  windowMs: CV_PREFILL_RATE_LIMIT_WINDOW_MS,
  max: CV_PREFILL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.userId ?? req.ip),
  message: { error: "Too many CV prefill requests — please wait before trying again." },
});

// ---------------------------------------------------------------------------
// Zod schemas for validating AI JSON responses
// ---------------------------------------------------------------------------

const RankingItemSchema = z.object({
  applicationId: z.number().int().positive(),
  candidateId: z.number().int().positive(),
  candidateName: z.string().optional().default("Unknown"),
  score: z.number().min(0).max(100),
  recommendation: z.string(),
});

const RankingResponseSchema = z.object({
  rankings: z.array(RankingItemSchema),
});

const InterviewQuestionsSchema = z.object({
  questions: z.array(z.string()).min(1),
  jobTitle: z.string().optional(),
});

const AttritionRiskSchema = z.object({
  departmentName: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
  staffAtRisk: z.number().int().min(0),
  reason: z.string(),
});

const PredictedVacancySchema = z.object({
  departmentName: z.string(),
  predictedVacancies: z.number().int().min(0),
  timeframe: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const WorkforcePredictionSchema = z.object({
  attritionRisk: z.array(AttritionRiskSchema),
  predictedVacancies: z.array(PredictedVacancySchema),
  recommendations: z.array(z.string()),
});

const INTERNAL_STORAGE_PREFIX = "/api/storage/";

const router: IRouter = Router();
const aiRoles = requireRole("admin", "hr_officer");

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return content;
}

router.post("/ai/parse-cv", aiRateLimit, authMiddleware, aiRoles, async (req, res): Promise<void> => {
  const parsed = AiParseCvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { candidateId, cvUrl: reqCvUrl, cvText } = parsed.data;

  // Reject internal storage paths in caller-provided cvUrl (IDOR prevention).
  if (reqCvUrl && reqCvUrl.startsWith(INTERNAL_STORAGE_PREFIX)) {
    res.status(400).json({ error: "cvUrl must be an external HTTPS URL; internal storage paths are not accepted" });
    return;
  }

  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, candidateId));
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const agencyJobs = await db.select({ id: jobsTable.id }).from(jobsTable)
      .where(eq(jobsTable.agencyId, agencyId));
    const jobIds = new Set(agencyJobs.map((j) => j.id));
    const apps = await db.select({ jobId: applicationsTable.jobId })
      .from(applicationsTable)
      .where(eq(applicationsTable.candidateId, candidateId));
    const hasAccess = apps.some((a) => jobIds.has(a.jobId));
    if (!hasAccess) {
      res.status(403).json({ error: "Forbidden: candidate has no applications to your agency's jobs" });
      return;
    }
  }

  // Determine the CV URL to use:
  // 1. Caller-provided external HTTPS URL (reqCvUrl) — already validated not to be internal.
  // 2. Candidate's stored cvUrl from DB — ACL-checked against requesting user's agency to
  //    prevent cross-tenant access via the shared-by-email candidate table.
  // 3. Inline cvText from request body.
  let resolvedCvUrl: string | null = reqCvUrl ?? null;

  if (!resolvedCvUrl && candidate.cvUrl) {
    const dbCvUrl = candidate.cvUrl;
    if (dbCvUrl.startsWith(INTERNAL_STORAGE_PREFIX)) {
      try {
        const svc = new ObjectStorageService();
        const objectPath = "/objects/" + dbCvUrl.slice("/api/storage/objects/".length);
        const file = await svc.getObjectEntityFile(objectPath);
        const allowed = await canAccessObjectForAgency(file, agencyId ?? null);
        if (allowed) {
          resolvedCvUrl = dbCvUrl;
        }
        // If not allowed, fall through to cvText (cross-tenant file silently skipped)
      } catch {
        // Object not found or ACL error — fall through to cvText
      }
    } else {
      // External URL stored in DB — use as-is (SSRF validation happens inside extractTextFromUrl)
      resolvedCvUrl = dbCvUrl;
    }
  }

  if (!resolvedCvUrl && !cvText) {
    res.status(400).json({ error: "No CV available: upload a CV file first, or provide cvText" });
    return;
  }

  try {
    let textToparse: string;
    if (resolvedCvUrl) {
      textToparse = await extractTextFromUrl(resolvedCvUrl);
    } else {
      textToparse = cvText as string;
    }

    const result = await callAI(
      "You are an expert CV parser. Extract structured information from the CV text. Return JSON only.",
      `Parse this CV and return JSON with fields: name (string|null), email (string|null), phone (string|null), skills (string[]), experience (string[]), education (string[]), summary (string|null).\n\nCV:\n${textToparse}`,
    );
    const parsedData = JSON.parse(result);
    await db.update(candidatesTable).set({ parsedData }).where(eq(candidatesTable.id, candidateId));
    res.json(parsedData);
  } catch (err) {
    logger.error(err, "CV parsing failed");
    res.status(500).json({ error: "CV parsing failed" });
  }
});

// Authenticated endpoint — any logged-in user may call this. Used by the apply wizard to pre-fill
// form fields from a CV. Authentication prevents anonymous abuse of the AI endpoint.
const CvPrefillBody = z.object({
  cvUrl: z.string().url("Must be a valid HTTPS URL").optional(),
  cvText: z.string().max(50_000).optional(),
}).refine(d => d.cvUrl || d.cvText, { message: "One of cvUrl or cvText is required" });

router.post("/ai/cv-prefill", authMiddleware, cvPrefillRateLimit, async (req, res): Promise<void> => {
  const parsed = CvPrefillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { cvUrl, cvText } = parsed.data;

  // Block internal storage paths from public endpoint (IDOR / SSRF prevention)
  if (cvUrl && (cvUrl.startsWith(INTERNAL_STORAGE_PREFIX) || !cvUrl.startsWith("https://"))) {
    res.status(400).json({ error: "cvUrl must be a public HTTPS URL" });
    return;
  }

  try {
    let text: string;
    if (cvUrl) {
      text = await extractTextFromUrl(cvUrl);
    } else {
      text = cvText as string;
    }

    const result = await callAI(
      "You are an expert CV parser for a Papua New Guinea government HR system. Extract structured information from the CV. Return JSON only.",
      `Parse this CV and return JSON with ONLY these fields: name (string|null), email (string|null), phone (string|null), skills (array of strings), summary (string|null).\n\nDo not include any other fields. CV text:\n${text.slice(0, 8000)}`,
    );
    const data = JSON.parse(result) as {
      name?: string | null; email?: string | null; phone?: string | null;
      skills?: string[]; summary?: string | null;
    };
    res.json(data);
  } catch (err) {
    logger.error(err, "cv-prefill failed");
    res.status(500).json({ error: "CV parsing failed" });
  }
});

router.post("/ai/rank-candidates", aiRateLimit, authMiddleware, aiRoles, async (req, res): Promise<void> => {
  const parsed = AiRankCandidatesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId } = parsed.data;

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  if (!assertTenantAccess(res, job.agencyId, agencyId)) return;

  const applications = await db.select().from(applicationsTable).where(eq(applicationsTable.jobId, jobId));
  if (applications.length === 0) {
    res.json([]);
    return;
  }

  const candidateDetails = await Promise.all(applications.map(async (app) => {
    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, app.candidateId));
    return { application: app, candidate };
  }));

  try {
    const summaries = candidateDetails.map(({ candidate, application }) => ({
      applicationId: application.id,
      candidateId: candidate?.id,
      candidateName: candidate?.name ?? "Unknown",
      parsedData: candidate?.parsedData,
    }));

    const result = await callAI(
      "You are an expert HR recruiter. Rank candidates for a job based on their profile. Return JSON only.",
      `Job Title: ${job.title}\nJob Description: ${job.description}\n\nCandidates:\n${JSON.stringify(summaries, null, 2)}\n\nReturn JSON with field: rankings (array of { applicationId, candidateId, candidateName, score (0-100 number), recommendation (string) }) ordered by score descending.`,
    );

    const rawResult = RankingResponseSchema.safeParse(JSON.parse(result));
    if (!rawResult.success) {
      logger.warn({ err: rawResult.error }, "AI ranking response failed schema validation");
      res.status(500).json({ error: "Candidate ranking failed: unexpected AI response format" });
      return;
    }

    // Enforce membership: only persist/return rankings for IDs actually in this job
    const validApplicationIds = new Set(applications.map((a) => a.id));
    const validCandidateIds = new Set(applications.map((a) => a.candidateId));
    const validRankings = rawResult.data.rankings.filter(
      (r) => validApplicationIds.has(r.applicationId) && validCandidateIds.has(r.candidateId),
    );

    for (const ranked of validRankings) {
      await db.insert(aiScoresTable).values({
        candidateId: ranked.candidateId,
        jobId,
        score: String(ranked.score),
        recommendation: ranked.recommendation,
        metadata: { rankingContext: job.title },
      }).onConflictDoNothing();
    }

    res.json(validRankings);
  } catch (err) {
    logger.error(err, "Candidate ranking failed");
    res.status(500).json({ error: "Candidate ranking failed" });
  }
});

router.post("/ai/interview-questions", aiRateLimit, authMiddleware, aiRoles, async (req, res): Promise<void> => {
  const parsed = AiGenerateInterviewQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId, candidateId } = parsed.data;

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, candidateId));

  if (!job || !candidate) {
    res.status(404).json({ error: "Job or candidate not found" });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  if (!assertTenantAccess(res, job.agencyId, agencyId)) return;

  if (agencyId != null) {
    const agencyJobs = await db.select({ id: jobsTable.id }).from(jobsTable)
      .where(eq(jobsTable.agencyId, agencyId));
    const jobIds = new Set(agencyJobs.map((j) => j.id));
    const apps = await db.select({ jobId: applicationsTable.jobId })
      .from(applicationsTable)
      .where(eq(applicationsTable.candidateId, candidateId));
    const hasAccess = apps.some((a) => jobIds.has(a.jobId));
    if (!hasAccess) {
      res.status(403).json({ error: "Forbidden: candidate has no applications to your agency's jobs" });
      return;
    }
  }

  try {
    const result = await callAI(
      "You are an expert interviewer. Generate targeted interview questions for a candidate. Return JSON only.",
      `Job Title: ${job.title}\nJob Description: ${job.description}\n\nCandidate: ${candidate.name}\nProfile: ${JSON.stringify(candidate.parsedData ?? { name: candidate.name })}\n\nGenerate 8-10 targeted interview questions. Return JSON: { questions: string[], jobTitle: string }`,
    );
    const rawResult = InterviewQuestionsSchema.safeParse(JSON.parse(result));
    if (!rawResult.success) {
      logger.warn({ err: rawResult.error }, "AI interview questions response failed schema validation");
      res.status(500).json({ error: "Interview question generation failed: unexpected AI response format" });
      return;
    }
    res.json(rawResult.data);
  } catch (err) {
    logger.error(err, "Interview question generation failed");
    res.status(500).json({ error: "Interview question generation failed" });
  }
});

router.get("/ai/predictions/workforce", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);

  const employees = agencyId != null
    ? await db.select().from(employeesTable).where(eq(employeesTable.agencyId, agencyId))
    : await db.select().from(employeesTable);

  // Scope contracts to the same employees visible to this agency to prevent cross-tenant leaks.
  const contracts = agencyId != null && employees.length > 0
    ? await db.select().from(contractsTable).where(
        and(
          eq(contractsTable.status, "active"),
          inArray(contractsTable.employeeId, employees.map((e) => e.id)),
        ),
      )
    : agencyId != null
    ? [] // Agency has no employees → no contracts
    : await db.select().from(contractsTable).where(eq(contractsTable.status, "active"));
  const departments = agencyId != null
    ? await db.select().from(departmentsTable).where(eq(departmentsTable.agencyId, agencyId))
    : await db.select().from(departmentsTable);

  try {
    const result = await callAI(
      "You are an HR workforce planning expert. Analyze employee and contract data to predict workforce risks. Return JSON only.",
      `Employees (${employees.length} total, showing up to 20):\n${JSON.stringify(employees.slice(0, 20), null, 2)}\n\nActive Contracts (${contracts.length}):\n${JSON.stringify(contracts.slice(0, 20), null, 2)}\n\nDepartments:\n${JSON.stringify(departments, null, 2)}\n\nReturn JSON: { attritionRisk: Array<{ departmentName: string, riskLevel: 'low'|'medium'|'high', staffAtRisk: number, reason: string }>, predictedVacancies: Array<{ departmentName: string, predictedVacancies: number, timeframe: string, confidence: 'low'|'medium'|'high' }>, recommendations: string[] }`,
    );
    const rawResult = WorkforcePredictionSchema.safeParse(JSON.parse(result));
    if (!rawResult.success) {
      logger.warn({ err: rawResult.error }, "AI workforce prediction response failed schema validation");
      res.status(500).json({ error: "Workforce prediction failed: unexpected AI response format" });
      return;
    }
    res.json(rawResult.data);
  } catch (err) {
    logger.error(err, "Workforce prediction failed");
    res.status(500).json({ error: "Workforce prediction failed" });
  }
});

export default router;
