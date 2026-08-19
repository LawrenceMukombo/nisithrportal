ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "retention_until" date;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" integer REFERENCES "users"("id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_document_versions" (
  "id" serial PRIMARY KEY, "document_id" integer NOT NULL REFERENCES "employee_documents"("id") ON DELETE CASCADE,
  "version" integer NOT NULL, "file_url" text NOT NULL, "file_size" integer, "mime_type" text,
  "uploaded_by_user_id" integer REFERENCES "users"("id"), "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "employee_document_versions_document_version_uq" UNIQUE ("document_id", "version")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_documents_retention_idx" ON "employee_documents" ("retention_until") WHERE "deleted_at" IS NULL;
