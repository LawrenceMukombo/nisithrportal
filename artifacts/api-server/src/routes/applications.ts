import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, applicationsTable, candidatesTable } from "@workspace/db";
import {
  GetApplicationsQueryParams,
  CreateApplicationBody,
  GetApplicationParams,
  UpdateApplicationStatusParams,
  UpdateApplicationStatusBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/applications", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const query = GetApplicationsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success) {
    if (query.data.job_id != null) conditions.push(eq(applicationsTable.jobId, query.data.job_id));
    if (query.data.candidate_id != null) conditions.push(eq(applicationsTable.candidateId, query.data.candidate_id));
    if (query.data.status != null) conditions.push(eq(applicationsTable.status, query.data.status));
  }
  const results = conditions.length > 0
    ? await db.select().from(applicationsTable).where(and(...conditions)).orderBy(applicationsTable.createdAt)
    : await db.select().from(applicationsTable).orderBy(applicationsTable.createdAt);
  res.json(results);
});

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId, candidateName, candidateEmail, candidatePhone, cvUrl, coverLetter } = parsed.data;

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
  res.json(application);
});

router.patch("/applications/:id/status", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const params = UpdateApplicationStatusParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid application id" });
    return;
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
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(application);
});

export default router;
