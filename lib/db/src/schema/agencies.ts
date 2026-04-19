import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agenciesTable = pgTable("agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("government"),
  configuration: jsonb("configuration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgencySchema = createInsertSchema(agenciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type Agency = typeof agenciesTable.$inferSelect;

// Shape of agency.configuration (jsonb). All keys are optional.
// - staleThresholds: per-status day counts before an application is "stale".
// - allowedBulkTransitions: explicit list of permitted (from -> to) status changes
//   for the bulk-status endpoint. When omitted, server defaults are used. Lets
//   agencies prevent accidental skips like applied -> offer in bulk operations.
export const bulkTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
export type BulkTransition = z.infer<typeof bulkTransitionSchema>;

export const agencyConfigurationSchema = z.object({
  staleThresholds: z.record(z.string(), z.number().int().min(1).max(365)).optional(),
  allowedBulkTransitions: z.array(bulkTransitionSchema).optional(),
});
export type AgencyConfiguration = z.infer<typeof agencyConfigurationSchema>;
