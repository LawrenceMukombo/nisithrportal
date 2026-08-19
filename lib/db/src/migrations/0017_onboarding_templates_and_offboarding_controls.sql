CREATE TABLE IF NOT EXISTS "onboarding_templates" (
  "id" serial PRIMARY KEY, "name" text NOT NULL, "active" boolean NOT NULL DEFAULT true, "department_id" integer,
  "employment_type" text, "location" text, "version" integer NOT NULL DEFAULT 1, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_template_tasks" (
  "id" serial PRIMARY KEY, "template_id" integer NOT NULL REFERENCES "onboarding_templates"("id") ON DELETE CASCADE,
  "title" text NOT NULL, "description" text, "category" text NOT NULL DEFAULT 'general', "assigned_role" text NOT NULL DEFAULT 'hr_officer',
  "mandatory" boolean NOT NULL DEFAULT true, "due_days" integer, "order_index" integer NOT NULL DEFAULT 0, "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "onboarding_workflows" ADD COLUMN IF NOT EXISTS "template_id" integer REFERENCES "onboarding_templates"("id");--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD COLUMN IF NOT EXISTS "mandatory" boolean NOT NULL DEFAULT true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_templates_applicability_idx" ON "onboarding_templates" ("active", "department_id", "employment_type");
