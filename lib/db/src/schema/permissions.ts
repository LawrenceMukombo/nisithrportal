import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { rolesTable } from "./roles";

/** A named capability, e.g. `documents.read` or `employees.update`. */
export const permissionsTable = pgTable("permissions", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("permissions_resource_action_uq").on(table.resource, table.action)]);

/**
 * Normalised role grants. Scope is deliberately stored with the grant so a
 * permission can be constrained to an employee's own record, department, or
 * the organisation without duplicating roles.
 */
export const rolePermissionsTable = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissionsTable.id, { onDelete: "cascade" }),
  scope: text("scope").notNull().default("organisation"), // own, department, organisation
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("role_permissions_role_permission_uq").on(table.roleId, table.permissionId)]);
