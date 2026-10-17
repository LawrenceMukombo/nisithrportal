# Enterprise Workforce Management & Human Resource Portal
## Technical Architecture, Database Schemas & Systems Engineering Manual (Version 1.0)

---

> ### Technical Governance & Document Metadata
> **Document Identifier:** `EHRM-TECH-v1.0-GENERIC`  
> **Classification:** Technical Architecture & Engineering Specification (Engineering & Sysadmin Confidential)  
> **Target Audience:** Systems Architects, Software Engineers, DevOps / Sysadmins, Database Administrators, Security Auditors, Integration Partners  
> **Release Target:** Version 1.0 Production Architecture  
> **Subsystem Topology:** Core REST API Gateway (`:8080`), Primary HR Web Management Application (`:5173`), Smart Attendance & Mobile Kiosk Application (`:5174`), PostgreSQL Database Engine with Drizzle ORM

---

## 1. Executive Architectural Overview & Microservice Topology

The **Enterprise Workforce Management & Human Resource Portal** is architected as a modular, high-throughput enterprise application suite designed for high availability, zero-trust cryptographic security, and multi-tenant public sector or corporate deployment.

### 1.1 Microservice Deployment Architecture

```
+----------------------------------------------------------------------------------------------------+
|                                      EDGE & REVERSE PROXY LAYER                                    |
|                              Nginx / Cloud Load Balancer (Port 80 / 443 TLS)                       |
|                 - SSL/TLS Termination (TLS 1.3)          - Rate Limiting (100 req/min/IP)          |
|                 - Strict CORS & Security Headers         - Static Asset Caching                    |
+---------------------------------+----------------------------------+-------------------------------+
                                  |                                  |
                                  v                                  v
+---------------------------------------------------+  +---------------------------------------------+
|              PRIMARY HR WEB PORTAL                |  |        SMART ATTENDANCE & KIOSK PWA         |
|              (Port 5173 / /hr-portal)             |  |        (Port 5174 / /attendance-app)        |
|  - Framework: React 19 + TypeScript + Vite        |  |  - Framework: React 19 + TypeScript + Vite  |
|  - UI: Tailwind CSS + Radix UI Primitives         |  |  - Spatial Sensor: HTML5 Geolocation API    |
|  - State: TanStack Query + React Context          |  |  - Lobby Kiosk: 15s Rolling TOTP Generator  |
|  - Routing: Wouter Client-side Router             |  |  - Service Worker: Offline Punch Cache      |
+---------------------------------------------------+  +---------------------------------------------+
                                  |                                  |
                                  +-----------------+----------------+
                                                    | JSON REST / HTTPS
                                                    v
+----------------------------------------------------------------------------------------------------+
|                                    CORE REST API GATEWAY & ENGINE                                  |
|                                       (Node.js + Express / Port 8080)                              |
|  - Controller Layer: 36 Modular Route Handlers (`/api/*`)                                          |
|  - Security Middleware: JWT HMAC-SHA256 + tokenVersion Invalidation + Role RBAC Validation        |
|  - Rate Limiting & Lockout: 5 Failed Login Attempts -> 30-Minute Lockout Ledger                    |
|  - Document Processing: Headless PDF Generation + Cryptographic Watermarking & Verification Seals  |
|  - Hardware Ingestion Gateway: Inbound Biometric Turnstile API (`X-Device-Key` Authenticated)      |
|  - Webhook Dispatcher: Asynchronous Outbound Webhook Worker with HMAC Signature Verification       |
+----------------------------------------------------------------------------------------------------+
                                                    |
                                                    | Drizzle ORM / Parameterized SQL
                                                    v
+----------------------------------------------------------------------------------------------------+
|                                     PERSISTENCE & STORAGE TIER                                     |
|                                  PostgreSQL 15+ Enterprise Instance                                |
|  - 30 Relational Schemas: Employees, Jobs, ATS, Contracts, Attendance, Leaves, Audit, Settings     |
|  - Spatial Capabilities: Coordinates, Haversine Perimeter Distance Calculations                   |
|  - Document Vault: Encrypted Local Storage & Scalable S3-Compatible Object Store                  |
|  - Structured Logging: Pino JSON Logger with Transactional Security Audit Ledger                  |
+----------------------------------------------------------------------------------------------------+
```

### 1.2 Port Allocation & Network Topology

| Service Component | Internal Port | External Route | Protocols | Runtime Environment |
| :--- | :---: | :--- | :--- | :--- |
| **API Server Gateway** | `8080` | `/api/*` | HTTP/REST, JSON | Node.js 20+ LTS (Express) |
| **Primary HR Portal** | `5173` | `/` | HTTP/HTTPS (SPA) | Vite Dev / Nginx Static Serve |
| **Attendance & Kiosk App**| `5174` | `/kiosk`, `/punch` | HTTP/HTTPS (PWA) | Vite Dev / Nginx Static Serve |
| **PostgreSQL Database** | `5432` | Localhost / Private VPC | TCP (PostgreSQL Wire) | PostgreSQL 15+ |

---

## 2. Technology Stack & Dependencies Specification

### 2.1 Backend Core Stack (`artifacts/api-server`)
- **Runtime:** Node.js 20+ LTS
- **Language:** TypeScript 5.3+ (Compiled via ESBuild / TSX)
- **HTTP Server:** Express.js 4.19+ with JSON body parser & multipart form processing (Multer)
- **Database ORM:** Drizzle ORM 0.30+ (`drizzle-orm/node-postgres` with `pg` driver)
- **Authentication & Security:** 
  - `jsonwebtoken` (JWT bearer tokens, HMAC-SHA256 signature)
  - `bcryptjs` (Password hashing with 10 salt rounds)
  - `cors` (Configurable multi-origin whitelist)
- **Logging & Diagnostics:** `pino` 8+ and `pino-pretty` (Structured JSON log format)
- **PDF & Document Engine:** HTML template renderer with embedded SVG cryptographic security seals

### 2.2 Frontend Client Stack (`artifacts/hr-portal` & `artifacts/attendance-app`)
- **Core Library:** React 19 with TypeScript
- **Bundler & Build Tool:** Vite 7+
- **Styling & Design System:** 
  - Tailwind CSS 3.4+ with custom HSL token architecture
  - Radix UI accessible headless UI primitives
  - Lucide React icon library
- **Client Routing:** `wouter` lightweight client-side routing
- **Data Fetching & Cache:** TanStack Query (`@tanstack/react-query`) with automatic background refetching and mutation rollbacks
- **Form Management:** React Hook Form (`react-hook-form`) with Zod schema validation
- **Data Visualizations:** Recharts (SVG-based responsive time-series and categorical charts)

---

## 3. Relational Database Architecture & Schemas

The database layer is managed via Drizzle ORM and consists of 30 normalized relational tables in PostgreSQL.

### 3.1 Entity Relationship Overview

```
[ agencies ] 1---N [ departments ] 1---N [ positions ]
                            |                   |
                            +---------+---------+
                                      |
                                      v
                                [ employees ]
                                 |  |  |  |
         +-----------------------+  |  |  +------------------------+
         |                          |  |                           |
         v                          v  v                           v
  [ contracts ]               [ attendance ]                [ leave_requests ]
  [ benefits ]                [ clocking_events ]           [ leave_balances ]
  [ housing_tenants ]         [ attendance_kiosks ]         [ holidays ]
         |
         +---------------------------------------------------------+
         |                                                         |
         v                                                         v
  [ performance_appraisals ]                                [ audit_logs ]
  [ training_nominations ]                                  [ hr_documents ]
  [ employee_clearances ]                                   [ messages ]
```

### 3.2 Core Table Specifications

#### 1. `users` Table
Manages system authentication, RBAC authorization, and account security counters.
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee', -- admin, hr_officer, hiring_manager, executive, employee, applicant
    employee_id INTEGER REFERENCES employees(id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE,
    token_version INTEGER NOT NULL DEFAULT 1,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### 2. `employees` Table
The single source of truth for organizational human capital.
```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_number VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    gender VARCHAR(20),
    date_of_birth DATE,
    department_id INTEGER REFERENCES departments(id),
    position_id INTEGER REFERENCES positions(id),
    grade_id INTEGER REFERENCES grades(id),
    supervisor_id INTEGER REFERENCES employees(id),
    employment_status VARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, Probationary, On Leave, Suspended, Separated
    hire_date DATE NOT NULL,
    confirmation_date DATE,
    residential_address TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### 3. `attendance_records` Table
Tracks daily aggregate employee attendance, calculated work hours, overtime, and punctuality flags.
```sql
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    date DATE NOT NULL,
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'Present', -- Present, Late, Absent, Half Day, On Leave, Holiday
    work_hours NUMERIC(4, 2) DEFAULT 0,
    overtime_hours NUMERIC(4, 2) DEFAULT 0,
    clock_in_device VARCHAR(100),
    clock_out_device VARCHAR(100),
    clock_in_lat DOUBLE PRECISION,
    clock_in_lng DOUBLE PRECISION,
    clock_out_lat DOUBLE PRECISION,
    clock_out_lng DOUBLE PRECISION,
    geofence_verified BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, date)
);
```

#### 4. `clocking_punches` Table
Raw append-only event stream of all biometric, kiosk, mobile, and web punches.
```sql
CREATE TABLE clocking_punches (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    punch_type VARCHAR(20) NOT NULL, -- CLOCK_IN, CLOCK_OUT, BREAK_START, BREAK_END
    channel VARCHAR(50) NOT NULL,    -- MOBILE_GPS, LOBBY_KIOSK, BIOMETRIC_DEVICE, WEB_PORTAL
    device_id VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    geofence_verified BOOLEAN DEFAULT FALSE,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clocking_punches_emp_created ON clocking_punches(employee_id, created_at DESC);
```

#### 5. `leave_requests` Table
Manages statutory and contractual leave applications with multi-tier approval states.
```sql
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    leave_type VARCHAR(50) NOT NULL, -- recreation, sick, compassionate, maternity, paternity, study, lwop
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested NUMERIC(4, 1) NOT NULL,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, endorsed, approved, rejected, cancelled
    acting_employee_id INTEGER REFERENCES employees(id),
    attachment_url TEXT,
    supervisor_notes TEXT,
    endorsed_by INTEGER REFERENCES users(id),
    endorsed_at TIMESTAMP WITH TIME ZONE,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### 6. `contracts` Table
Stores employment terms, fixed-term milestones, and renewal metadata.
```sql
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    contract_reference VARCHAR(100) NOT NULL UNIQUE,
    contract_type VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    salary_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, Expiring, Renewed, Terminated, Expired
    document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contracts_expiry ON contracts(end_date, status);
```

#### 7. `audit_logs` Table
Immutable security and data modification audit trail.
```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,      -- AUTH_LOGIN, CREATE_EMPLOYEE, UPDATE_SALARY, DELETE_RECORD, etc.
    target_entity VARCHAR(100) NOT NULL,
    target_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
```

#### 8. `biometric_templates` Table
Stores encrypted mathematical templates for multi-modal biometric authentication (Fingerprint, Iris, Voice).
```sql
CREATE TABLE biometric_templates (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    modality VARCHAR(30) NOT NULL,          -- FINGERPRINT, IRIS, VOICE
    sub_type VARCHAR(50),                   -- RIGHT_INDEX, LEFT_INDEX, BOTH_EYES, VOCAL_PASSPHRASE
    template_format VARCHAR(50) NOT NULL,   -- ANSI_NIST_ITL, ISO_19794_6, MFCC_DNN_VECTOR
    encrypted_template TEXT NOT NULL,       -- AES-256 encrypted biometric vector/template
    quality_score INTEGER NOT NULL,         -- 1-100 quality metric at capture time
    algorithm_version VARCHAR(50) NOT NULL,
    enrolled_by INTEGER REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_biometric_emp_modality ON biometric_templates(employee_id, modality, is_active);
```

#### 9. `registered_devices` Table
Enforces hardware device binding for kiosk scans and mobile geofenced punch operations.
```sql
CREATE TABLE registered_devices (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    device_uuid VARCHAR(128) NOT NULL UNIQUE,       -- Cryptographic hardware UUID / WebAuthn Credential ID
    device_model VARCHAR(100),                      -- e.g., "Apple iPhone 15 Pro", "Samsung Galaxy S24"
    os_version VARCHAR(50),
    public_key TEXT,                                -- Device ECDSA public key for punch signing
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE, SUSPENDED, DE-REGISTERED
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_verified_at TIMESTAMP WITH TIME ZONE,
    last_ip_address VARCHAR(50)
);
CREATE INDEX idx_registered_devices_emp ON registered_devices(employee_id, status);
```

#### 10. `employee_badges` Table
Manages RFID, proximity, and magnetic stripe smart ID cards issued to personnel.
```sql
CREATE TABLE employee_badges (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    badge_number VARCHAR(50) NOT NULL UNIQUE,       -- Human-readable card ID (e.g., "BADGE-2026-0812")
    csn_uid VARCHAR(128) NOT NULL UNIQUE,           -- Card Serial Number / UID (e.g., "UID-A3F890B2")
    card_type VARCHAR(50) NOT NULL,                 -- MIFARE_CLASSIC, MIFARE_DESFIRE, HID_PROX, MAGSTRIPE
    facility_code VARCHAR(50) DEFAULT 'HQ-01',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE, REVOKED, EXPIRED, LOST
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    issued_by INTEGER REFERENCES users(id),
    last_tapped_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_employee_badges_csn ON employee_badges(csn_uid, status);
CREATE INDEX idx_employee_badges_emp ON employee_badges(employee_id, status);
```

---

## 4. Cryptographic Security & Authentication Model

### 4.1 Token Lifecycle & Structure
The platform utilizes standard JSON Web Tokens (JWT) signed with HMAC-SHA256 (`HS256`).

```
Header:  {"alg": "HS256", "typ": "JWT"}
Payload: {
  "id": 42,
  "email": "officer@enterprise.gov",
  "role": "hr_officer",
  "employeeId": 105,
  "tokenVersion": 1,
  "iat": 1728424800,
  "exp": 1728511200
}
```

### 4.2 Instant Session Invalidation (`tokenVersion`)
To immediately terminate compromised sessions across all user devices without stateful token blacklists:
1. Every user record maintains an integer column `token_version` (default: 1).
2. During authentication middleware evaluation, the API decodes the token and queries the current user record.
3. If `payload.tokenVersion !== dbUser.tokenVersion`, the request returns `401 Unauthorized` (`INVALID_TOKEN_VERSION`).
4. Whenever an administrator changes user roles, forces a password reset, or an employee clicks "Log out of all devices", the backend increments `token_version` by 1.

### 4.3 Brute-Force Lockout Defense
To prevent dictionary and brute-force password attacks:
```typescript
// Authentication Failure Handler Logic
if (!passwordValid) {
  const attempts = user.failedLoginAttempts + 1;
  const updates: Partial<User> = { failedLoginAttempts: attempts };
  
  if (attempts >= 5) {
    updates.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30-minute lockout
  }
  await db.update(users).set(updates).where(eq(users.id, user.id));
  
  if (attempts >= 5) {
    return res.status(423).json({
      success: false,
      code: "ACCOUNT_LOCKED",
      message: "Account locked due to 5 failed attempts. Try again in 30 minutes."
    });
  }
  return res.status(401).json({
    success: false,
    message: `Invalid credentials. ${5 - attempts} attempt(s) remaining.`
  });
}
```

---

## 5. REST API Specifications & Data Contracts

All endpoints return standardized JSON responses:

**Standard Success Response (`HTTP 200 / 201`):**
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... }
}
```

**Standard Error Response (`HTTP 400 / 401 / 403 / 404 / 422 / 500`):**
```json
{
  "success": false,
  "message": "Human-readable description of error.",
  "code": "ERROR_CODE_STRING",
  "errors": [ ... ]
}
```

### 5.1 Route Inventory Reference

| Module | Route Path | Method | Access Scope | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Auth** | `/api/auth/login` | `POST` | Public | Authenticates credentials, returns bearer JWT |
| **Auth** | `/api/auth/me` | `GET` | Authenticated | Returns authenticated user profile & permissions |
| **Auth** | `/api/auth/reset-request` | `POST` | Public | Generates SHA-256 hashed password reset token |
| **Employees** | `/api/employees` | `GET` | HR / Admin / Mgr | Paginated directory with multi-column filtering |
| **Employees** | `/api/employees` | `POST` | HR / Admin | Creates master employee profile and dossier |
| **Employees** | `/api/employees/:id` | `GET` | Authenticated | Returns comprehensive 6-tab dossier record |
| **Employees** | `/api/employees/:id` | `PATCH` | HR / Admin | Updates profile fields; creates audit log entry |
| **Attendance**| `/api/attendance` | `GET` | Authenticated | Queries timesheets filtered by date and department |
| **Attendance**| `/api/attendance/mobile-punch`| `POST` | Authenticated | GPS geofenced mobile clock-in/out |
| **Clocking** | `/api/clocking/kiosk/token` | `GET` | Kiosk / Admin | Generates 15s rotating TOTP cryptographic QR |
| **Clocking** | `/api/clocking/kiosk/scan` | `POST` | Authenticated | Verifies dynamic QR token and logs arrival |
| **Clocking** | `/api/clocking/punches` | `POST` | Device API Key | Ingests biometric turnstile punch payload |
| **Leave** | `/api/leave/balances/:empId` | `GET` | Authenticated | Returns accrued, used, and available leave days |
| **Leave** | `/api/leave/requests` | `POST` | Authenticated | Submits new leave application |
| **Leave** | `/api/leave/requests/:id/approve` | `POST` | Manager / HR | Endorses or gives final approval for leave |
| **Contracts** | `/api/contracts` | `GET` | HR / Admin | Contract register with 90/60/30-day expiry flags |
| **Jobs** | `/api/jobs` | `GET` | Public / Auth | Lists active vacancy requisitions |
| **Jobs** | `/api/jobs` | `POST` | HR / Admin | Creates approved job vacancy specification |
| **ATS** | `/api/applications` | `GET` | HR / Hiring Mgr | Retrieves applicant pool with pipeline stages |
| **ATS** | `/api/applications/:id/score`| `POST` | Panel Member | Submits weighted scorecard (1-100 scale) |
| **Documents** | `/api/hr-letters/generate` | `POST` | HR / Admin | Generates official PDF with digital seal & stamp |
| **Integration**| `/api/integrations/webhooks` | `POST` | Admin | Registers outbound event webhook endpoint |
| **Reports** | `/api/reports/export` | `POST` | Executive / HR | Generates CSV, Excel, or PDF data dumps |
| **System** | `/api/health` | `GET` | Public | System liveness, database ping, uptime check |

---

## 6. Smart Attendance & Spatial Geofencing Protocol

### 6.1 Haversine Distance Calculation Algorithm
To verify whether a mobile employee is physically on-premises, the API evaluates the client's HTML5 coordinates against pre-configured institutional coordinates using the spherical Haversine formula:

$$\Delta\sigma = 2 \arcsin \left( \sqrt{ \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right) } \right)$$

$$d = R \cdot \Delta\sigma$$

```typescript
export function calculateDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

- If $d \le 200\text{ meters}$, `geofenceVerified = true` (Status: *Inside Perimeter*).
- If $d > 200\text{ meters}$, `geofenceVerified = false` (Status: *Outside Perimeter - Field Mode*).

### 6.2 15-Second Rotating TOTP & Registered Device Kiosk Protocol
To prevent clocking fraud ("buddy punching"):
1. The Kiosk terminal requests a dynamic token via `GET /api/clocking/kiosk/token`.
2. The server signs a payload containing `kioskId`, `currentWindow = Math.floor(Date.now() / 15000)`, and a server secret using HMAC-SHA256.
3. The token expires after 15 seconds.
4. When an employee scans the QR code, the client sends:
   ```json
   {
     "kioskToken": "eyJr...",
     "deviceUuid": "hw-sec-7f91-...",
     "deviceSignature": "MEQCIG...",
     "latitude": -9.4438,
     "longitude": 147.1803
   }
   ```
5. The API verifies:
   - Dynamic token signature & window freshness (`currentWindow` ± 1).
   - Validates that `deviceUuid` matches the employee's active record in `registered_devices`.
   - Verifies the cryptographic ECDSA signature using the device's enrolled `public_key`.
   - If device mismatch is detected, returns `403 Forbidden` (`UNREGISTERED_DEVICE_BLOCKED`).
   - Burns the token in Redis/memory cache to prevent replay.

### 6.3 Multi-Modal Biometric Processing Algorithms

| Modality | Capture Standard | Extraction Algorithm | Matching Metric & Decision Threshold |
| :--- | :--- | :--- | :--- |
| **Fingerprint** | ISO/IEC 19794-2 / ANSI-NIST-ITL | Bozorth3 Minutiae Extractor | Match Score $\ge 45$ (FAR < 0.001%, FRR < 0.5%) |
| **Iris Scan** | ISO/IEC 19794-6 (Dual-Eye NIR) | Daugman 2D Gabor Wavelet Filters | Fractional Hamming Distance $HD \le 0.32$ |
| **Voiceprint** | 16kHz Mono 24-bit PCM | 40-dim MFCC + X-Vector Deep Embeddings | Cosine Similarity $S_{\cos} \ge 0.78$ against baseline |

1. **Minutiae Extraction & Verification:**
   Fingerprint templates store ridge endings and bifurcations $(x_i, y_i, \theta_i)$. The matching engine aligns minutiae sets using affine coordinate transformation and computes relative point clusters.
2. **IrisCode Vector Matching:**
   The near-infrared camera segments the pupil and limbic boundaries, maps the annular iris zone into polar coordinates, and applies multi-scale 2D Gabor wavelets to generate a 2048-bit phase sequence. Verification computes the XOR difference masked by eyelids:
   $$HD = \frac{\|(\text{Code}_A \oplus \text{Code}_B) \cap \text{Mask}_A \cap \text{Mask}_B\|}{\|\text{Mask}_A \cap \text{Mask}_B\|}$$
3. **Acoustic Voiceprint Embeddings:**
   Audio samples pass through voice activity detection (VAD), frame-level MFCC feature extraction, and a pre-trained Time-Delay Neural Network (TDNN) to extract a 512-dimensional speaker embedding vector.

### 6.4 Anti-Truancy Architecture & Anomaly Detection Engine

To detect and penalize staff who check in during morning arrival and depart until evening checkout:

```
[ CONTINUOUS BACKGROUND TELEMETRY ]
        |-- Mobile Geofence Heartbeat Pings (Random 60-120 min intervals)
        |-- Enterprise Wi-Fi BSSID Periodic Check
        |-- Workstation Portal Session Keystroke / Action Auditor
        |
        v
[ TRUANCY ANOMALY SCORING ENGINE ]
        |-- Unanswered Geofence Challenge: +35 Anomaly Points
        |-- Wi-Fi Disconnect >45 min without Out-Duty Pass: +40 Anomaly Points
        |-- Zero Portal Actions in 8-hour shift: +25 Anomaly Points
        |
        v
[ DECISION THRESHOLD ]
  Anomaly Score >= 60 ---> Auto-Flag as "Suspected Absence / Truancy"
  Consecutive Flags >= 2 ---> Trigger Show-Cause Notice Generation (LTR-DISCIP)
```

- **Random Geofence Challenge Engine (`POST /api/clocking/challenge/respond`):**
  Issues asynchronous push prompts requiring location validation within 60 seconds.
- **Enterprise Network Beacon Validation (`POST /api/clocking/heartbeat`):**
  Validates that client devices are communicating through approved organizational Wi-Fi BSSIDs or internal subnet ranges.
- **Truancy Audit Reporting (`GET /api/reports/truancy-audit`):**
  Outputs comprehensive audit sheets cross-referencing punch timestamps with network and system audit logs.

### 6.5 Contactless Smart ID Card Swipe & Hardware Reader Protocols

The platform supports plug-and-play USB RFID readers, magnetic stripe decoders, and industrial access turnstile gateways via three standardized hardware interfaces:

```
+--------------------------------------------------------------------------------------------------+
|                                  ID CARD HARDWARE INTERFACE LAYERS                               |
+--------------------------------------------------------------------------------------------------+
| 1. USB HID POS Wedge Mode: Emulates keyboard scan events on kiosk web inputs                     |
| 2. Direct REST Terminal Client: Hardware controller posts JSON to /api/clocking/card-swipe       |
| 3. Wiegand Controller Bridge: 26-bit / 34-bit Wiegand-to-Ethernet gateway streaming punch frames |
+--------------------------------------------------------------------------------------------------+
```

#### Inbound Card Swipe API Contract (`POST /api/clocking/card-swipe`)
```json
{
  "csnUid": "UID-A3F890B2",
  "deviceId": "KIOSK-LOBBY-01",
  "facilityCode": "HQ-01",
  "verificationMode": "rfid_card",
  "timestamp": "2026-10-09T08:02:14.120Z",
  "cardType": "MIFARE_DESFIRE"
}
```

**Verification Flow:**
1. Looks up `csnUid` in `employee_badges` with `status = 'ACTIVE'`.
2. Resolves `matchedEmployeeId` from active badge association.
3. Validates that current timestamp is within active contract start/end dates.
4. Appends record to `clocking_raw_punches` and updates daily `attendance_records`.
5. Returns `HTTP 200 OK` with employee portrait URL and confirmation tone payload.
6. If card status is `REVOKED` or `LOST`, returns `HTTP 403 Forbidden` (`BADGE_REVOKED_SECURITY_ALERT`) and logs an audit security event.

---

## 7. Webhook Dispatcher & Third-Party Integrations

### 7.1 Outbound Webhook Delivery Architecture
The platform triggers outbound HTTP POST notifications for critical events:

```
[ EVENT TRIGGER ] (e.g. employee.created, leave.approved, attendance.punch)
        |
        v
[ EVENT DISPATCHER ]
        |-- Resolves active webhook subscriptions from `integrations` table
        |-- Generates HMAC-SHA256 signature in `X-Portal-Signature` header
        |-- Dispatches HTTP POST payload with 5000ms timeout
        |
        v
[ RETRY WORKER ]
        |-- HTTP 2xx: Marked as Delivered
        |-- HTTP 4xx/5xx or Timeout: Exponential backoff retry (1m, 5m, 15m)
```

### 7.2 Webhook Signature Verification
Recipients can verify payload authenticity using the shared secret:
```python
import hmac, hashlib

def verify_webhook(raw_payload_bytes, received_signature, secret_key):
    expected = hmac.new(secret_key.encode(), raw_payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received_signature)
```

---

## 8. Deployment, Environment Configuration & DevOps

### 8.1 Production Directory Layout

```
/var/www/enterprise-hr/
├── artifacts/
│   ├── api-server/         # Node.js Express API service
│   │   ├── dist/           # Compiled production bundle
│   │   └── package.json
│   ├── hr-portal/          # Main administrative SPA
│   │   └── dist/public/    # Built static frontend assets
│   └── attendance-app/     # Mobile attendance & Kiosk PWA
│       └── dist/public/    # Built static PWA assets
├── lib/
│   └── db/                 # Drizzle ORM schemas & migrations
├── docs/                   # System manuals and architecture docs
├── package.json
└── ecosystem.config.js     # PM2 Process Manager Configuration
```

### 8.2 PM2 Process Management (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [
    {
      name: "enterprise-hr-api",
      script: "artifacts/api-server/dist/index.mjs",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 8080
      },
      max_memory_restart: "1G",
      error_file: "logs/api-error.log",
      out_file: "logs/api-out.log",
      merge_logs: true
    }
  ]
};
```

### 8.3 Nginx Reverse Proxy & SSL Configuration Template

```nginx
server {
    listen 80;
    server_name hr.enterprise.gov;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hr.enterprise.gov;

    ssl_certificate /etc/letsencrypt/live/hr.enterprise.gov/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hr.enterprise.gov/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Primary HR Web Application
    location / {
        root /var/www/enterprise-hr/artifacts/hr-portal/dist/public;
        try_files $uri $uri/ /index.html;
    }

    # Dedicated Attendance & Kiosk PWA
    location /kiosk/ {
        alias /var/www/enterprise-hr/artifacts/attendance-app/dist/public/;
        try_files $uri $uri/ /kiosk/index.html;
    }

    # Core REST API Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

---

## 9. Systems Observability, Diagnostics & Troubleshooting

### 9.1 Health Check Telemetry (`GET /api/health`)
Returns immediate health telemetry for container orchestrators and load balancers:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-09T00:15:00.000Z",
  "uptimeSeconds": 86420,
  "database": {
    "status": "connected",
    "responseTimeMs": 4.2
  },
  "memory": {
    "rssMb": 84.1,
    "heapUsedMb": 48.6
  }
}
```

### 9.2 Common Operational Diagnostics

| Symptom / Error | Root Cause | Resolution Playbook |
| :--- | :--- | :--- |
| **HTTP 423 (Locked)** | 5 consecutive failed login attempts | Run `UPDATE users SET failed_login_attempts=0, lockout_until=NULL WHERE email=...;` or unlock via UI. |
| **HTTP 401 (Invalid Token)** | `token_version` mismatch or expired JWT | Re-authenticate at `/login` or check if administrator modified user credentials. |
| **HTTP 500 on Attendance** | SQL parameter typing or missing DB foreign key | Verify `employee_id` exists in `employees` table and coordinates are valid numeric floats. |
| **Outside Geofence False Alarm** | Low device GPS accuracy (>200m) | Enable High-Accuracy Mode in mobile OS or increase radial threshold in `organization_settings`. |
| **CORS Origin Rejected** | Request sent from unauthorized domain/port | Add client origin to `CORS_ORIGINS` environment variable in API configuration. |

---

*Enterprise Workforce & Human Resource Management Platform — Technical Manual v1.0*
