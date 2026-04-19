import { Router, type IRouter } from "express";
import { eq, and, inArray, isNull, or } from "drizzle-orm";
import { db, savedJobsTable, candidatesTable, jobsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const PUBLIC_STATUSES = ["open", "published"] as const;
const PUBLIC_TARGETS = ["public", "both"] as const;

function isPubliclyVisible(job: { status: string; publishTarget: string | null }): boolean {
  const statusOk = (PUBLIC_STATUSES as readonly string[]).includes(job.status);
  const targetOk = job.publishTarget == null || (PUBLIC_TARGETS as readonly string[]).includes(job.publishTarget);
  return statusOk && targetOk;
}

async function getCandidateId(userId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: candidatesTable.id })
    .from(candidatesTable)
    .where(eq(candidatesTable.userId, userId));
  return row?.id ?? null;
}

router.get("/saved-jobs", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const candidateId = await getCandidateId(userId);
  if (candidateId == null) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({
      savedJobId: savedJobsTable.id,
      createdAt: savedJobsTable.createdAt,
      job: jobsTable,
    })
    .from(savedJobsTable)
    .innerJoin(jobsTable, and(
      eq(savedJobsTable.jobId, jobsTable.id),
      inArray(jobsTable.status, [...PUBLIC_STATUSES]),
      or(isNull(jobsTable.publishTarget), inArray(jobsTable.publishTarget, [...PUBLIC_TARGETS]))!,
    ))
    .where(eq(savedJobsTable.applicantId, candidateId));

  res.json(rows);
});

router.get("/saved-jobs/ids", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const candidateId = await getCandidateId(userId);
  if (candidateId == null) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({ jobId: savedJobsTable.jobId })
    .from(savedJobsTable)
    .innerJoin(jobsTable, and(
      eq(savedJobsTable.jobId, jobsTable.id),
      inArray(jobsTable.status, [...PUBLIC_STATUSES]),
      or(isNull(jobsTable.publishTarget), inArray(jobsTable.publishTarget, [...PUBLIC_TARGETS]))!,
    ))
    .where(eq(savedJobsTable.applicantId, candidateId));

  res.json(rows.map((r) => r.jobId));
});

router.post("/saved-jobs/:jobId", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const jobId = parseInt(req.params.jobId as string, 10);
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const [job] = await db
    .select({ id: jobsTable.id, status: jobsTable.status, publishTarget: jobsTable.publishTarget })
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));

  if (!job || !isPubliclyVisible(job)) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const candidateId = await getCandidateId(userId);
  if (candidateId == null) {
    res.status(400).json({ error: "No candidate profile found for this user" });
    return;
  }

  const [existing] = await db
    .select({ id: savedJobsTable.id })
    .from(savedJobsTable)
    .where(and(eq(savedJobsTable.applicantId, candidateId), eq(savedJobsTable.jobId, jobId)));

  if (existing) {
    res.status(200).json({ saved: true, alreadySaved: true });
    return;
  }

  await db.insert(savedJobsTable).values({ applicantId: candidateId, jobId });
  res.status(201).json({ saved: true });
});

router.delete("/saved-jobs/:jobId", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const jobId = parseInt(req.params.jobId as string, 10);
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const candidateId = await getCandidateId(userId);
  if (candidateId == null) {
    res.status(404).json({ error: "No candidate profile found" });
    return;
  }

  await db
    .delete(savedJobsTable)
    .where(and(eq(savedJobsTable.applicantId, candidateId), eq(savedJobsTable.jobId, jobId)));

  res.json({ saved: false });
});

export default router;
