ALTER TABLE "integration_configs" ADD COLUMN IF NOT EXISTS "alert_threshold" integer NOT NULL DEFAULT 50;--> statement-breakpoint
ALTER TABLE "integration_configs" ADD COLUMN IF NOT EXISTS "degraded_threshold" integer NOT NULL DEFAULT 80;--> statement-breakpoint
ALTER TABLE "integration_configs" ADD COLUMN IF NOT EXISTS "last_alerted_health" text;
