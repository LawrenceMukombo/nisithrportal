-- Add user security and preference columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employee_id" integer REFERENCES "employees"("id");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" timestamptz;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamptz;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_password_change_at" timestamptz;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_saved_job_closing" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "closing_soon_days" integer NOT NULL DEFAULT 7;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_stale_applications" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
