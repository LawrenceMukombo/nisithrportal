ALTER TABLE "hr_letter_requests"
ADD COLUMN IF NOT EXISTS "signatory_user_id" integer REFERENCES "users"("id"),
ADD COLUMN IF NOT EXISTS "signatory_name" text,
ADD COLUMN IF NOT EXISTS "signatory_title" text,
ADD COLUMN IF NOT EXISTS "signed_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "signature_data_url" text,
ADD COLUMN IF NOT EXISTS "verification_ref" text,
ADD COLUMN IF NOT EXISTS "is_stamped" boolean DEFAULT false;
