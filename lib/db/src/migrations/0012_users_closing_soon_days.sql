-- T183: per-user closing-soon notification window
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "closing_soon_days" integer NOT NULL DEFAULT 7;
