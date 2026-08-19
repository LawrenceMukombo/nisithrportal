import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const wikiArticlesTable = pgTable("wiki_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary").notNull().default(""),
  category: text("category").notNull().default("General"),
  content: text("content").notNull().default(""),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; type?: "file" | "image" }>>().notNull().default([]),
  published: boolean("published").notNull().default(false),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
