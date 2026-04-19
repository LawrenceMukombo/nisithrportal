-- T82: Saved jobs for applicants
CREATE TABLE IF NOT EXISTS "saved_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "applicant_id" integer NOT NULL REFERENCES "candidates"("id") ON DELETE CASCADE,
  "job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "saved_jobs_applicant_job_unique" UNIQUE("applicant_id","job_id")
);
