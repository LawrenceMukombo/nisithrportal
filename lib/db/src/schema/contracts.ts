import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  type: text("type").notNull().default("fixed_term"),
  status: text("status").notNull().default("active"),
  documentUrl: text("document_url"),
  salary: text("salary"),
  duties: text("duties"),
  specialConditions: text("special_conditions"),
  probationPeriod: text("probation_period"),
  noticePeriod: text("notice_period"),
  workingHours: text("working_hours"),
  customClauses: text("custom_clauses"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
