import { pgTable, serial, text, integer, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";

export const positionsTable = pgTable("positions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  positionCode: text("position_code"),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  gradeLevel: text("grade_level").notNull().default("Grade 10"),
  parentPositionId: integer("parent_position_id").references((): AnyPgColumn => positionsTable.id),
  reportsToTitle: text("reports_to_title"),
  status: text("status").notNull().default("active"),
  jobDescription: text("job_description"),
  filledCount: integer("filled_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPositionSchema = createInsertSchema(positionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positionsTable.$inferSelect;

