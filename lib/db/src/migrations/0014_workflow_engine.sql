CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" serial PRIMARY KEY, "agency_id" integer REFERENCES "agencies"("id"), "entity_type" text NOT NULL, "name" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true, "steps" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_instances" (
  "id" serial PRIMARY KEY, "definition_id" integer REFERENCES "workflow_definitions"("id"), "agency_id" integer REFERENCES "agencies"("id"),
  "entity_type" text NOT NULL, "entity_id" integer NOT NULL, "requester_id" integer REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'pending', "current_step" integer NOT NULL DEFAULT 1, "created_at" timestamptz NOT NULL DEFAULT now(), "completed_at" timestamptz
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_actions" (
  "id" serial PRIMARY KEY, "instance_id" integer NOT NULL REFERENCES "approval_instances"("id") ON DELETE CASCADE,
  "step" integer NOT NULL, "action" text NOT NULL, "actor_id" integer REFERENCES "users"("id"), "comment" text, "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "approval_actions_action_check" CHECK ("action" IN ('approve', 'reject', 'delegate'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_instances_entity_idx" ON "approval_instances" ("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_instances_pending_idx" ON "approval_instances" ("status", "agency_id");
