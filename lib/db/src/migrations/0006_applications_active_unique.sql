-- T107: Database-level guard against duplicate active applications
-- Adds a partial unique index ensuring a candidate can have at most one
-- non-withdrawn application per job. Withdrawn rows are excluded so an
-- applicant may reapply after withdrawing.

-- Reconcile any pre-existing duplicates by withdrawing the older rows.
-- Keep the most recent active row per (candidate_id, job_id) pair so
-- the latest submission remains the live application.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY candidate_id, job_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM applications
  WHERE status <> 'withdrawn'
)
UPDATE applications
SET status = 'withdrawn'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "applications_candidate_job_active_unique"
  ON "applications" ("candidate_id", "job_id")
  WHERE status <> 'withdrawn';
