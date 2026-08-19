import { pgTable, serial, integer, text, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const employeeDocumentsTable = pgTable("employee_documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  category: text("category").notNull(), // contract, identification, qualification, certificate, performance, disciplinary, medical, housing, general
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  expiryDate: date("expiry_date"),
  retentionUntil: date("retention_until"),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const employeeDocumentVersionsTable = pgTable("employee_document_versions", {
  id: serial("id").primaryKey(), documentId: integer("document_id").notNull().references(() => employeeDocumentsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), fileUrl: text("file_url").notNull(), fileSize: integer("file_size"), mimeType: text("mime_type"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id), createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hrLetterRequestsTable = pgTable("hr_letter_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  letterType: text("letter_type").notNull(), // employment_verification, salary_confirmation, service_certificate, appointment_letter, visa_support, bank_letter
  addressee: text("addressee").notNull(), // e.g. "To Whom It May Concern", "Bank South Pacific", "Department of Immigration"
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("pending"), // pending, ready_to_sign, signed_and_stamped, rejected
  generatedLetterContent: text("generated_letter_content"),
  generatedByUserId: integer("generated_by_user_id").references(() => usersTable.id),
  generatedAt: timestamp("generated_at"),
  signatoryUserId: integer("signatory_user_id").references(() => usersTable.id),
  signatoryName: text("signatory_name"),
  signatoryTitle: text("signatory_title"),
  signedAt: timestamp("signed_at"),
  signatureDataUrl: text("signature_data_url"),
  verificationRef: text("verification_ref"),
  isStamped: boolean("is_stamped").default(false),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
