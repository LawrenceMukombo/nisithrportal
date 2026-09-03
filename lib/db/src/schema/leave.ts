import { pgTable, serial, text, integer, timestamp, date, boolean, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const leaveTypesTable = pgTable("leave_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // ANNUAL, SICK, MATERNITY, PATERNITY, COMPASSIONATE, UNPAID, STUDY
  defaultDays: integer("default_days").notNull().default(15),
  carryOverMax: integer("carry_over_max").notNull().default(5),
  isPaid: boolean("is_paid").notNull().default(true),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leaveBalancesTable = pgTable("leave_balances", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  leaveTypeId: integer("leave_type_id").references(() => leaveTypesTable.id).notNull(),
  year: integer("year").notNull().default(2026),
  allocatedDays: numeric("allocated_days", { precision: 5, scale: 1 }).notNull().default("15"),
  usedDays: numeric("used_days", { precision: 5, scale: 1 }).notNull().default("0"),
  pendingDays: numeric("pending_days", { precision: 5, scale: 1 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  leaveTypeId: integer("leave_type_id").references(() => leaveTypesTable.id).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: numeric("days", { precision: 5, scale: 1 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, cancelled
  approverId: integer("approver_id").references(() => usersTable.id),
  approverComment: text("approver_comment"),
  approvedAt: timestamp("approved_at"),
  attachmentUrl: text("attachment_url"),
  handoverEmployeeId: integer("handover_employee_id").references(() => employeesTable.id),
  leavePeriodType: text("leave_period_type").notNull().default("full_day"), // full_day, half_day_am, half_day_pm
  emergencyContact: text("emergency_contact"),
  medicalCertificateNumber: text("medical_certificate_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const publicHolidaysTable = pgTable("public_holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  year: integer("year").notNull().default(2026),
  isRecurring: boolean("is_recurring").notNull().default(false),
  agencyId: integer("agency_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveBalanceAdjustmentsTable = pgTable("leave_balance_adjustments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  leaveTypeId: integer("leave_type_id").references(() => leaveTypesTable.id).notNull(),
  year: integer("year").notNull().default(2026),
  adjustmentDays: numeric("adjustment_days", { precision: 5, scale: 1 }).notNull(),
  adjustmentType: text("adjustment_type").notNull().default("accrual"), // accrual, carry_over, correction, credit, debit
  reason: text("reason").notNull(),
  authorizedByUserId: integer("authorized_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
