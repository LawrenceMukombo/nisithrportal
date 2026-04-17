import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, aiScoresTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/ai-scores", authMiddleware, async (req, res): Promise<void> => {
  const jobId = req.query.job_id ? parseInt(req.query.job_id as string, 10) : undefined;
  const candidateId = req.query.candidate_id ? parseInt(req.query.candidate_id as string, 10) : undefined;

  const conditions = [];
  if (jobId) conditions.push(eq(aiScoresTable.jobId, jobId));
  if (candidateId) conditions.push(eq(aiScoresTable.candidateId, candidateId));

  const results = conditions.length > 0
    ? await db.select().from(aiScoresTable).where(and(...conditions)).orderBy(aiScoresTable.createdAt)
    : await db.select().from(aiScoresTable).orderBy(aiScoresTable.createdAt);

  res.json(results);
});

export default router;
