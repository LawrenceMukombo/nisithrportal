import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, applicationsTable, candidatesTable, jobsTable } from "@workspace/db";
import {
  GetApplicationsQueryParams,
  CreateApplicationBody,
  GetApplicationParams,
  UpdateApplicationStatusParams,
  UpdateApplicationStatusBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { createNotification, getUserIdByEmail, notifyHrOfficers } from "../lib/notificationService";
import { openai } from "@workspace/integrations-openai-ai-server";
const router: IRouter = Router();

async function autoParseCv(candidateId: number, cvText: string): Promise<void> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "You are an expert CV parser. Extract structured information from the provided text. Return JSON only.",
        },
        {
          role: "user",
          content: `Parse the following text and extract candidate information. Return JSON with fields: name (string|null), email (string|null), phone (string|null), skills (string[]), experience (string[]), education (string[]), summary (string|null).\n\nText:\n${cvText}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return;
    const parsedData = JSON.parse(content) as Record<string, unknown>;
    await db.update(candidatesTable).set({ parsedData }).where(eq(candidatesTable.id, candidateId));
  } catch (err) {
    console.error("[applications] Auto CV parse failed:", err);
  }
}

async function getJobAgencyId(jobId: number): Promise<number | null> {
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  return job?.agencyId ?? null;
}

router.get("/applications", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const query = GetApplicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  const conditions = [];

  if (agencyId != null) {
    conditions.push(inArray(applicationsTable.jobId,
      db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.agencyId, agencyId)),
    ));
  }
  if (query.data.job_id != null) conditions.push(eq(applicationsTable.jobId, query.data.job_id));
  if (query.data.candidate_id != null) conditions.push(eq(applicationsTable.candidateId, query.data.candidate_id));
  if (query.data.status != null) conditions.push(eq(applicationsTable.status, query.data.status));

  const allApps = conditions.length > 0
    ? await db.select().from(applicationsTable).where(and(...conditions)).orderBy(applicationsTable.createdAt)
    : await db.select().from(applicationsTable).orderBy(applicationsTable.createdAt);

  res.json(allApps);
});

router.get("/applications/my", authMiddleware, async (req, res): Promise<void> => {
  const userEmail = req.user?.email;
  if (!userEmail) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const candidates = await db.select({ id: candidatesTable.id })
    .from(candidatesTable)
    .where(eq(candidatesTable.email, userEmail));

  if (candidates.length === 0) {
    res.json([]);
    return;
  }

  const candidateIds = candidates.map((c) => c.id);
  const apps = await db.select()
    .from(applicationsTable)
    .where(inArray(applicationsTable.candidateId, candidateIds))
    .orderBy(applicationsTable.createdAt);

  res.json(apps);
});

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId, candidateName, candidateEmail, candidatePhone, cvUrl, coverLetter } = parsed.data;

  const [jobExists] = await db.select({ id: jobsTable.id, status: jobsTable.status, closingDate: jobsTable.closingDate })
    .from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!jobExists || jobExists.status !== "published") {
    res.status(422).json({ error: "Job is not accepting applications" });
    return;
  }
  if (jobExists.closingDate != null && new Date(jobExists.closingDate) < new Date()) {
    res.status(422).json({ error: "Job closing date has passed" });
    return;
  }

  let [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.email, candidateEmail));
  if (!candidate) {
    [candidate] = await db.insert(candidatesTable).values({
      name: candidateName,
      email: candidateEmail,
      phone: candidatePhone ?? null,
      cvUrl: cvUrl ?? null,
    }).returning();
  } else {
    // Update candidate record with the latest CV URL and contact details for repeat applicants
    const updates: Record<string, string | null> = {};
    if (cvUrl) updates.cvUrl = cvUrl;
    if (candidatePhone && !candidate.phone) updates.phone = candidatePhone;
    if (Object.keys(updates).length > 0) {
      [candidate] = await db.update(candidatesTable)
        .set(updates)
        .where(eq(candidatesTable.id, candidate.id))
        .returning();
    }
  }

  const [application] = await db.insert(applicationsTable).values({
    jobId,
    candidateId: candidate.id,
    status: "applied",
    coverLetter: coverLetter ?? null,
  }).returning();

  res.status(201).json(application);

  // Notify the responsible HR officer (job poster) about the new application.
  // If the job has no assigned poster, fall back to all HR officers in the agency.
  try {
    const [job] = await db
      .select({ agencyId: jobsTable.agencyId, title: jobsTable.title, createdBy: jobsTable.createdBy })
      .from(jobsTable).where(eq(jobsTable.id, jobId));
    if (job?.agencyId != null) {
      const message = `New application received from ${candidateName} for "${job.title}".`;
      if (job.createdBy != null) {
        await createNotification({ userId: job.createdBy, type: "new_application", message });
      } else {
        await notifyHrOfficers(job.agencyId, "new_application", message);
      }
    }
  } catch (err) {
    console.error("[applications] New application HR notification failed:", err);
  }

  // Auto-parse CV in the background using the cover letter text when the candidate
  // has not been parsed before. Fire-and-forget: errors are swallowed.
  if (coverLetter && !candidate.parsedData) {
    void autoParseCv(candidate.id, `Name: ${candidateName}\nEmail: ${candidateEmail}\n\n${coverLetter}`);
  }
});

router.get("/applications/track", async (req, res): Promise<void> => {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const refId = parseInt(typeof req.query.ref === "string" ? req.query.ref : "", 10);

  if (!email || isNaN(refId)) {
    res.status(400).json({ error: "email and ref are required" });
    return;
  }

  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, refId));
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, application.candidateId));
  if (!candidate || candidate.email.toLowerCase() !== email) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [job] = await db.select({ title: jobsTable.title })
    .from(jobsTable).where(eq(jobsTable.id, application.jobId));

  res.json({
    id: application.id,
    status: application.status,
    submittedAt: application.createdAt,
    jobTitle: job?.title ?? "Unknown Position",
    jobLocation: null,
  });
});

router.get("/applications/:id", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }
  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, params.data.id));
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const jobAgencyId = await getJobAgencyId(application.jobId);
    if (!assertTenantAccess(res, jobAgencyId, agencyId)) return;
  }
  res.json(application);
});

router.patch("/applications/:id/status", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const params = UpdateApplicationStatusParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }
  const [existing] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const jobAgencyId = await getJobAgencyId(existing.jobId);
    if (!assertTenantAccess(res, jobAgencyId, agencyId)) return;
  }
  const body = UpdateApplicationStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [application] = await db.update(applicationsTable)
    .set({
      status: body.data.status,
      notes: body.data.notes ?? undefined,
      score: body.data.score ?? undefined,
    })
    .where(eq(applicationsTable.id, params.data.id))
    .returning();

  // Trigger notification to applicant on status change
  if (body.data.status && body.data.status !== existing.status) {
    try {
      const [candidate] = await db.select({ email: candidatesTable.email })
        .from(candidatesTable)
        .where(eq(candidatesTable.id, existing.candidateId));
      if (candidate?.email) {
        const applicantUserId = await getUserIdByEmail(candidate.email);
        if (applicantUserId) {
          const statusLabel: Record<string, string> = {
            screening: "is being reviewed",
            interview: "has advanced to interview stage",
            offer: "has received a job offer",
            hired: "has been accepted — congratulations!",
            rejected: "was not successful this time",
            withdrawn: "has been withdrawn",
          };
          const label = statusLabel[body.data.status] ?? `has been updated to "${body.data.status}"`;
          await createNotification({
            userId: applicantUserId,
            type: "application_status",
            message: `Your application ${label}.`,
          });
        }
      }
    } catch (err) {
      // Non-fatal — don't fail the status update if notification fails
      console.error("[applications] Notification trigger failed:", err);
    }
  }

  res.json(application);
});

export default router;
