import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

  let allApps = await db.select().from(applicationsTable).orderBy(applicationsTable.createdAt);

  if (agencyId != null) {
    const agencyJobs = await db.select({ id: jobsTable.id })
      .from(jobsTable).where(eq(jobsTable.agencyId, agencyId));
    const jobIds = new Set(agencyJobs.map((j) => j.id));
    allApps = allApps.filter((a) => jobIds.has(a.jobId));
  }

  if (query.data.job_id != null) allApps = allApps.filter((a) => a.jobId === query.data.job_id);
  if (query.data.candidate_id != null) allApps = allApps.filter((a) => a.candidateId === query.data.candidate_id);
  if (query.data.status != null) allApps = allApps.filter((a) => a.status === query.data.status);

  res.json(allApps);
});

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId, candidateName, candidateEmail, candidatePhone, cvUrl, coverLetter } = parsed.data;

  const [jobExists] = await db.select({ id: jobsTable.id, status: jobsTable.status })
    .from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!jobExists) {
    res.status(404).json({ error: "Job not found" });
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
  } else if (cvUrl) {
    [candidate] = await db.update(candidatesTable)
      .set({ cvUrl, name: candidateName })
      .where(eq(candidatesTable.id, candidate.id))
      .returning();
  }

  const [application] = await db.insert(applicationsTable).values({
    jobId,
    candidateId: candidate.id,
    status: "applied",
    coverLetter: coverLetter ?? null,
  }).returning();

  res.status(201).json(application);
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
  res.json(application);
});

export default router;
