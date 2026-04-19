-- T115: Track when an offer letter was last sent for an application
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "offer_letter_sent_at" timestamp with time zone;
