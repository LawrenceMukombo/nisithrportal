import { pgTable, serial, integer, text, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { agenciesTable } from "./agencies";

export const clockingDevicesTable = pgTable("clocking_devices", {
  id: serial("id").primaryKey(),
  agencyId: integer("agency_id").references(() => agenciesTable.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  deviceModel: text("device_model").default("Generic REST Biometric"), // ZKTeco SpeedFace, Hikvision DS-K1T, Anviz, RFID Terminal
  serialNumber: text("serial_number"),
  ipAddress: text("ip_address"),
  location: text("location").notNull().default("NISIT HQ Port Moresby"),
  apiKey: text("api_key").unique().notNull(), // Unique token passed in X-Device-Key
  status: text("status").notNull().default("active"), // active, offline, maintenance, archived
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  totalPunchesRecorded: integer("total_punches_recorded").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clockingRawPunchesTable = pgTable("clocking_raw_punches", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => clockingDevicesTable.id, { onDelete: "set null" }),
  deviceIdentifier: text("device_identifier"), // Serial or name sent by terminal
  employeeIdentifier: text("employee_identifier").notNull(), // Badge number, PIN, employee number
  matchedEmployeeId: integer("matched_employee_id").references(() => employeesTable.id, { onDelete: "set null" }),
  punchTime: timestamp("punch_time", { withTimezone: true }).notNull(),
  punchType: text("punch_type").notNull().default("auto"), // in, out, auto
  verificationMode: text("verification_mode").notNull().default("biometric"), // fingerprint, face, rfid_card, pin, mobile_gps, manual_upload
  location: text("location"),
  rawPayload: text("raw_payload"),
  status: text("status").notNull().default("processed"), // processed, unmatched, duplicate, ignored
  processedAttendanceRecordId: integer("processed_attendance_record_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceRecordsTable = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  status: text("status").notNull().default("present"), // present, late, absent, half_day, on_leave, excused
  lateMinutes: integer("late_minutes").default(0),
  earlyDepartureMinutes: integer("early_departure_minutes").default(0),
  location: text("location").default("NISIT HQ Port Moresby"),
  source: text("source").default("web"), // web, biometric_terminal, rfid_card, csv_import, manual
  deviceId: integer("device_id").references(() => clockingDevicesTable.id, { onDelete: "set null" }),
  rawPunchInId: integer("raw_punch_in_id").references(() => clockingRawPunchesTable.id, { onDelete: "set null" }),
  rawPunchOutId: integer("raw_punch_out_id").references(() => clockingRawPunchesTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClockingDeviceSchema = createInsertSchema(clockingDevicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClockingDevice = z.infer<typeof insertClockingDeviceSchema>;
export type ClockingDevice = typeof clockingDevicesTable.$inferSelect;

export const insertClockingRawPunchSchema = createInsertSchema(clockingRawPunchesTable).omit({ id: true, createdAt: true });
export type InsertClockingRawPunch = z.infer<typeof insertClockingRawPunchSchema>;
export type ClockingRawPunch = typeof clockingRawPunchesTable.$inferSelect;

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;

