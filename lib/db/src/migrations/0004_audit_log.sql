-- T54: Audit log for user management actions and domain enforcement violations
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "performed_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "performed_by_email" text,
  "target_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "target_email" text,
  "action_type" text NOT NULL,
  "outcome" text NOT NULL,
  "details" jsonb,
  "agency_id" integer REFERENCES "agencies"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
