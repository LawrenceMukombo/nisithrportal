import { pgTable, serial, text, integer, timestamp, date, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";
import { agenciesTable } from "./agencies";
import { usersTable } from "./users";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  agencyId: integer("agency_id").notNull().references(() => agenciesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"),
  closingDate: date("closing_date"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),

  referenceNumber: text("reference_number"),
  location: text("location"),
  employmentType: text("employment_type"),
  workArrangement: text("work_arrangement"),
  jobSummary: text("job_summary"),
  responsibilities: jsonb("responsibilities").$type<string[]>(),
  reportingLine: text("reporting_line"),
  minEducation: text("min_education"),
  yearsExperience: integer("years_experience"),
  technicalSkills: jsonb("technical_skills").$type<string[]>(),
  softSkills: jsonb("soft_skills").$type<string[]>(),
  certifications: jsonb("certifications").$type<string[]>(),
  languageRequirements: text("language_requirements"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency"),
  salaryVisibility: text("salary_visibility"),
  gradeBand: text("grade_band"),
  contractDuration: text("contract_duration"),
  openingDate: date("opening_date"),
  requiredDocuments: jsonb("required_documents").$type<string[]>(),
  maxApplicants: integer("max_applicants"),
  isFeatured: boolean("is_featured"),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
