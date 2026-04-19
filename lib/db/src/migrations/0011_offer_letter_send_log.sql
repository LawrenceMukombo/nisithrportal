-- T175: Audit log of every offer-letter send event for an application
CREATE TABLE IF NOT EXISTS "offer_letter_send_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "application_id" integer NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "recipient_email" text NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "offer_letter_send_log_application_idx" ON "offer_letter_send_log" ("application_id");
