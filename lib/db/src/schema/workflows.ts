import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { agenciesTable } from "./agencies";
import { usersTable } from "./users";

export const workflowDefinitionsTable = pgTable("workflow_definitions", {
  id: serial("id").primaryKey(), agencyId: integer("agency_id").references(() => agenciesTable.id),
  entityType: text("entity_type").notNull(), name: text("name").notNull(), active: boolean("active").notNull().default(true),
  steps: jsonb("steps").notNull().default([]), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const approvalInstancesTable = pgTable("approval_instances", {
  id: serial("id").primaryKey(), definitionId: integer("definition_id").references(() => workflowDefinitionsTable.id), agencyId: integer("agency_id").references(() => agenciesTable.id),
  entityType: text("entity_type").notNull(), entityId: integer("entity_id").notNull(), requesterId: integer("requester_id").references(() => usersTable.id),
  status: text("status").notNull().default("pending"), currentStep: integer("current_step").notNull().default(1), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), completedAt: timestamp("completed_at", { withTimezone: true }),
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id), delegatedToUserId: integer("delegated_to_user_id").references(() => usersTable.id), dueAt: timestamp("due_at", { withTimezone: true }), escalatedAt: timestamp("escalated_at", { withTimezone: true }),
});
export const approvalActionsTable = pgTable("approval_actions", {
  id: serial("id").primaryKey(), instanceId: integer("instance_id").notNull().references(() => approvalInstancesTable.id, { onDelete: "cascade" }),
  step: integer("step").notNull(), action: text("action").notNull(), actorId: integer("actor_id").references(() => usersTable.id), comment: text("comment"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
