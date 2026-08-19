import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agenciesTable } from "./agencies";
import { rolesTable } from "./roles";
import { employeesTable } from "./employees";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: integer("role_id").references(() => rolesTable.id),
  agencyId: integer("agency_id").references(() => agenciesTable.id),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  status: text("status").notNull().default("active"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastPasswordChangeAt: timestamp("last_password_change_at", { withTimezone: true }),
  emailSavedJobClosing: boolean("email_saved_job_closing").notNull().default(true),
  closingSoonDays: integer("closing_soon_days").notNull().default(7),
  emailStaleApplications: boolean("email_stale_applications").notNull().default(true),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
