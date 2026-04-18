-- T31: Location breakdown for jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "country" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "province" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "office_site" text;--> statement-breakpoint
-- T31: Publishing controls for jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "publish_target" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "auto_expire" boolean;--> statement-breakpoint
-- T31: Screening question enhancements
ALTER TABLE "job_screening_questions" ADD COLUMN IF NOT EXISTS "is_mandatory_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job_screening_questions" ADD COLUMN IF NOT EXISTS "auto_reject" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job_screening_questions" ADD COLUMN IF NOT EXISTS "auto_reject_value" text;
