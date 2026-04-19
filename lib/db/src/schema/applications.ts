import { pgTable, serial, integer, text, numeric, timestamp, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { candidatesTable } from "./candidates";
import { usersTable } from "./users";

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  candidateId: integer("candidate_id").notNull().references(() => candidatesTable.id),
  status: text("status").notNull().default("applied"),
  score: numeric("score", { precision: 5, scale: 2 }),
  notes: text("notes"),
  coverLetter: text("cover_letter"),
  // Position & availability
  preferredLocation: text("preferred_location"),
  availability: text("availability"),
  relocate: boolean("relocate"),
  workType: text("work_type"),
  // Compensation
  expectedSalary: text("expected_salary"),
  currentSalary: text("current_salary"),
  noticePeriod: text("notice_period"),
  // Personal statement
  personalStatement: text("personal_statement"),
  // Skills (stored as JSON arrays for simplicity)
  technicalSkills: jsonb("technical_skills"),
  softSkills: jsonb("soft_skills"),
  computerLiteracy: text("computer_literacy"),
  certificationsLicenses: text("certifications_licenses"),
  // Declarations (all required on final submit)
  declarationAgreed: boolean("declaration_agreed"),
  backgroundCheckConsent: boolean("background_check_consent"),
  conflictOfInterest: boolean("conflict_of_interest"),
  criminalRecord: boolean("criminal_record"),
  dataPrivacyConsent: boolean("data_privacy_consent"),
  // Offer letter tracking
  offerLetterSentAt: timestamp("offer_letter_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // Database-level guard: prevent multiple non-withdrawn applications by the same candidate
  // for the same job. Withdrawn rows are excluded so an applicant may reapply after withdrawing.
  candidateJobActiveUnique: uniqueIndex("applications_candidate_job_active_unique")
    .on(t.candidateId, t.jobId)
    .where(sql`${t.status} <> 'withdrawn'`),
}));

export const applicationStatusHistoryTable = pgTable("application_status_history", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  status: text("status").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
  changedBy: integer("changed_by").references(() => usersTable.id),
});

// Document uploads per application
export const applicationDocumentsTable = pgTable("application_documents", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  url: text("url").notNull(),
  fileName: text("file_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ApplicationDocument = typeof applicationDocumentsTable.$inferSelect;

// Draft applications (save & resume)
export const applicationDraftTable = pgTable("application_draft", {
  id: serial("id").primaryKey(),
  candidateEmail: text("candidate_email").notNull(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  draftData: jsonb("draft_data").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ApplicationDraft = typeof applicationDraftTable.$inferSelect;

// Candidate referees (linked to an application)
export const candidateRefereesTable = pgTable("candidate_referees", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relationship: text("relationship"),
  organisation: text("organisation"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CandidateReferee = typeof candidateRefereesTable.$inferSelect;

// Audit trail of every offer-letter send event for an application
export const offerLetterSendLogTable = pgTable("offer_letter_send_log", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => applicationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  recipientEmail: text("recipient_email").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  applicationIdx: index("offer_letter_send_log_application_idx").on(t.applicationId),
}));
export type OfferLetterSendLog = typeof offerLetterSendLogTable.$inferSelect;

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
export type ApplicationStatusHistory = typeof applicationStatusHistoryTable.$inferSelect;
