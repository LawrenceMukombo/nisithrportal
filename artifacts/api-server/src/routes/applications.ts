import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, applicationsTable, candidatesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/applications", authMiddleware, async (req, res): Promise<void> => {
  const jobId = req.query.job_id ? parseInt(req.query.job_id as string, 10) : undefined;
  const candidateId = req.query.candidate_id ? parseInt(req.query.candidate_id as string, 10) : undefined;
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (jobId) conditions.push(eq(applicationsTable.jobId, jobId));
  if (candidateId) conditions.push(eq(applicationsTable.candidateId, candidateId));
  if (status) conditions.push(eq(applicationsTable.status, status));

  const results = conditions.length > 0
    ? await db.select().from(applicationsTable).where(and(...conditions)).orderBy(applicationsTable.createdAt)
    : await db.select().from(applicationsTable).orderBy(applicationsTable.createdAt);

  res.json(results);
});

router.post("/applications", async (req, res): Promise<void> => {
  const { jobId, candidateName, candidateEmail, candidatePhone, cvUrl, coverLetter } = req.body;

  if (!jobId || !candidateName || !candidateEmail) {
    res.status(400).json({ error: "jobId, candidateName, and candidateEmail are required" });
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
    [candidate] = await db.update(candidatesTable).set({ cvUrl }).where(eq(candidatesTable.id, candidate.id)).returning();
  }

  const [application] = await db.insert(applicationsTable).values({
    jobId,
    candidateId: candidate.id,
    status: "applied",
    coverLetter: coverLetter ?? null,
  }).returning();

  res.status(201).json(application);
});

router.get("/applications/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(application);
});

router.patch("/applications/:id/status", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, notes, score } = req.body;
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  const [application] = await db.update(applicationsTable)
    .set({ status, notes: notes ?? undefined, score: score ?? undefined })
    .where(eq(applicationsTable.id, id))
    .returning();
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(application);
});

export default router;
