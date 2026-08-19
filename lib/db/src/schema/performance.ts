import { pgTable, serial, integer, text, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const performanceCyclesTable = pgTable("performance_cycles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("annual"), // annual, mid_year, probation, quarterly
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("active"), // draft, active, in_review, closed
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const performanceReviewsTable = pgTable("performance_reviews", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").references(() => performanceCyclesTable.id).notNull(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => usersTable.id),
  status: text("status").notNull().default("self_review"), // self_review, manager_review, hr_review, completed
  selfScore: numeric("self_score", { precision: 3, scale: 1 }), // 1.0 - 5.0
  managerScore: numeric("manager_score", { precision: 3, scale: 1 }),
  finalRating: text("final_rating"), // Outstanding, Exceeds Expectations, Meets Expectations, Needs Improvement, Unsatisfactory
  selfFeedback: text("self_feedback"),
  managerFeedback: text("manager_feedback"),
  strengths: text("strengths"),
  developmentAreas: text("development_areas"),
  goalsSummary: text("goals_summary"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  cycleId: integer("cycle_id").references(() => performanceCyclesTable.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("okr"), // okr, kpi, professional_development, operational
  targetDate: date("target_date"),
  weightage: integer("weightage").default(20), // % weightage
  progressPercentage: integer("progress_percentage").default(0), // 0 - 100
  status: text("status").notNull().default("in_progress"), // not_started, in_progress, achieved, deferred
  metrics: text("metrics"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
