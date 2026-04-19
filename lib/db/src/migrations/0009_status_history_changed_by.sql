-- T173: Track which user moved a candidate at each pipeline stage
ALTER TABLE "application_status_history"
  ADD COLUMN IF NOT EXISTS "changed_by" integer REFERENCES "users"("id");
