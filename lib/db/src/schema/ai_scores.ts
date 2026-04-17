import { pgTable, serial, integer, numeric, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { candidatesTable } from "./candidates";
import { jobsTable } from "./jobs";

export const aiScoresTable = pgTable("ai_scores", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidatesTable.id),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  score: numeric("score", { precision: 5, scale: 2 }),
  recommendation: text("recommendation"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiScoreSchema = createInsertSchema(aiScoresTable).omit({ id: true, createdAt: true });
export type InsertAiScore = z.infer<typeof insertAiScoreSchema>;
export type AiScore = typeof aiScoresTable.$inferSelect;
