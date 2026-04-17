import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, candidatesTable, jobsTable, applicationsTable, aiScoresTable, employeesTable, contractsTable, departmentsTable } from "@workspace/db";
import { AiParseCvBody, AiRankCandidatesBody, AiGenerateInterviewQuestionsBody } from "@workspace/api-zod";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const aiRoles = requireRole("admin", "hr_officer");

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.REPLIT_AI_KEY ?? "";
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "AI API error");
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

router.post("/ai/parse-cv", authMiddleware, aiRoles, async (req, res): Promise<void> => {
  const parsed = AiParseCvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { candidateId, cvText } = parsed.data;

  try {
    const result = await callAI(
      "You are an expert CV parser. Extract structured information from the CV text provided. Return JSON only.",
      `Parse this CV and return JSON with fields: name (string|null), email (string|null), phone (string|null), skills (string[]), experience (string[]), education (string[]), summary (string|null).\n\nCV:\n${cvText}`,
    );

    const parsedData = JSON.parse(result);
    await db.update(candidatesTable).set({ parsedData }).where(eq(candidatesTable.id, candidateId));
    res.json(parsedData);
  } catch (err) {
    logger.error(err, "CV parsing failed");
    res.status(500).json({ error: "CV parsing failed" });
  }
});

router.post("/ai/rank-candidates", authMiddleware, aiRoles, async (req, res): Promise<void> => {
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
    const candidateSummaries = candidateDetails.map(({ candidate, application }) => ({
      applicationId: application.id,
      candidateId: candidate?.id,
      candidateName: candidate?.name ?? "Unknown",
      parsedData: candidate?.parsedData,
    }));

    const result = await callAI(
      "You are an expert HR recruiter. Rank candidates for a job based on their profile. Return JSON only.",
      `Job Title: ${job.title}\nJob Description: ${job.description}\n\nCandidates:\n${JSON.stringify(candidateSummaries, null, 2)}\n\nReturn JSON with field: rankings (array of { applicationId, candidateId, candidateName, score (0-100 number), recommendation (string) }) ordered by score descending.`,
    );

    const parsedResult = JSON.parse(result) as { rankings: Array<{ applicationId: number; candidateId: number; candidateName: string; score: number; recommendation: string }> };

    for (const ranked of parsedResult.rankings) {
      if (!ranked.candidateId) continue;
      await db.insert(aiScoresTable).values({
        candidateId: ranked.candidateId,
        jobId,
        score: String(ranked.score),
        recommendation: ranked.recommendation,
        metadata: { rankingContext: job.title },
      }).onConflictDoNothing();
    }

    res.json(parsedResult.rankings);
  } catch (err) {
    logger.error(err, "Candidate ranking failed");
    res.status(500).json({ error: "Candidate ranking failed" });
  }
});

router.post("/ai/interview-questions", authMiddleware, aiRoles, async (req, res): Promise<void> => {
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

  try {
    const result = await callAI(
      "You are an expert interviewer. Generate tailored interview questions for a candidate applying to a specific role. Return JSON only.",
      `Job Title: ${job.title}\nJob Description: ${job.description}\n\nCandidate: ${candidate.name}\nProfile: ${JSON.stringify(candidate.parsedData ?? { name: candidate.name })}\n\nGenerate 8-10 targeted interview questions. Return JSON: { questions: string[], jobTitle: string }`,
    );

    const parsedResult = JSON.parse(result);
    res.json(parsedResult);
  } catch (err) {
    logger.error(err, "Interview question generation failed");
    res.status(500).json({ error: "Interview question generation failed" });
  }
});

router.get("/ai/predictions/workforce", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const agencyId = req.query.agency_id
    ? parseInt(req.query.agency_id as string, 10)
    : (req.user?.roleName === "admin" ? undefined : req.user?.agencyId ?? undefined);

  const employees = agencyId != null
    ? await db.select().from(employeesTable).where(eq(employeesTable.agencyId, agencyId))
    : await db.select().from(employeesTable);

  const contracts = await db.select().from(contractsTable).where(eq(contractsTable.status, "active"));
  const departments = await db.select().from(departmentsTable);

  try {
    const result = await callAI(
      "You are an HR workforce planning expert. Analyze employee and contract data to predict workforce risks. Return JSON only.",
      `Employees (${employees.length} total, showing up to 20):\n${JSON.stringify(employees.slice(0, 20), null, 2)}\n\nActive Contracts (${contracts.length}):\n${JSON.stringify(contracts.slice(0, 20), null, 2)}\n\nDepartments:\n${JSON.stringify(departments, null, 2)}\n\nReturn JSON: { attritionRisk: Array<{ departmentName, riskLevel: 'low'|'medium'|'high', staffAtRisk: number, reason: string }>, predictedVacancies: Array<{ departmentName, predictedVacancies: number, timeframe: string, confidence: 'low'|'medium'|'high' }>, recommendations: string[] }`,
    );

    const parsedResult = JSON.parse(result);
    res.json(parsedResult);
  } catch (err) {
    logger.error(err, "Workforce prediction failed");
    res.status(500).json({ error: "Workforce prediction failed" });
  }
});

export default router;
