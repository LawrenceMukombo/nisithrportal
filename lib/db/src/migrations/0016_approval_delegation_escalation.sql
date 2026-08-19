ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" integer REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "delegated_to_user_id" integer REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "due_at" timestamptz;--> statement-breakpoint
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "escalated_at" timestamptz;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_instances_overdue_idx" ON "approval_instances" ("due_at") WHERE "status" = 'pending' AND "escalated_at" IS NULL;
