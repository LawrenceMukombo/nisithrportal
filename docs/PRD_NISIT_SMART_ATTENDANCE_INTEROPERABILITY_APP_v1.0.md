# Product Requirement Document (PRD v1.0)
## PNG NISIT Smart Workforce Attendance & Master Staff Interoperability Ecosystem ("Lanframe Attendance")

**Document Version**: `v1.0`  
**Target Enterprise**: Papua New Guinea National Institute of Standards & Industrial Technology (NISIT)  
**Parent Ecosystem**: PNG NISIT Integrated HR Portal (`nisithrportal.lamtoninvestments.com`)  
**Commercial Framework**: Lanframe Modernizing Workforce Attendance Proposal (Total Investment: **K45,000**)  
**Statutory Alignment**: PNG Public Services (Management) Act, Public Service General Orders (GO 7, 8, 13), Department of Personnel Management (DPM) Compliance, ISO/IEC 17025 Accreditation Protocols  
**Data Policy**: **NO WIPE. NO OVERWRITE. UPSERT ONLY.** Immutable Audit Trails.  

---

## Executive Summary

The **NISIT Smart Workforce Attendance Application** is an enterprise-grade, multi-modal, cloud-synchronized attendance tracking and workforce intelligence ecosystem designed to eliminate manual paper timesheets, eliminate payroll reconciliation bottlenecks, and seamlessly interoperate with the **PNG NISIT Integrated HR Portal**.

Building upon the **Lanframe K45,000 Attendance Modernization Architecture**, this system bridges field officers (Standards Inspection, Legal Metrology, Trade Measurement across PNG provinces) and headquarters personnel (HQ Port Moresby, Metrology Testing Laboratories) into a unified, tamper-evident attendance ledger. 

Every clock-in event—whether captured via **GPS-Geofenced Mobile App**, **Dynamic QR Code Kiosk**, **Web Portal**, or **Biometric Hardware Terminals (ZKTeco Face/Fingerprint, Hikvision)**—undergoes real-time validation and **immediately synchronizes into the Master Staff Records (`employeesTable`)**. This guarantees automated synchronization across leave balances, payroll calculations, appraisal punctuality scores, and executive DPM compliance dashboards.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-MODAL CAPTURE CHANNELS                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Mobile App (GPS  │  │ Dynamic QR Code  │  │ Biometric Hardware│ │ Staff Web SPA  │  │
│  │ Geofenced & Liveness)│  │ Kiosk (Tablets)  │  │ (ZKTeco/Hikvision)│ │ Self-Service   │  │
│  └─────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘  └───────┬────────┘  │
└────────────┼────────────────────┼─────────────────────┼────────────────────┼───────────┘
             │                    │                     │                    │
             ▼                    ▼                     ▼                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                 LANFRAME ATTENDANCE INTEROPERABILITY INGESTION ENGINE                  │
│       • Device Signature Verification   • Anti-Spoofing & Geofence Validator           │
│       • Offline SQLite Sync Queue       • Idempotent Punch Ingestion (`punch_hash`)    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        NISIT HR PORTAL CORE BACKEND (REST / WS)                        │
│                     `/api/attendance` & `/api/clocking/punches`                        │
└───────┬───────────────────────────────────┬────────────────────────────────────┬───────┘
        │                                   │                                    │
        ▼                                   ▼                                    ▼
┌──────────────────┐             ┌─────────────────────┐             ┌───────────────────┐
│ MASTER STAFF     │             │ LEAVE MANAGEMENT    │             │ PAYROLL & DPM     │
│ RECORDS          │             │ RECONCILIATION      │             │ COMPLIANCE ENGINE │
│ • Active Status  │             │ • Auto-Leave Match  │             │ • Worked Hours    │
│ • Shift Times    │             │ • Unexcused Absence │             │ • Overtime Audit  │
│ • Punctuality KPI│             │ • Handover Lock     │             │ • Fortnight Ledger│
└──────────────────┘             └─────────────────────┘             └───────────────────┘
```

---

## 1. Problem Statement & Strategic Justification

### 1.1 The Challenge at PNG NISIT
As PNG’s statutory authority overseeing national standards, laboratory calibration, and trade metrology, NISIT operates across rigorous testing laboratories and nationwide inspection sites:
1. **Administrative Burden & Payroll Latency**: HR officers spend upwards of 18 hours per fortnight manually cross-referencing paper punch cards, handwritten field logs, and physical attendance sheets against salary records.
2. **Ghost Workers & Buddy Clocking**: Traditional manual logbooks lack cryptographic, biometric, or spatial proof-of-presence, exposing the organization to buddy-punching, fraudulent overtime claims, and unrecorded absenteeism.
3. **Disconnected Field Workforce**: Inspectors operating at Lae port, Kokopo, Mt. Hagen, and border points are unable to log attendance in real-time, resulting in retroactive timesheet estimations.
4. **Data Silos**: Standalone attendance clocks create isolated data silos that never feed back into master employee profiles, leave balances, performance appraisals, or statutory DPM reports.

### 1.2 The Lanframe Solution
A purpose-built, cloud-synchronized attendance app that **directly interoperates with the NISIT HR Portal**. It enforces zero-entry data synchronization: a single punch captured anywhere in PNG instantly updates the master employee record, tracks late minutes, calculates overtime, updates leave status, and feeds DPM-compliant fortnightly payroll exports.

---

## 2. Core Personas & User Journeys

| Persona | Primary Needs & Responsibilities | Interaction Channels |
|---|---|---|
| **Field Standards Inspector** | Needs offline-first GPS clock-in from remote provincial inspection points; quick duty logging without paper logs. | Mobile App (Android/iOS) with Offline Sync & GPS Geofencing. |
| **Laboratory Scientist / Office Staff** | Fast, frictionless, hygienic clock-in at NISIT HQ lobby and testing wings. | Biometric Turnstiles (Face/Fingerprint) & QR Tablet Kiosk. |
| **Section Supervisor / Division Head** | Real-time visibility of team presence; 1-click approvals for late exceptions, overtime, and field duty permits. | Portal Manager Dashboard & Mobile Supervisor View. |
| **HR Officer (Attendance & Payroll)** | Fortnightly attendance audit, automatic leave deduction reconciliation, automated DPM Public Service General Orders compliance reporting. | HR Portal Desktop Administration Suite. |
| **Director General & Council** | Real-time institutional punctuality index, multi-site staff coverage heatmaps, statutory workforce cost controls. | Executive KPI Analytics Dashboard. |

---

## 3. High-Value Functional Requirements

### 3.1 Multi-Modal Clock-In & Verification Engine

#### 3.1.1 GPS-Enabled Mobile Check-In with Dynamic Geofencing
- **Geofence Radius Engine**: Staff can clock in only within authorized geographic perimeters (e.g., NISIT HQ Port Moresby, Lae Standards Lab, Jacksons Airport Cargo Wing, authorized client inspection facilities).
- **Spatial PostGIS Verification**: Coordinates (`latitude`, `longitude`, `accuracy_meters`) are verified server-side against PostGIS polygon boundaries.
- **Mock Location & VPN Spoof Prevention**: App checks `isFromMockProvider` on Android and CoreLocation simulation flags on iOS. Bypasses or rooted/jailbroken devices are rejected with audit flag `tamper_detected`.
- **Selfie Liveness Verification (Optional / Field Staff)**: For remote field duties without physical supervisors, staff take a 1-second liveness photo verified against master employee profile photo using edge-based blink/facial feature extraction.

#### 3.1.2 Dynamic Rotating QR Code Kiosk (Office & Laboratory)
- **Time-Based Rolling QR Tokens**: Wall-mounted tablet kiosks display an encrypted QR code that rotates every 15 seconds (TOTP cryptographic algorithm).
- **Anti-Screenshot Screen Replay Protection**: Staff scan the kiosk QR code using their authenticated mobile app. Screenshots or shared photos cannot be used because each token expires in 15 seconds.
- **Kiosk Reverse Mode**: Allows staff to present their personal dynamic app QR code to the kiosk front camera for hands-free contactless check-in.

#### 3.1.3 Biometric Hardware Interoperability (ZKTeco & Hikvision)
- **Native REST / Push Protocol Gateway**: Native integration with enterprise turnstiles and biometric terminals (`ZKTeco SpeedFace-V5L`, `Hikvision DS-K1T671MF`) already provisioned in `clocking_devices`.
- **Hardware Heartbeat & Punch Buffer**: Terminals push raw punch logs via HTTPS webhooks. If internet connectivity drops, hardware terminals buffer up to 100,000 punches locally and burst-sync upon reconnection.
- **Device Key Authentication**: Every hardware terminal authenticates with a unique cryptographic `api_key` (e.g., `clk_live_zkteco_hq_main_entrance_secret_key_2026`).

#### 3.1.4 Web Self-Service Clocking (Intranet / Desktop)
- **IP-Whitelisted Corporate Subnet Clock-In**: Staff working from office desktop PCs can clock in via `nisithrportal.lamtoninvestments.com/attendance` if connected to NISIT LAN / IP ranges (`192.168.10.0/24`).

---

### 3.2 Master Staff Record Interoperability ("Zero Data Silo")

All attendance events must immediately write and synchronize into the NISIT HR Portal core tables. The following bidirectional updates are enforced:

#### 3.2.1 Real-Time Master Staff Profile Synchronization (`employeesTable`)
- **Master Status Indicator**: Whenever an employee clocks in, their live status on the Organization Chart (`/org-chart`), Employee Directory (`/employees`), and Manager Hub instantly updates to `present`, `in_field`, or `late`.
- **Last Active Timestamp & Geolocation**: Updates `last_seen_at` and `last_known_location` on the staff record.
- **Punctuality Rating Accumulator**: Monthly punctuality percentage is dynamically aggregated into `employees.punctuality_score` (Grade 1–20 appraisal metric).

#### 3.2.2 Automated Leave Reconciler (`leave_requests` & `public_holidays`)
- **Absence Auto-Matching**: If an employee fails to clock in by 10:00 AM without an approved leave request, the system flags the day as `unexplained_absence` and notifies the staff member and supervisor.
- **Approved Leave Handshake**: If an employee has an approved `annual`, `sick`, or `compassionate` leave request in `leave_requests`, attendance automatically records `on_leave (Approved)` with zero late penalties.
- **PNG Statutory Public Holiday Guard**: Synchronizes with `public_holidays` table (e.g., Independence Day, Remembrance Day, Easter). Automatic non-working day recognition eliminates false absenteeism alerts.

#### 3.2.3 Fortnightly Payroll & Worked Hours Calculator
- **Standard Working Hours**: Enforces PNG Public Service 7.34 hours/day (8:00 AM to 4:06 PM, or 8:00 AM to 4:30 PM with 1-hour lunch break).
- **Grace Period & Grace Lateness**: Configurable 15-minute grace window. Clocks between 8:01 AM and 8:15 AM marked `present (grace)`. Clocks after 8:15 AM calculate exact `late_minutes`.
- **Automated Overtime Pipeline**: Clock-outs after 4:30 PM (or weekend punches) generate pending overtime records requiring division head digital sign-off before feeding payroll exports.
- **DPM Fortnightly Summary Generator**: Exports audit-ready Excel and CSV timesheets formatted specifically for PNG Department of Finance / Alesco payroll integration.

#### 3.2.4 Performance Review & KPI Linkage (`performance_reviews`)
- Punctuality, total late minutes, and unexcused absences automatically populate Section B (Discipline & Work Ethic) of quarterly and annual NISIT performance appraisals.

---

### 3.3 Forward-Looking & Innovative AI Features

#### 3.3.1 AI Shift Rostering & Fatigue Risk Predictor
- Analyzes historical attendance, laboratory calibration schedules, and public holiday sequences to recommend optimal laboratory duty rosters.
- Flags staff exceeding 12 consecutive working days or 50+ hours in calibration bays to prevent cognitive fatigue and maintain ISO/IEC 17025 precision standards.

#### 3.3.2 Anomaly & Ghost-Worker Detection Engine
- **Impossible Travel Detector**: Flags punches where an employee clocks in at Port Moresby at 8:00 AM and in Lae at 9:00 AM.
- **Pattern Deviation Alert**: Detects anomalies such as identical daily clock-in timestamps down to the second (indicative of automated punch scripts or collusion).
- **Device Binding Protocol**: Mobile app is tied to the physical device hardware UUID. Changing devices requires an HR reset code to prevent credential sharing.

#### 3.3.3 Smart WhatsApp & Email Notifications
- Integrates with NISIT HR Portal notification service:
  - **Staff Reminder**: Push notification at 7:45 AM if staff is within 500m of office but hasn't clocked in.
  - **Supervisor Digest**: Daily 9:00 AM WhatsApp/email summary of absent, on-leave, and late team members.
  - **Emergency Roll Call**: 1-click fire drill / disaster evacuation muster list generated instantly from live "currently in building" attendance data.

---

## 4. Technical Architecture & Database Schema

### 4.1 System Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT / EDGE APPLICATIONS                      │
│                                                                        │
│   [ React Native / PWA Mobile ]        [ ZKTeco / Hikvision Hardware ] │
│      - SQLite Offline Punch Cache         - REST Push Protocol         │
│      - Background Geolocation             - Standalone TCP/IP Buffer   │
│      - Hardware Biometric Prompt          - Wiegand Turnstile Control  │
└───────────────────┬────────────────────────────────────┬───────────────┘
                    │ HTTPS / TLS 1.3                    │ HTTPS Webhook
                    ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 NISIT API SERVER INGESTION GATEWAY (8080)              │
│                                                                        │
│   • HMAC-SHA256 Request Signature Validation                           │
│   • Rate Limiting: 60 req/min per device API Key                       │
│   • Tenant Agency Isolation (`agency_id = 1`)                          │
│   • Deduplication Buffer (Idempotency Key: `punch_hash`)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             POSTGRESQL 16+ DATABASE WITH POSTGIS EXTENSION             │
│                                                                        │
│   • clocking_devices              • attendance_records (Master)        │
│   • clocking_raw_punches          • geofence_zones                     │
│   • attendance_daily_summaries    • employees (Master Staff Records)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 REAL-TIME EVENT BUS & NOTIFICATION WORKER              │
│                                                                        │
│   • WebSocket Live Presence Board (`/api/attendance/live-stream`)      │
│   • Audit Trail Logger (`audit_logs`)                                  │
│   • Background Leave Reconciliation Job (Runs daily at 10:00 AM)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Comprehensive Database Schema Extensions

To be executed under the **strict additive / UPSERT policy** (no dropping or renaming columns):

```sql
-- 1. Geofenced Authorized Zones (PostGIS or Coordinate Radius)
CREATE TABLE IF NOT EXISTS geofence_zones (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 150,
  address TEXT,
  province TEXT NOT NULL DEFAULT 'National Capital District',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Master Shift & Working Hours Policy Table
CREATE TABLE IF NOT EXISTS work_schedules (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., 'NISIT Standard Public Service (8:00 - 16:06)'
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '16:06:00',
  grace_period_minutes INTEGER NOT NULL DEFAULT 15,
  half_day_late_threshold_minutes INTEGER NOT NULL DEFAULT 120,
  lunch_duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enhance employees master table with attendance linkage
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_schedule_id INTEGER REFERENCES work_schedules(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS default_geofence_id INTEGER REFERENCES geofence_zones(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS live_attendance_status TEXT NOT NULL DEFAULT 'out_of_office';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_clock_in_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_clock_out_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS punctuality_score NUMERIC(5, 2) DEFAULT 100.00;

-- 4. Extend attendance_records with enterprise audit, geofence, and biometric verification
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS geofence_zone_id INTEGER REFERENCES geofence_zones(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_latitude NUMERIC(10, 7);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_longitude NUMERIC(10, 7);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_accuracy NUMERIC(8, 2);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_latitude NUMERIC(10, 7);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_longitude NUMERIC(10, 7);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_accuracy NUMERIC(8, 2);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'web'; -- 'mobile_gps', 'qr_kiosk', 'biometric_face', 'biometric_fingerprint', 'web'
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS self_photo_url TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_hash TEXT UNIQUE; -- SHA256 (emp_id + date + clock_in) for tamper proofing
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_status TEXT NOT NULL DEFAULT 'none'; -- 'none', 'pending_approval', 'approved', 'rejected'
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS supervisor_approved_by INTEGER REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS supervisor_approved_at TIMESTAMPTZ;

-- 5. Daily Attendance Roll-Up Cache for Instant Reporting
CREATE TABLE IF NOT EXISTS attendance_daily_summaries (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  total_headcount INTEGER NOT NULL DEFAULT 0,
  total_present INTEGER NOT NULL DEFAULT 0,
  total_late INTEGER NOT NULL DEFAULT 0,
  total_on_leave INTEGER NOT NULL DEFAULT 0,
  total_absent INTEGER NOT NULL DEFAULT 0,
  total_field_duty INTEGER NOT NULL DEFAULT 0,
  total_overtime_hours NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  average_punctuality_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agency_date_summary UNIQUE (agency_id, date)
);

-- Indexes for lightning-fast queries across 100,000+ attendance records
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date ON attendance_records (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records (status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records (date);
CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON geofence_zones (is_active);
```

---

## 5. REST & Webhook Interoperability API Specifications

All endpoints run on `https://nisithrportal.lamtoninvestments.com/api` and require JWT or cryptographic device tokens.

### 5.1 Device Ingestion Webhook (Biometric & Kiosk)
- **Endpoint**: `POST /api/clocking/punches`
- **Authentication**: `x-device-api-key: clk_live_zkteco_hq_main_entrance_secret_key_2026`
- **Request Body**:
```json
{
  "deviceIdentifier": "ZK-HQ-001",
  "punches": [
    {
      "employeeIdentifier": "NISIT-EMP-004",
      "punchTime": "2026-10-08T07:54:12+10:00",
      "punchType": "in",
      "verificationMode": "facial_recognition",
      "temperature": 36.5,
      "maskDetected": false,
      "rawPayload": "{\"confidence\": 0.98, \"terminal_id\": \"TERM-01\"}"
    }
  ]
}
```
- **Response**: `201 Created`
```json
{
  "success": true,
  "processedCount": 1,
  "duplicatesIgnored": 0,
  "updatedStaffRecord": {
    "employeeId": 4,
    "employeeName": "Margaret Tolo",
    "status": "present",
    "lateMinutes": 0,
    "attendanceRecordId": 1420
  }
}
```

---

### 5.2 Mobile App Clock-In Endpoint
- **Endpoint**: `POST /api/attendance/mobile-punch`
- **Authentication**: `Authorization: Bearer <JWT>`
- **Request Body**:
```json
{
  "punchType": "in",
  "latitude": -9.431284,
  "longitude": 147.185293,
  "accuracyMeters": 8.5,
  "verificationMethod": "mobile_gps",
  "photoBase64": "data:image/jpeg;base64,...",
  "notes": "Arrived at Jacksons Cargo Inspection Bay"
}
```
- **Response**: `200 OK`
```json
{
  "success": true,
  "attendanceId": 1421,
  "matchedGeofence": "Jacksons Airport Standards Inspection Zone",
  "distanceFromCenterMeters": 42.1,
  "status": "present",
  "clockInTime": "2026-10-08T08:02:15+10:00",
  "masterStaffUpdated": true
}
```

---

### 5.3 Dynamic Rotating QR Kiosk Authentication
- **Endpoint**: `GET /api/clocking/kiosk/token?kioskId=NISIT-HQ-TABLET-01`
- **Response**: `200 OK`
```json
{
  "qrPayload": "nisit_kiosk_qr_v1_d87a9f24b58e72c019a:1791448800",
  "expiresInSeconds": 15
}
```

---

## 6. Implementation Roadmap & Commercial Milestones (Aligned with K45,000 Budget)

Per Page 6 and 7 of the Lanframe proposal:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               3-PHASE IMPLEMENTATION PLAN                              │
│                                                                                        │
│   PHASE 1 (Weeks 1 - 3): Requirements Analysis, Core Engineering & Config (K20,000)     │
│   • Database schema extensions and master staff interoperability connectors.           │
│   • Mobile GPS geofencing & dynamic QR code kiosk web app.                             │
│   • Biometric ingestion API for ZKTeco and Hikvision turnstiles.                       │
│                                                                                        │
│   PHASE 2 (Weeks 4 - 5): Data Migration, Infrastructure & Pilot Testing (K15,000)      │
│   • Hosting configuration, TLS hardening, and PostGIS geofence mapping.                │
│   • Hardware terminal enrollment & employee number RFID/Face mapping (K10,000 Infra).   │
│   • Pilot group execution (HQ Port Moresby + Standards Laboratory - 25 users).         │
│                                                                                        │
│   PHASE 3 (Weeks 6 - 8): Full Rollout, Training, DPM Compliance & Sign-Off (K10,000)   │
│   • Staff & Supervisor workshops, user manuals, and video walk-throughs (K10,000).     │
│   • Executive DPM payroll timesheet export integration.                                │
│   • Final Acceptance Testing & Production Go-Live. (K5,000 Contingency/QA buffer).     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Phase | Milestone Description | Deliverables | Cost Allocation |
|---|---|---|---|
| **Phase 1** | **Software Development & HR Portal Interoperability** | Multi-channel clocking API, mobile app interface, master staff records real-time hook, automated leave cross-checker. | **K20,000** |
| **Phase 2** | **Infrastructure, Cloud Setup & Pilot Testing** | Hostinger VPS optimization, PostGIS geofence coordinates setup, biometric terminal webhook gateway, 2-week live pilot test. | **K10,000** |
| **Phase 3** | **Training, Documentation & Staff Implementation** | Onsite HR and staff training, User Manuals, Administrator SOP, DPM Alesco export templates, Go-Live. | **K10,000** |
| **Buffer** | **Contingency & Final Quality Assurance** | Penetration testing, mock location security audit, edge load tests. | **K5,000** |
| **TOTAL** | **Full Turnkey Solution Delivery** | **Complete Smart Attendance Ecosystem** | **K45,000** |

---

## 7. Security, Privacy & Statutory Compliance

1. **Anti-Buddy Punching Guarantee**: Triple-lock verification: Physical biometric token (finger/face) OR GPS coordinates within 150m verified radius + device UUID binding + dynamic rolling QR code.
2. **Data Sovereignty & Security**:
   - TLS 1.3 encryption in transit for all punches and photo submissions.
   - Database level hashing: Each punch generates a SHA-256 digital signature (`punch_hash`) preventing retroactive database manipulation.
3. **PNG DPM General Orders Compliance**:
   - Enforces statutory rules regarding absenteeism, medical certificate presentation after 2 consecutive days, and overtime authorization tiers.
4. **Audit Trail Immutability**:
   - Any manual adjustments made by HR Officers require a mandatory statutory reason code and are permanently logged in `audit_logs` with the officer's User ID, timestamp, and previous values.

---

## 8. Definition of Success & Measurable KPIs

1. **Zero Timesheet Reconciliation Latency**: Fortnightly attendance-to-payroll closing time reduced from **18 hours to under 15 minutes** (1-click export).
2. **100% Punctuality Transparency**: Real-time visibility of staff presence across all NISIT operational divisions and laboratories.
3. **Zero Ghost Punching**: Elimination of unverified off-site clock-ins through PostGIS geofencing and device signature matching.
4. **Master Staff Synchronization Accuracy**: 100% of clock-in and clock-out events immediately update `employees` status, leave balances, and appraisal punctuality scores without manual imports.

---
*Authored by: Lanframe Digital Solutions & NISIT Technical Team*  
*Approved for: PNG National Institute of Standards & Industrial Technology (NISIT)*
