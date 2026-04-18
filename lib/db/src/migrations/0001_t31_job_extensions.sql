-- T31: Add location breakdown, publish target, and auto-expire to jobs table
ALTER TABLE "jobs" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "office_site" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "publish_target" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "auto_expire" boolean;--> statement-breakpoint
-- T31: Add mandatory filter and auto-reject to screening questions table
ALTER TABLE "job_screening_questions" ADD COLUMN "is_mandatory_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job_screening_questions" ADD COLUMN "auto_reject" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job_screening_questions" ADD COLUMN "auto_reject_value" text;
