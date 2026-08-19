-- Production baseline for HR modules that previously existed only in Drizzle
-- schema files. Every statement is idempotent so existing development data is
-- preserved when the migration is applied.

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" serial PRIMARY KEY,
  "resource" text NOT NULL,
  "action" text NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "permissions_resource_action_uq" UNIQUE ("resource", "action")
);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" serial PRIMARY KEY,
  "role_id" integer NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" integer NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "scope" text NOT NULL DEFAULT 'organisation',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "role_permissions_role_permission_uq" UNIQUE ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_scope_check" CHECK ("scope" IN ('own', 'department', 'organisation'))
);--> statement-breakpoint
INSERT INTO "permissions" ("resource", "action", "description") VALUES
  ('documents', 'read', 'Read employee documents'),
  ('documents', 'create', 'Upload employee documents'),
  ('documents', 'delete', 'Delete employee documents')
ON CONFLICT ("resource", "action") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id", "scope")
SELECT r.id, p.id, 'organisation'
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name IN ('admin', 'hr_officer')
  AND p.resource = 'documents'
  AND p.action IN ('read', 'create', 'delete')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "leave_types" (
  "id" serial PRIMARY KEY, "name" text NOT NULL, "code" text NOT NULL UNIQUE,
  "default_days" integer NOT NULL DEFAULT 15, "carry_over_max" integer NOT NULL DEFAULT 5,
  "is_paid" boolean NOT NULL DEFAULT true, "description" text, "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_balances" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "leave_type_id" integer NOT NULL REFERENCES "leave_types"("id"), "year" integer NOT NULL DEFAULT 2026,
  "allocated_days" numeric(5,1) NOT NULL DEFAULT '15', "used_days" numeric(5,1) NOT NULL DEFAULT '0',
  "pending_days" numeric(5,1) NOT NULL DEFAULT '0', "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "leave_balances_employee_type_year_uq" UNIQUE ("employee_id", "leave_type_id", "year")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "leave_type_id" integer NOT NULL REFERENCES "leave_types"("id"), "start_date" date NOT NULL, "end_date" date NOT NULL,
  "days" numeric(5,1) NOT NULL, "reason" text NOT NULL, "status" text NOT NULL DEFAULT 'pending',
  "approver_id" integer REFERENCES "users"("id"), "approver_comment" text, "approved_at" timestamp,
  "attachment_url" text, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "date" date NOT NULL,
  "clock_in" timestamp, "clock_out" timestamp, "status" text NOT NULL DEFAULT 'present', "late_minutes" integer DEFAULT 0,
  "early_departure_minutes" integer DEFAULT 0, "location" text DEFAULT 'NISIT HQ Port Moresby', "source" text DEFAULT 'web',
  "notes" text, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_records_employee_date_uq" UNIQUE ("employee_id", "date")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "onboarding_workflows" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "candidate_id" integer REFERENCES "candidates"("id"),
  "status" text NOT NULL DEFAULT 'in_progress', "start_date" date NOT NULL, "target_completion_date" date, "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_tasks" (
  "id" serial PRIMARY KEY, "workflow_id" integer NOT NULL REFERENCES "onboarding_workflows"("id") ON DELETE CASCADE,
  "title" text NOT NULL, "description" text, "category" text NOT NULL DEFAULT 'general', "assigned_role" text NOT NULL DEFAULT 'hr_officer',
  "assigned_to_user_id" integer REFERENCES "users"("id"), "status" text NOT NULL DEFAULT 'pending', "due_date" date,
  "completed_at" timestamp, "completed_by_user_id" integer REFERENCES "users"("id"), "notes" text, "order_index" integer DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offboarding_workflows" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "reason" text NOT NULL,
  "separation_date" date NOT NULL, "status" text NOT NULL DEFAULT 'in_progress', "exit_interview_done" boolean DEFAULT false,
  "exit_interview_notes" text, "handover_completed" boolean DEFAULT false, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offboarding_tasks" (
  "id" serial PRIMARY KEY, "workflow_id" integer NOT NULL REFERENCES "offboarding_workflows"("id") ON DELETE CASCADE,
  "title" text NOT NULL, "category" text NOT NULL, "assigned_to_user_id" integer REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'pending', "due_date" date, "completed_at" timestamp, "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "performance_cycles" (
  "id" serial PRIMARY KEY, "title" text NOT NULL, "type" text NOT NULL DEFAULT 'annual', "start_date" date NOT NULL,
  "end_date" date NOT NULL, "status" text NOT NULL DEFAULT 'active', "description" text,
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "performance_reviews" (
  "id" serial PRIMARY KEY, "cycle_id" integer NOT NULL REFERENCES "performance_cycles"("id"), "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "reviewer_id" integer REFERENCES "users"("id"), "status" text NOT NULL DEFAULT 'self_review', "self_score" numeric(3,1),
  "manager_score" numeric(3,1), "final_rating" text, "self_feedback" text, "manager_feedback" text, "strengths" text,
  "development_areas" text, "goals_summary" text, "completed_at" timestamp, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "performance_reviews_cycle_employee_uq" UNIQUE ("cycle_id", "employee_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "cycle_id" integer REFERENCES "performance_cycles"("id"),
  "title" text NOT NULL, "description" text, "category" text NOT NULL DEFAULT 'okr', "target_date" date, "weightage" integer DEFAULT 20,
  "progress_percentage" integer DEFAULT 0, "status" text NOT NULL DEFAULT 'in_progress', "metrics" text,
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "training_courses" (
  "id" serial PRIMARY KEY, "title" text NOT NULL, "category" text NOT NULL, "provider" text NOT NULL, "duration_hours" integer NOT NULL DEFAULT 8,
  "description" text, "validity_months" integer DEFAULT 24, "is_mandatory" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_enrollments" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "course_id" integer NOT NULL REFERENCES "training_courses"("id"),
  "status" text NOT NULL DEFAULT 'enrolled', "enrolled_at" timestamp NOT NULL DEFAULT now(), "completed_at" timestamp, "score" numeric(5,2),
  "certificate_number" text, "certificate_url" text, "expiry_date" date, "notes" text, "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "training_enrollments_employee_course_uq" UNIQUE ("employee_id", "course_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "benefits" (
  "id" serial PRIMARY KEY, "name" text NOT NULL, "type" text NOT NULL, "description" text, "provider" text, "default_coverage" text,
  "taxable" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "benefit_enrollments" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "benefit_id" integer NOT NULL REFERENCES "benefits"("id"),
  "status" text NOT NULL DEFAULT 'active', "coverage_details" text, "beneficiary_name" text, "beneficiary_relationship" text, "effective_date" date NOT NULL,
  "expiry_date" date, "employee_contribution" numeric(10,2) DEFAULT '0', "employer_contribution" numeric(10,2) DEFAULT '0', "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "housing_schemes" (
  "id" serial PRIMARY KEY, "title" text NOT NULL, "scheme_type" text NOT NULL DEFAULT 'institutional_rental', "eligibility_criteria" text NOT NULL,
  "max_monthly_allowance" numeric(10,2), "description" text, "active" boolean NOT NULL DEFAULT true, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "housing_applications" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "scheme_id" integer NOT NULL REFERENCES "housing_schemes"("id"),
  "property_address" text NOT NULL, "landlord_name" text, "monthly_rent_requested" numeric(10,2) NOT NULL, "lease_period_months" integer DEFAULT 12,
  "status" text NOT NULL DEFAULT 'submitted', "reviewed_by_user_id" integer REFERENCES "users"("id"), "review_comments" text, "approved_amount" numeric(10,2),
  "approved_at" timestamp, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "employee_documents" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "category" text NOT NULL, "title" text NOT NULL,
  "file_url" text NOT NULL, "file_size" integer, "mime_type" text, "expiry_date" date, "uploaded_by_user_id" integer REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr_letter_requests" (
  "id" serial PRIMARY KEY, "employee_id" integer NOT NULL REFERENCES "employees"("id"), "letter_type" text NOT NULL, "addressee" text NOT NULL,
  "purpose" text NOT NULL, "status" text NOT NULL DEFAULT 'pending', "generated_letter_content" text, "generated_by_user_id" integer REFERENCES "users"("id"),
  "generated_at" timestamp, "rejection_reason" text, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "employee_documents_employee_idx" ON "employee_documents" ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_employee_status_idx" ON "leave_requests" ("employee_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_records_employee_date_idx" ON "attendance_records" ("employee_id", "date");
