-- Migration: 0023_attendance_and_payroll_indexes.sql
-- Additive unique index and performance query indexes for Attendance, Clocking, and Payroll

ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "overtime_approved_by" integer REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "overtime_approved_at" timestamptz;

-- Composite unique index to prevent duplicate punch records for same employee on same date
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_attendance_employee_date" ON "attendance_records" ("employee_id", "date");

-- Performance lookup indexes
CREATE INDEX IF NOT EXISTS "idx_attendance_records_date" ON "attendance_records" ("date");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_employee_id" ON "attendance_records" ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_status" ON "attendance_records" ("status");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_overtime_status" ON "attendance_records" ("overtime_status");

-- Payroll and leave query optimization indexes
CREATE INDEX IF NOT EXISTS "idx_payroll_items_period_emp" ON "payroll_items" ("period_id", "employee_id");
CREATE INDEX IF NOT EXISTS "idx_payroll_items_employee_id" ON "payroll_items" ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_leave_requests_employee_status" ON "leave_requests" ("employee_id", "status");

