import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { agenciesTable } from "./agencies";

export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  performedById: integer("performed_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  performedByEmail: text("performed_by_email"),
  targetUserId: integer("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetEmail: text("target_email"),
  actionType: text("action_type").notNull(),
  outcome: text("outcome").notNull(),
  details: jsonb("details"),
  agencyId: integer("agency_id").references(() => agenciesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
