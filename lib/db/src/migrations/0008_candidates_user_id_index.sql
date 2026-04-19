-- T138: Index on candidates.user_id to keep "My Applications" lookups fast at scale
CREATE INDEX IF NOT EXISTS "candidates_user_id_idx" ON "candidates" ("user_id");
