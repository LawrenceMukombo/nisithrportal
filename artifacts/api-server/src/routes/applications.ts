import { Router, type IRouter } from "express";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db, applicationsTable, applicationStatusHistoryTable, candidatesTable, jobsTable } from "@workspace/db";
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
import { autoParseCvBackground } from "../lib/cvParser";
import { ObjectStorageService } from "../lib/objectStorage";
import { canAccessObjectForAgency } from "../lib/objectAcl";
const router: IRouter = Router();

const INTERNAL_OBJECT_PREFIX = "/api/storage/objects/";

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

  const appIds = allApps.map((a) => a.id);
  const historyRows = appIds.length > 0
    ? await db.select().from(applicationStatusHistoryTable)
        .where(inArray(applicationStatusHistoryTable.applicationId, appIds))
        .orderBy(asc(applicationStatusHistoryTable.changedAt))
    : [];

  const historyByApp: Record<number, typeof historyRows> = {};
  for (const row of historyRows) {
    (historyByApp[row.applicationId] ??= []).push(row);
  }

  res.json(allApps.map((a) => ({ ...a, statusHistory: historyByApp[a.id] ?? [] })));
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

  const appIds = apps.map((a) => a.id);
  const historyRows = appIds.length > 0
    ? await db.select().from(applicationStatusHistoryTable)
        .where(inArray(applicationStatusHistoryTable.applicationId, appIds))
        .orderBy(asc(applicationStatusHistoryTable.changedAt))
    : [];

  const historyByApp: Record<number, typeof historyRows> = {};
  for (const row of historyRows) {
    (historyByApp[row.applicationId] ??= []).push(row);
  }

  res.json(apps.map((a) => ({ ...a, statusHistory: historyByApp[a.id] ?? [] })));
});

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId, candidateName, candidateEmail, candidatePhone, cvUrl: rawCvUrl, coverLetter } = parsed.data;

  const [jobExists] = await db.select({ id: jobsTable.id, status: jobsTable.status, closingDate: jobsTable.closingDate, agencyId: jobsTable.agencyId })
    .from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!jobExists || jobExists.status !== "published") {
    res.status(422).json({ error: "Job is not accepting applications" });
    return;
  }
  if (jobExists.closingDate != null && new Date(jobExists.closingDate) < new Date()) {
    res.status(422).json({ error: "Job closing date has passed" });
    return;
  }

  // Validate caller-provided cvUrl to prevent IDOR via forged internal storage paths.
  // Internal storage paths must have an ACL policy owned by this job's agency.
  // Unvalidated or cross-agency paths are silently dropped (not stored or parsed).
  let cvUrl: string | null = rawCvUrl ?? null;
  if (cvUrl && cvUrl.startsWith(INTERNAL_OBJECT_PREFIX)) {
    try {
      const svc = new ObjectStorageService();
      const objectPath = "/objects/" + cvUrl.slice(INTERNAL_OBJECT_PREFIX.length);
      const file = await svc.getObjectEntityFile(objectPath);
      const allowed = await canAccessObjectForAgency(file, jobExists.agencyId ?? null);
      if (!allowed) {
        cvUrl = null;
      }
    } catch {
      cvUrl = null;
    }
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

  await db.insert(applicationStatusHistoryTable).values({
    applicationId: application.id,
    status: "applied",
  });

  res.status(201).json({ ...application, statusHistory: [{ id: 0, applicationId: application.id, status: "applied", changedAt: application.createdAt, note: null }] });

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

  // Auto-parse CV in the background. Fire-and-forget: errors are swallowed.
  // Always re-parse when a new CV file was uploaded in this submission (cvUrl),
  // so returning candidates with a freshly uploaded document get updated parsed data.
  // For text-only submissions (no file), only parse on first application (no parsedData yet).
  const shouldParse = Boolean(cvUrl) || (!candidate.parsedData && Boolean(coverLetter));
  if (shouldParse) {
    void autoParseCvBackground(candidate.id, {
      cvUrl: cvUrl ?? null,
      fallbackText: coverLetter
        ? `Name: ${candidateName}\nEmail: ${candidateEmail}\n\n${coverLetter}`
        : null,
    });
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
  const statusHistory = await db.select().from(applicationStatusHistoryTable)
    .where(eq(applicationStatusHistoryTable.applicationId, application.id))
    .orderBy(asc(applicationStatusHistoryTable.changedAt));
  res.json({ ...application, statusHistory });
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

  if (body.data.status !== existing.status) {
    await db.insert(applicationStatusHistoryTable).values({
      applicationId: application.id,
      fromStatus: existing.status,
      status: body.data.status,
      note: body.data.notes ?? null,
    });
  }

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
            onboarding: "has started the onboarding process — welcome to the team!",
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

  const statusHistory = await db.select().from(applicationStatusHistoryTable)
    .where(eq(applicationStatusHistoryTable.applicationId, application.id))
    .orderBy(asc(applicationStatusHistoryTable.changedAt));
  res.json({ ...application, statusHistory });
});

export default router;
