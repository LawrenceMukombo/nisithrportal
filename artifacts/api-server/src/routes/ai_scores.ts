import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, aiScoresTable } from "@workspace/db";
import { GetAiScoresQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/ai-scores", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const query = GetAiScoresQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success) {
    if (query.data.job_id != null) conditions.push(eq(aiScoresTable.jobId, query.data.job_id));
    if (query.data.candidate_id != null) conditions.push(eq(aiScoresTable.candidateId, query.data.candidate_id));
  }
  const results = conditions.length > 0
    ? await db.select().from(aiScoresTable).where(and(...conditions)).orderBy(aiScoresTable.createdAt)
    : await db.select().from(aiScoresTable).orderBy(aiScoresTable.createdAt);
  res.json(results);
});

export default router;
