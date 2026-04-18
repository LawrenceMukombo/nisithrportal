import { pgTable, serial, integer, text, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { applicationsTable } from "./applications";

export const jobScreeningQuestionsTable = pgTable("job_screening_questions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  questionType: text("question_type").notNull().default("short_answer"),
  options: jsonb("options"),
  required: boolean("required").notNull().default(true),
  isMandatoryFilter: boolean("is_mandatory_filter").notNull().default(false),
  autoReject: boolean("auto_reject").notNull().default(false),
  autoRejectValue: text("auto_reject_value"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type JobScreeningQuestion = typeof jobScreeningQuestionsTable.$inferSelect;

export const applicationScreeningAnswersTable = pgTable("application_screening_answers", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => jobScreeningQuestionsTable.id, { onDelete: "cascade" }),
  answer: text("answer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ApplicationScreeningAnswer = typeof applicationScreeningAnswersTable.$inferSelect;
