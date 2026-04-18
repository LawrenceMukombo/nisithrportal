-- T71: Link candidates to user accounts by adding a nullable user_id foreign key
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
