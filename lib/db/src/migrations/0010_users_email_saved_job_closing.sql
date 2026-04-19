-- T184: Per-user opt-out for "saved job closing soon" email alerts (default: opted in)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_saved_job_closing" boolean NOT NULL DEFAULT true;
