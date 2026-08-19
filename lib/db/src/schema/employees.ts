import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";
import { positionsTable } from "./positions";
import { agenciesTable } from "./agencies";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeNumber: text("employee_number").unique(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  middleName: text("middle_name"),
  email: text("email"),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"), // Male, Female, Other
  maritalStatus: text("marital_status"), // Single, Married, Divorced, Widowed
  nationalId: text("national_id"),
  passportNumber: text("passport_number"),
  photoUrl: text("photo_url"),
  residentialAddress: text("residential_address"),
  postalAddress: text("postal_address"),
  city: text("city"),
  province: text("province"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelationship: text("emergency_contact_relationship"),
  emergencyContactAddress: text("emergency_contact_address"),
  positionId: integer("position_id").references(() => positionsTable.id),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  agencyId: integer("agency_id").notNull().references(() => agenciesTable.id, { onDelete: "cascade" }),
  supervisorId: integer("supervisor_id").references((): any => employeesTable.id),
  gradeLevel: text("grade_level"), // e.g., Grade 10, Grade 12, Grade 14
  division: text("division"),
  unit: text("unit"),
  employmentType: text("employment_type").default("permanent"), // permanent, fixed_term, temporary, consultant, intern
  contractId: integer("contract_id"),
  status: text("status").notNull().default("active"), // active, probation, on_leave, suspended, retired, resigned, terminated, deceased
  startDate: date("start_date"),
  probationStartDate: date("probation_start_date"),
  probationEndDate: date("probation_end_date"),
  confirmationDate: date("confirmation_date"),
  separationDate: date("separation_date"),
  separationReason: text("separation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const employeePositionHistoryTable = pgTable("employee_position_history", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  positionId: integer("position_id").references(() => positionsTable.id),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  gradeLevel: text("grade_level"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  changeType: text("change_type").notNull().default("appointment"), // appointment, promotion, transfer, acting, separation
  notes: text("notes"),
  changedByUserId: integer("changed_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
export type EmployeePositionHistory = typeof employeePositionHistoryTable.$inferSelect;

