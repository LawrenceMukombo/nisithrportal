import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { agenciesTable } from "./agencies";

export const chatConversationsTable = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  agencyId: integer("agency_id").notNull().references(() => agenciesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("direct"), // 'direct' | 'group'
  title: text("title"), // Name for group conversations (e.g. "Metrology Team")
  avatar: text("avatar"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow(),
  lastMessagePreview: text("last_message_preview"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatParticipantsTable = pgTable("chat_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'admin' | 'member'
  lastReadAt: timestamp("last_read_at", { withTimezone: true }).defaultNow(),
  muted: boolean("muted").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  messageType: text("message_type").notNull().default("text"), // 'text' | 'image' | 'document' | 'voice' | 'system'
  content: text("content").notNull().default(""),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  attachmentSize: integer("attachment_size"),
  replyToId: integer("reply_to_id"),
  deletedForEveryone: boolean("deleted_for_everyone").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatConversation = typeof chatConversationsTable.$inferSelect;
export type ChatParticipant = typeof chatParticipantsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
