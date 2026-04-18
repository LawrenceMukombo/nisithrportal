import { pgTable, serial, text, jsonb, timestamp, date, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  cvUrl: text("cv_url"),
  parsedData: jsonb("parsed_data"),
  // Extended personal fields
  otherNames: text("other_names"),
  gender: text("gender"),
  dateOfBirth: date("date_of_birth"),
  nationality: text("nationality"),
  nationalId: text("national_id"),
  maritalStatus: text("marital_status"),
  // Contact extensions
  alternativePhone: text("alternative_phone"),
  physicalAddress: text("physical_address"),
  city: text("city"),
  province: text("province"),
  district: text("district"),
  postalAddress: text("postal_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;

// Education entries
export const candidateEducationTable = pgTable("candidate_education", {
  id: serial("id").primaryKey(),
  candidateId: serial("candidate_id").notNull().references(() => candidatesTable.id, { onDelete: "cascade" }),
  institution: text("institution").notNull(),
  level: text("level"),
  qualification: text("qualification"),
  fieldOfStudy: text("field_of_study"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  current: boolean("current").default(false),
  certifications: text("certifications"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CandidateEducation = typeof candidateEducationTable.$inferSelect;

// Work experience entries
export const candidateExperienceTable = pgTable("candidate_experience", {
  id: serial("id").primaryKey(),
  candidateId: serial("candidate_id").notNull().references(() => candidatesTable.id, { onDelete: "cascade" }),
  employer: text("employer").notNull(),
  jobTitle: text("job_title"),
  responsibilities: text("responsibilities"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  current: boolean("current").default(false),
  reasonForLeaving: text("reason_for_leaving"),
  keyAchievements: text("key_achievements"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CandidateExperience = typeof candidateExperienceTable.$inferSelect;

// Languages spoken
export const candidateLanguagesTable = pgTable("candidate_languages", {
  id: serial("id").primaryKey(),
  candidateId: serial("candidate_id").notNull().references(() => candidatesTable.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  proficiency: text("proficiency"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CandidateLanguage = typeof candidateLanguagesTable.$inferSelect;

// Diversity & Inclusion (voluntary, aggregate-only reporting)
export const candidateDiversityTable = pgTable("candidate_diversity", {
  id: serial("id").primaryKey(),
  candidateId: serial("candidate_id").notNull().references(() => candidatesTable.id, { onDelete: "cascade" }),
  disabilityStatus: text("disability_status"),
  genderIdentity: text("gender_identity"),
  ethnicity: text("ethnicity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CandidateDiversity = typeof candidateDiversityTable.$inferSelect;

// Skills (normalised — one row per skill per candidate)
export const candidateSkillsTable = pgTable("candidate_skills", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidatesTable.id, { onDelete: "cascade" }),
  skill: text("skill").notNull(),
  skillType: text("skill_type").notNull().default("technical"), // "technical" | "soft" | "other"
  applicationId: integer("application_id"), // optional, linked to application when populated via wizard
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CandidateSkill = typeof candidateSkillsTable.$inferSelect;
