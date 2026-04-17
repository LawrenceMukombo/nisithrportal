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
import { createNotification, getUserIdByEmail } from "../lib/notificationService";
const router: IRouter = Router();

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
  }

  const [application] = await db.insert(applicationsTable).values({
    jobId,
    candidateId: candidate.id,
    status: "applied",
    coverLetter: coverLetter ?? null,
  }).returning();

  res.status(201).json(application);
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
