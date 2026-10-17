import { pgTable, serial, integer, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { agenciesTable } from "./agencies";

export const temporalTransactionSnapshotsTable = pgTable("temporal_transaction_snapshots", {
  id: serial("id").primaryKey(),
  transactionNumber: text("transaction_number").unique().notNull(),
  entityType: text("entity_type").notNull(), // "employee", "salary_profile", "contract", "position", "department", "payroll_item", "leave_balance", "organization"
  entityId: integer("entity_id").notNull(),
  entityReference: text("entity_reference"),
  entityName: text("entity_name").notNull(),
  eventType: text("event_type").notNull(), // "initial_hire", "salary_increment", "promotion", "allowance_configured", "contract_renewed", "department_transferred", "payroll_disbursed", "leave_allocated", "status_changed"
  eventTitle: text("event_title").notNull(),
  changeSummary: text("change_summary").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull().default("System Authority"),
  actorRole: text("actor_role").default("hr_officer"),
  agencyId: integer("agency_id").references(() => agenciesTable.id, { onDelete: "set null" }),
  previousState: jsonb("previous_state"),
  snapshotState: jsonb("snapshot_state").notNull(),
  diff: jsonb("diff").default({}),
  metadata: jsonb("metadata").default({}),
  checksum: text("checksum"),
  isLocked: boolean("is_locked").notNull().default(true),
});

export const insertTemporalSnapshotSchema = createInsertSchema(temporalTransactionSnapshotsTable).omit({ id: true, recordedAt: true });
export type InsertTemporalSnapshot = z.infer<typeof insertTemporalSnapshotSchema>;
export type TemporalTransactionSnapshot = typeof temporalTransactionSnapshotsTable.$inferSelect;
