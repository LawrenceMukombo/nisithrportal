CREATE TABLE IF NOT EXISTS "wiki_articles" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "summary" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT 'General',
  "content" text NOT NULL DEFAULT '',
  "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "published" boolean NOT NULL DEFAULT false,
  "created_by_user_id" integer REFERENCES "users"("id"),
  "updated_by_user_id" integer REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
