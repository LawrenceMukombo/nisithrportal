import { Router, type IRouter } from "express";
import { eq, and, inArray, isNull, or, gte, lte, sql } from "drizzle-orm";
import { db, savedJobsTable, candidatesTable, jobsTable } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { createNotification } from "../lib/notificationService";
import { sendSavedJobClosingEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PUBLIC_STATUSES = ["open", "published"] as const;
const PUBLIC_TARGETS = ["public", "both"] as const;
const CLOSING_SOON_DAYS = 7;
export const SAVED_JOB_CLOSING_NOTIF_TYPE = "saved_job_closing";

function isPubliclyVisible(job: { status: string; publishTarget: string | null }): boolean {
  const statusOk = (PUBLIC_STATUSES as readonly string[]).includes(job.status);
  const targetOk = job.publishTarget == null || (PUBLIC_TARGETS as readonly string[]).includes(job.publishTarget);
  return statusOk && targetOk;
}

function daysUntil(closingDate: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const close = new Date(closingDate);
  close.setUTCHours(0, 0, 0, 0);
  return Math.ceil((close.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

async function getCandidateId(userId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: candidatesTable.id })
    .from(candidatesTable)
    .where(eq(candidatesTable.userId, userId));
  return row?.id ?? null;
}

/**
 * Notify a single applicant that one of their saved jobs is closing soon.
 * Idempotent within the last 24 hours per (user, job).
 */
async function notifyApplicantOfClosingJob(params: {
  userId: number;
  candidateName: string;
  candidateEmail: string | null;
  emailOptIn: boolean;
  jobId: number;
  jobTitle: string;
  closingDate: string;
}): Promise<boolean> {
  const { userId, candidateName, candidateEmail, emailOptIn, jobId, jobTitle, closingDate } = params;
  const daysLeft = daysUntil(closingDate);
  if (daysLeft < 0 || daysLeft > CLOSING_SOON_DAYS) return false;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [existing] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.type, SAVED_JOB_CLOSING_NOTIF_TYPE),
        gte(notificationsTable.createdAt, yesterday),
        sql`${notificationsTable.message} LIKE ${'%(job #' + jobId + ')%'}`,
      ),
    )
    .limit(1);
  if (existing) return false;

  const closingPhrase = daysLeft <= 0
    ? "closes today"
    : daysLeft === 1
      ? "closes tomorrow"
      : `closes in ${daysLeft} days`;

  await createNotification({
    userId,
    type: SAVED_JOB_CLOSING_NOTIF_TYPE,
    message: `Saved job "${jobTitle}" ${closingPhrase} (job #${jobId}). Apply before the closing date.`,
  });

  if (candidateEmail && emailOptIn) {
    await sendSavedJobClosingEmail(candidateEmail, candidateName, jobTitle, jobId, daysLeft, closingDate, userId);
  }
  return true;
}

/**
 * Scan all saved jobs whose underlying job closes within the next 7 days
 * and notify the corresponding applicants (in-app + email).
 */
export async function triggerSavedJobClosingNotifications(): Promise<void> {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const horizon = new Date(now.getTime() + CLOSING_SOON_DAYS * 24 * 60 * 60 * 1000);
    const horizonStr = horizon.toISOString().slice(0, 10);

    const rows = await db
      .select({
        jobId: jobsTable.id,
        jobTitle: jobsTable.title,
        closingDate: jobsTable.closingDate,
        userId: candidatesTable.userId,
        candidateName: candidatesTable.name,
        candidateEmail: candidatesTable.email,
        emailOptIn: usersTable.emailSavedJobClosing,
      })
      .from(savedJobsTable)
      .innerJoin(candidatesTable, eq(savedJobsTable.applicantId, candidatesTable.id))
      .leftJoin(usersTable, eq(candidatesTable.userId, usersTable.id))
      .innerJoin(
        jobsTable,
        and(
          eq(savedJobsTable.jobId, jobsTable.id),
          inArray(jobsTable.status, [...PUBLIC_STATUSES]),
          or(isNull(jobsTable.publishTarget), inArray(jobsTable.publishTarget, [...PUBLIC_TARGETS]))!,
          gte(jobsTable.closingDate, todayStr),
          lte(jobsTable.closingDate, horizonStr),
        ),
      );

    let sent = 0;
    for (const row of rows) {
      if (!row.userId || !row.closingDate) continue;
      const did = await notifyApplicantOfClosingJob({
        userId: row.userId,
        candidateName: row.candidateName,
        candidateEmail: row.candidateEmail,
        emailOptIn: row.emailOptIn ?? true,
        jobId: row.jobId,
        jobTitle: row.jobTitle,
        closingDate: row.closingDate,
      });
      if (did) sent += 1;
    }
    if (sent > 0) {
      logger.info({ sent, scanned: rows.length }, "triggerSavedJobClosingNotifications: notifications dispatched");
    }
  } catch (err) {
    logger.error({ err }, "triggerSavedJobClosingNotifications: scan failed");
  }
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
    .select({
      id: jobsTable.id,
      title: jobsTable.title,
      status: jobsTable.status,
      publishTarget: jobsTable.publishTarget,
      closingDate: jobsTable.closingDate,
    })
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

  // Fire-and-forget: if the job is closing within 7 days, notify immediately.
  if (job.closingDate) {
    (async () => {
      try {
        const [cand] = await db
          .select({ name: candidatesTable.name, email: candidatesTable.email })
          .from(candidatesTable)
          .where(eq(candidatesTable.id, candidateId));
        const [u] = await db
          .select({ id: usersTable.id, emailOptIn: usersTable.emailSavedJobClosing })
          .from(usersTable)
          .where(eq(usersTable.id, userId));
        if (cand && u) {
          await notifyApplicantOfClosingJob({
            userId: u.id,
            candidateName: cand.name,
            candidateEmail: cand.email,
            emailOptIn: u.emailOptIn,
            jobId: job.id,
            jobTitle: job.title,
            closingDate: job.closingDate!,
          });
        }
      } catch (err) {
        logger.error({ err, jobId, userId }, "saved-jobs POST: closing-soon notify failed");
      }
    })();
  }

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
