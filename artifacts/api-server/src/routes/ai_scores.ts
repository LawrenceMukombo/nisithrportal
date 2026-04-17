import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, aiScoresTable, jobsTable } from "@workspace/db";
import { GetAiScoresQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { z } from "zod";

const router: IRouter = Router();

const ROLES = ["admin", "hr_officer", "hiring_manager"] as const;

const CreateAiScoreBody = z.object({
  candidateId: z.number().int().positive(),
  jobId: z.number().int().positive(),
  score: z.string().optional(),
  recommendation: z.string().optional(),
});

const UpdateAiScoreBody = z.object({
  score: z.string().optional(),
  recommendation: z.string().optional(),
});

async function getAgencyJobIds(agencyId: number): Promise<number[]> {
  const rows = await db.select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.agencyId, agencyId));
  return rows.map((r) => r.id);
}

router.get("/ai-scores", authMiddleware, requireRole(...ROLES), async (req, res): Promise<void> => {
  const query = GetAiScoresQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const agencyId = getTenantAgencyId(req);

  let rows = await db.select().from(aiScoresTable).orderBy(aiScoresTable.createdAt);

  if (agencyId != null) {
    const jobIds = await getAgencyJobIds(agencyId);
    rows = rows.filter((s) => s.jobId != null && jobIds.includes(s.jobId));
  }

  if (query.data.job_id != null) rows = rows.filter((s) => s.jobId === query.data.job_id);
  if (query.data.candidate_id != null) rows = rows.filter((s) => s.candidateId === query.data.candidate_id);

  res.json(rows);
});

router.post("/ai-scores", authMiddleware, requireRole(...ROLES), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  const body = CreateAiScoreBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  if (agencyId != null) {
    const job = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, body.data.jobId)).then((r) => r[0]);
    if (!assertTenantAccess(res, job?.agencyId ?? null, agencyId)) return;
  }

  const [created] = await db.insert(aiScoresTable).values({
    candidateId: body.data.candidateId,
    jobId: body.data.jobId,
    score: body.data.score ?? null,
    recommendation: body.data.recommendation ?? null,
  }).returning();

  res.status(201).json(created);
});

router.get("/ai-scores/:id", authMiddleware, requireRole(...ROLES), async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  const idSchema = z.number().int().positive();
  if (!idSchema.safeParse(id).success) {
    res.status(400).json({ error: "Invalid ai score id" });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  const score = await db.select().from(aiScoresTable).where(eq(aiScoresTable.id, id)).then((r) => r[0]);

  if (!score) {
    res.status(404).json({ error: "AI score not found" });
    return;
  }

  if (agencyId != null) {
    const job = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, score.jobId!)).then((r) => r[0]);
    if (!assertTenantAccess(res, job?.agencyId ?? null, agencyId)) return;
  }

  res.json(score);
});

router.patch("/ai-scores/:id", authMiddleware, requireRole(...ROLES), async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  const idSchema = z.number().int().positive();
  if (!idSchema.safeParse(id).success) {
    res.status(400).json({ error: "Invalid ai score id" });
    return;
  }

  const body = UpdateAiScoreBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  const existing = await db.select().from(aiScoresTable).where(eq(aiScoresTable.id, id)).then((r) => r[0]);
  if (!existing) {
    res.status(404).json({ error: "AI score not found" });
    return;
  }

  if (agencyId != null) {
    const job = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, existing.jobId!)).then((r) => r[0]);
    if (!assertTenantAccess(res, job?.agencyId ?? null, agencyId)) return;
  }

  const [updated] = await db.update(aiScoresTable)
    .set({ ...body.data })
    .where(eq(aiScoresTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/ai-scores/:id", authMiddleware, requireRole(...ROLES), async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  const idSchema = z.number().int().positive();
  if (!idSchema.safeParse(id).success) {
    res.status(400).json({ error: "Invalid ai score id" });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  const existing = await db.select().from(aiScoresTable).where(eq(aiScoresTable.id, id)).then((r) => r[0]);
  if (!existing) {
    res.status(404).json({ error: "AI score not found" });
    return;
  }

  if (agencyId != null) {
    const job = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, existing.jobId!)).then((r) => r[0]);
    if (!assertTenantAccess(res, job?.agencyId ?? null, agencyId)) return;
  }

  await db.delete(aiScoresTable).where(eq(aiScoresTable.id, id));
  res.status(204).send();
});

export default router;
