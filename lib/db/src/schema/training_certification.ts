import { pgTable, serial, integer, text, timestamp, date, boolean, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const trainingCoursesTable = pgTable("training_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(), // technical_standards, metrology, quality_assurance, leadership, compliance, it_security
  provider: text("provider").notNull(), // internal, ISO, PNG_UNITECH, NARI, external
  durationHours: integer("duration_hours").notNull().default(8),
  description: text("description"),
  validityMonths: integer("validity_months").default(24), // 2 years default certification
  isMandatory: boolean("is_mandatory").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trainingEnrollmentsTable = pgTable("training_enrollments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  courseId: integer("course_id").references(() => trainingCoursesTable.id).notNull(),
  status: text("status").notNull().default("enrolled"), // enrolled, in_progress, completed, expired
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  score: numeric("score", { precision: 5, scale: 2 }),
  certificateNumber: text("certificate_number"),
  certificateUrl: text("certificate_url"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
