import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, aiScoresTable, jobsTable } from "@workspace/db";
import { GetAiScoresQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

router.get("/ai-scores", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const query = GetAiScoresQueryParams.safeParse(req.query);
  const agencyId = getTenantAgencyId(req);

  let scores = await db.select().from(aiScoresTable).orderBy(aiScoresTable.createdAt);

  if (agencyId != null) {
    const agencyJobs = await db.select({ id: jobsTable.id })
      .from(jobsTable).where(eq(jobsTable.agencyId, agencyId));
    const jobIds = new Set(agencyJobs.map((j) => j.id));
    scores = scores.filter((s) => s.jobId != null && jobIds.has(s.jobId));
  }

  if (query.success) {
    if (query.data.job_id != null) scores = scores.filter((s) => s.jobId === query.data.job_id);
    if (query.data.candidate_id != null) scores = scores.filter((s) => s.candidateId === query.data.candidate_id);
  }

  res.json(scores);
});

export default router;
