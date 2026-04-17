import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";
import { positionsTable } from "./positions";
import { agenciesTable } from "./agencies";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  positionId: integer("position_id").references(() => positionsTable.id),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  agencyId: integer("agency_id").notNull().references(() => agenciesTable.id, { onDelete: "cascade" }),
  // contractId is an app-managed soft reference to the employee's current active contract.
  // It is NOT a DB foreign key: contracts.ts already imports employeesTable, so adding a
  // reverse FK here would create a circular import. The authoritative source of truth for
  // all contracts is the contracts table (contracts.employeeId → employees.id). This field
  // is a convenience denormalization updated by the API when a contract is activated/closed.
  contractId: integer("contract_id"),
  status: text("status").notNull().default("active"),
  startDate: text("start_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
