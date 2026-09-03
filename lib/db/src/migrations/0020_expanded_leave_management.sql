ALTER TABLE "leave_requests"
ADD COLUMN IF NOT EXISTS "handover_employee_id" integer REFERENCES "employees"("id"),
ADD COLUMN IF NOT EXISTS "leave_period_type" text NOT NULL DEFAULT 'full_day',
ADD COLUMN IF NOT EXISTS "emergency_contact" text,
ADD COLUMN IF NOT EXISTS "medical_certificate_number" text;

CREATE TABLE IF NOT EXISTS "public_holidays" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "date" date NOT NULL,
  "year" integer NOT NULL DEFAULT 2026,
  "is_recurring" boolean NOT NULL DEFAULT false,
  "agency_id" integer,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "leave_balance_adjustments" (
  "id" serial PRIMARY KEY NOT NULL,
  "employee_id" integer NOT NULL REFERENCES "employees"("id"),
  "leave_type_id" integer NOT NULL REFERENCES "leave_types"("id"),
  "year" integer NOT NULL DEFAULT 2026,
  "adjustment_days" numeric(5, 1) NOT NULL,
  "adjustment_type" text NOT NULL DEFAULT 'accrual',
  "reason" text NOT NULL,
  "authorized_by_user_id" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);
