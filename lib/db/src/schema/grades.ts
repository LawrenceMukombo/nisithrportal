import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gradesTable = pgTable("grades", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "G10", "G12", "G18", "G20"
  name: text("name").notNull(), // e.g. "Grade 10 - Technical Officer", "Grade 18 - Director / Executive"
  level: integer("level").notNull().default(10),
  minimumSalary: numeric("minimum_salary", { precision: 12, scale: 2 }),
  maximumSalary: numeric("maximum_salary", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGradeSchema = createInsertSchema(gradesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type Grade = typeof gradesTable.$inferSelect;
