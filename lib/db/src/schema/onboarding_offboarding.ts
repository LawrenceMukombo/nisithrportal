import { pgTable, serial, integer, text, timestamp, date, boolean, jsonb } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { candidatesTable } from "./candidates";
import { usersTable } from "./users";

export const onboardingTemplatesTable = pgTable("onboarding_templates", {
  id: serial("id").primaryKey(), name: text("name").notNull(), active: boolean("active").notNull().default(true),
  departmentId: integer("department_id"), employmentType: text("employment_type"), location: text("location"),
  version: integer("version").notNull().default(1), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const onboardingTemplateTasksTable = pgTable("onboarding_template_tasks", {
  id: serial("id").primaryKey(), templateId: integer("template_id").notNull().references(() => onboardingTemplatesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(), description: text("description"), category: text("category").notNull().default("general"), assignedRole: text("assigned_role").notNull().default("hr_officer"),
  mandatory: boolean("mandatory").notNull().default(true), dueDays: integer("due_days"), orderIndex: integer("order_index").notNull().default(0), createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const onboardingWorkflowsTable = pgTable("onboarding_workflows", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  candidateId: integer("candidate_id").references(() => candidatesTable.id),
  templateId: integer("template_id").references(() => onboardingTemplatesTable.id),
  status: text("status").notNull().default("in_progress"), // in_progress, completed, paused
  startDate: date("start_date").notNull(),
  targetCompletionDate: date("target_completion_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const onboardingTasksTable = pgTable("onboarding_tasks", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => onboardingWorkflowsTable.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // hr, it, manager, employee, facility
  assignedRole: text("assigned_role").notNull().default("hr_officer"), // hr_officer, it_admin, hiring_manager, employee
  mandatory: boolean("mandatory").notNull().default(true),
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, waived
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  completedByUserId: integer("completed_by_user_id").references(() => usersTable.id),
  notes: text("notes"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const offboardingWorkflowsTable = pgTable("offboarding_workflows", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  reason: text("reason").notNull(), // resignation, retirement, termination, contract_expiry, other
  separationDate: date("separation_date").notNull(),
  status: text("status").notNull().default("in_progress"), // in_progress, completed
  exitInterviewDone: boolean("exit_interview_done").default(false),
  exitInterviewNotes: text("exit_interview_notes"),
  handoverCompleted: boolean("handover_completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const offboardingTasksTable = pgTable("offboarding_tasks", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => offboardingWorkflowsTable.id).notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(), // asset_return, it_revocation, finance_clearance, hr_documentation
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id),
  status: text("status").notNull().default("pending"), // pending, completed, waived
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
