import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { candidatesTable } from "./candidates";
import { jobsTable } from "./jobs";

export const savedJobsTable = pgTable("saved_jobs", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id").notNull().references(() => candidatesTable.id, { onDelete: "cascade" }),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("saved_jobs_applicant_job_unique").on(t.applicantId, t.jobId),
]);

export type SavedJob = typeof savedJobsTable.$inferSelect;
