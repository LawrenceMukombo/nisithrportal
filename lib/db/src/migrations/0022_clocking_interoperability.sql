-- Migration: 0022_clocking_interoperability.sql
-- Interoperability tables for biometric and hardware clocking-in systems

CREATE TABLE IF NOT EXISTS "clocking_devices" (
  "id" serial PRIMARY KEY,
  "agency_id" integer NOT NULL REFERENCES "agencies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "device_model" text DEFAULT 'Generic REST Biometric',
  "serial_number" text,
  "ip_address" text,
  "location" text NOT NULL DEFAULT 'NISIT HQ Port Moresby',
  "api_key" text UNIQUE NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "last_heartbeat_at" timestamptz,
  "total_punches_recorded" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clocking_raw_punches" (
  "id" serial PRIMARY KEY,
  "device_id" integer REFERENCES "clocking_devices"("id") ON DELETE SET NULL,
  "device_identifier" text,
  "employee_identifier" text NOT NULL,
  "matched_employee_id" integer REFERENCES "employees"("id") ON DELETE SET NULL,
  "punch_time" timestamptz NOT NULL,
  "punch_type" text NOT NULL DEFAULT 'auto',
  "verification_mode" text NOT NULL DEFAULT 'biometric',
  "location" text,
  "raw_payload" text,
  "status" text NOT NULL DEFAULT 'processed',
  "processed_attendance_record_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Add additive foreign keys and source columns to attendance_records
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "device_id" integer REFERENCES "clocking_devices"("id") ON DELETE SET NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "raw_punch_in_id" integer REFERENCES "clocking_raw_punches"("id") ON DELETE SET NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "raw_punch_out_id" integer REFERENCES "clocking_raw_punches"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_clocking_raw_punches_employee_id" ON "clocking_raw_punches" ("matched_employee_id");
CREATE INDEX IF NOT EXISTS "idx_clocking_raw_punches_punch_time" ON "clocking_raw_punches" ("punch_time");
CREATE INDEX IF NOT EXISTS "idx_clocking_devices_api_key" ON "clocking_devices" ("api_key");
