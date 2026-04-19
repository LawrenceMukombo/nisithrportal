import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { agenciesTable } from "./agencies";

export const integrationConfigsTable = pgTable("integration_configs", {
  id: serial("id").primaryKey(),
  agencyId: integer("agency_id").references(() => agenciesTable.id, { onDelete: "cascade" }),
  integrationType: text("integration_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  endpointUrl: text("endpoint_url"),
  method: text("method").notNull().default("POST"),
  apiKeyRef: text("api_key_ref"),
  authType: text("auth_type").notNull().default("bearer"),
  authHeaderName: text("auth_header_name"),
  headers: jsonb("headers").default({}),
  fieldMappings: jsonb("field_mappings").default({}),
  responseMapping: jsonb("response_mapping").default({}),
  enabled: boolean("enabled").notNull().default(true),
  alertThreshold: integer("alert_threshold").notNull().default(50),
  degradedThreshold: integer("degraded_threshold").notNull().default(80),
  lastAlertedHealth: text("last_alerted_health"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const integrationLogsTable = pgTable("integration_logs", {
  id: serial("id").primaryKey(),
  integrationConfigId: integer("integration_config_id").references(() => integrationConfigsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  triggeredBy: text("triggered_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IntegrationConfig = typeof integrationConfigsTable.$inferSelect;
export type NewIntegrationConfig = typeof integrationConfigsTable.$inferInsert;
export type IntegrationLog = typeof integrationLogsTable.$inferSelect;
