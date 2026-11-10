import { pgTable, serial, integer, text, timestamp, date, boolean, numeric, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { agenciesTable } from "./agencies";
import { usersTable } from "./users";

export const payrollPeriodsTable = pgTable("payroll_periods", {
  id: serial("id").primaryKey(),
  agencyId: integer("agency_id").references(() => agenciesTable.id, { onDelete: "cascade" }).notNull(),
  periodCode: text("period_code").notNull().unique(), // e.g., "2026-FN01", "2026-FN14"
  name: text("name").notNull(), // e.g. "Fortnight 14 (July 2026)"
  cycleType: text("cycle_type").notNull().default("fortnightly"), // fortnightly, monthly, off_cycle
  year: integer("year").notNull().default(2026),
  periodNumber: integer("period_number").notNull().default(1), // 1 to 26
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  payDate: date("pay_date").notNull(),
  status: text("status").notNull().default("draft"), // draft, calculating, pending_review, approved, disbursed, locked
  totalGross: numeric("total_gross", { precision: 14, scale: 2 }).notNull().default("0"),
  totalTaxable: numeric("total_taxable", { precision: 14, scale: 2 }).notNull().default("0"),
  totalIrcTax: numeric("total_irc_tax", { precision: 14, scale: 2 }).notNull().default("0"),
  totalSuperEmployee: numeric("total_super_employee", { precision: 14, scale: 2 }).notNull().default("0"),
  totalSuperEmployer: numeric("total_super_employer", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAllowances: numeric("total_allowances", { precision: 14, scale: 2 }).notNull().default("0"),
  totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
  totalNet: numeric("total_net", { precision: 14, scale: 2 }).notNull().default("0"),
  employeeCount: integer("employee_count").notNull().default(0),
  currency: text("currency").notNull().default("PGK"),
  approvedByUserId: integer("approved_by_user_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const employeeSalaryProfilesTable = pgTable("employee_salary_profiles", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id, { onDelete: "cascade" }).notNull().unique(),
  gradeLevel: text("grade_level").notNull().default("Grade 10"), // e.g. Grade 10, Grade 12, Grade 14, Grade 18
  annualBaseSalary: numeric("annual_base_salary", { precision: 12, scale: 2 }).notNull().default("45000.00"),
  fortnightlyBaseSalary: numeric("fortnightly_base_salary", { precision: 12, scale: 2 }).notNull().default("1730.77"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("21.63"),
  payCycle: text("pay_cycle").notNull().default("fortnightly"), // fortnightly, monthly
  paymentMethod: text("payment_method").notNull().default("bank_transfer"), // bank_transfer, cheque, cash
  bankName: text("bank_name").notNull().default("BSP Financial Group"), // BSP Financial Group, Kina Bank, Westpac PNG, ANZ PNG
  bankBranch: text("bank_branch").default("Port Moresby Commercial Branch"),
  bankAccountNumber: text("bank_account_number").default("1002938471"),
  bankAccountName: text("bank_account_name"),
  tin: text("tin").default("500123987"), // PNG Internal Revenue Commission Tax Identification Number
  taxCode: text("tax_code").notNull().default("primary"), // primary, secondary, non_resident
  superFund: text("super_fund").notNull().default("Nasfund"), // Nasfund, Nambawan Super, Aon Master Trust
  superMemberNumber: text("super_member_number").default("NF-98214"),
  superannuationType: text("superannuation_type").notNull().default("percentage"), // percentage, fixed
  superannuationFixedAmount: numeric("superannuation_fixed_amount", { precision: 10, scale: 2 }).default("0.00"),
  superVoluntaryRate: numeric("super_voluntary_rate", { precision: 5, scale: 2 }).default("0.00"), // voluntary % addition over 6%
  housingAllowance: numeric("housing_allowance", { precision: 10, scale: 2 }).default("350.00"), // fortnightly cash allowance
  housingAllowanceType: text("housing_allowance_type").notNull().default("fixed"), // fixed, percentage
  housingAllowanceRate: numeric("housing_allowance_rate", { precision: 6, scale: 2 }).default("0.00"), // % of fortnightly base if percentage
  utilityAllowance: numeric("utility_allowance", { precision: 10, scale: 2 }).default("120.00"),
  utilityAllowanceType: text("utility_allowance_type").notNull().default("fixed"),
  utilityAllowanceRate: numeric("utility_allowance_rate", { precision: 6, scale: 2 }).default("0.00"),
  transportAllowance: numeric("transport_allowance", { precision: 10, scale: 2 }).default("150.00"),
  transportAllowanceType: text("transport_allowance_type").notNull().default("fixed"),
  transportAllowanceRate: numeric("transport_allowance_rate", { precision: 6, scale: 2 }).default("0.00"),
  representationAllowance: numeric("representation_allowance", { precision: 10, scale: 2 }).default("0.00"),
  representationAllowanceType: text("representation_allowance_type").notNull().default("fixed"),
  representationAllowanceRate: numeric("representation_allowance_rate", { precision: 6, scale: 2 }).default("0.00"),
  otherAllowances: numeric("other_allowances", { precision: 10, scale: 2 }).default("0.00"),
  otherAllowancesType: text("other_allowances_type").notNull().default("fixed"),
  otherAllowancesRate: numeric("other_allowances_rate", { precision: 6, scale: 2 }).default("0.00"),
  unionDues: numeric("union_dues", { precision: 10, scale: 2 }).default("15.00"), // Public Employees Association (PEA) dues
  insuranceDeduction: numeric("insurance_deduction", { precision: 10, scale: 2 }).default("25.00"),
  privateEmail: text("private_email"), // Staff registered personal/private email for confidential payslip delivery
  payslipPasswordPin: text("payslip_password_pin"), // Custom secret PIN or passphrase for PDF encryption
  payslipPasswordType: text("payslip_password_type").notNull().default("dob_or_pin"), // dob_or_pin, dob_ddmmyyyy, pin, tin
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_salary_profiles_employee_id").on(table.employeeId),
]);

export const payrollItemsTable = pgTable("payroll_items", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").references(() => payrollPeriodsTable.id, { onDelete: "cascade" }).notNull(),
  employeeId: integer("employee_id").references(() => employeesTable.id, { onDelete: "cascade" }).notNull(),
  payslipNumber: text("payslip_number").notNull().unique(), // e.g. "NISIT-PS-2026-FN14-0021"
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).notNull(),
  regularHoursWorked: numeric("regular_hours_worked", { precision: 6, scale: 2 }).notNull().default("80.00"),
  overtimeHours15: numeric("overtime_hours_15", { precision: 6, scale: 2 }).notNull().default("0.00"),
  overtimeHours20: numeric("overtime_hours_20", { precision: 6, scale: 2 }).notNull().default("0.00"),
  overtimePay: numeric("overtime_pay", { precision: 10, scale: 2 }).notNull().default("0.00"),
  allowancesBreakdown: jsonb("allowances_breakdown").notNull().default({}),
  totalAllowances: numeric("total_allowances", { precision: 10, scale: 2 }).notNull().default("0.00"),
  grossPay: numeric("gross_pay", { precision: 12, scale: 2 }).notNull(),
  taxableIncome: numeric("taxable_income", { precision: 12, scale: 2 }).notNull(),
  ircTax: numeric("irc_tax", { precision: 12, scale: 2 }).notNull().default("0.00"), // PNG Salary & Wages Tax (SWT)
  superannuationEmployee: numeric("superannuation_employee", { precision: 10, scale: 2 }).notNull().default("0.00"), // 6% + voluntary
  superannuationEmployer: numeric("superannuation_employer", { precision: 10, scale: 2 }).notNull().default("0.00"), // 8.4%
  deductionsBreakdown: jsonb("deductions_breakdown").notNull().default({}),
  totalDeductions: numeric("total_deductions", { precision: 10, scale: 2 }).notNull().default("0.00"),
  netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PGK"),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, cleared, failed
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  attendanceDaysPresent: integer("attendance_days_present").default(10),
  leaveDaysTaken: numeric("leave_days_taken", { precision: 4, scale: 1 }).default("0.0"),
  unpaidLeaveDays: numeric("unpaid_leave_days", { precision: 4, scale: 1 }).default("0.0"),
  unpaidLeaveDeduction: numeric("unpaid_leave_deduction", { precision: 10, scale: 2 }).default("0.00"),
  emailDeliveryStatus: text("email_delivery_status").notNull().default("not_sent"), // not_sent, sent, failed
  emailSentTo: text("email_sent_to"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  emailDeliveryError: text("email_delivery_error"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_payroll_items_period_emp").on(table.periodId, table.employeeId),
  index("idx_payroll_items_employee_id").on(table.employeeId),
]);

export const payrollAdjustmentsTable = pgTable("payroll_adjustments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id, { onDelete: "cascade" }).notNull(),
  periodId: integer("period_id").references(() => payrollPeriodsTable.id, { onDelete: "set null" }),
  type: text("type").notNull().default("allowance"), // allowance, deduction, reimbursement, advance_recovery, acting_arrears
  category: text("category").notNull(), // "Special Project Honorarium", "Overtime Arrears", "Acting Allowance", "Staff Advance Repayment", etc.
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  taxable: boolean("taxable").notNull().default(true),
  description: text("description").notNull(),
  status: text("status").notNull().default("approved"), // pending, approved, applied, rejected
  requestedByUserId: integer("requested_by_user_id").references(() => usersTable.id),
  approvedByUserId: integer("approved_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payrollAuditLogsTable = pgTable("payroll_audit_logs", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").references(() => payrollPeriodsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // generated, recalculated, adjustment_added, approved, disbursed, exported_aba, exported_irc, exported_super
  performedByUserId: integer("performed_by_user_id").references(() => usersTable.id),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPayrollPeriodSchema = createInsertSchema(payrollPeriodsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayrollPeriod = z.infer<typeof insertPayrollPeriodSchema>;
export type PayrollPeriod = typeof payrollPeriodsTable.$inferSelect;

export const insertEmployeeSalaryProfileSchema = createInsertSchema(employeeSalaryProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployeeSalaryProfile = z.infer<typeof insertEmployeeSalaryProfileSchema>;
export type EmployeeSalaryProfile = typeof employeeSalaryProfilesTable.$inferSelect;

export const insertPayrollItemSchema = createInsertSchema(payrollItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayrollItem = z.infer<typeof insertPayrollItemSchema>;
export type PayrollItem = typeof payrollItemsTable.$inferSelect;

export const insertPayrollAdjustmentSchema = createInsertSchema(payrollAdjustmentsTable).omit({ id: true, createdAt: true });
export type InsertPayrollAdjustment = z.infer<typeof insertPayrollAdjustmentSchema>;
export type PayrollAdjustment = typeof payrollAdjustmentsTable.$inferSelect;

export const insertPayrollAuditLogSchema = createInsertSchema(payrollAuditLogsTable).omit({ id: true, createdAt: true });
export type InsertPayrollAuditLog = z.infer<typeof insertPayrollAuditLogSchema>;
export type PayrollAuditLog = typeof payrollAuditLogsTable.$inferSelect;
