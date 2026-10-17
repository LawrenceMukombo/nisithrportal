# Enterprise Workforce Management & Human Resource Portal
## Official Operational Manual & Comprehensive User Guide (Version 1.0)

---

> ### Publication Notice & Document Governance
> **Document Identifier:** `EHRM-UG-v1.0-GENERIC`  
> **Security Classification:** Official Operational & Administrative Standard (Unrestricted Internal)  
> **Effective Release Date:** Fourth Quarter 2026  
> **Covered Subsystems:** Primary HR Management Portal (`:5173`), Smart Attendance & Mobile Kiosk Application (`:5174`), Core REST API Gateway (`:8080`)  
> **Applicable Audiences:** Chief Executives, Divisional Directors, Human Resource Officers, Department Supervisors, System Administrators, Field Personnel, General Employees, and External Job Applicants.

---

## Executive Summary & System Philosophy

The **Enterprise Workforce Management & Human Resource Portal** is a high-availability digital operating system engineered to govern, streamline, and secure the complete lifecycle of personnel across diverse public sector institutions and corporate enterprises. 

Built on principles of zero-trust data safety, audit immutability, and frictionless multi-channel access, the platform replaces fragmented spreadsheets, manual sign-in registers, and disparate paper dossiers with an integrated, unified ecosystem.

```
+--------------------------------------------------------------------------------------------------+
|                                    ENTERPRISE PORTAL ECOSYSTEM                                   |
+--------------------------------------------------------------------------------------------------+
|  [ PUBLIC RECRUITMENT ]        [ CORE PERSONNEL ]            [ TIME & PRESENCE ]                 |
|  - Vacancy Directory           - Master Employee Dossier     - Mobile GPS Geofencing (200m)      |
|  - 4-Step Application Wizard   - Interactive Org Chart       - 15s Rolling TOTP Lobby Kiosk     |
|  - Candidate Status Tracker    - Departmental Governance     - Biometric Hardware Integration    |
|  - Interview Scorecards        - Multi-Tenant Agency Tree    - Live Emergency Muster Roll        |
+--------------------------------+-----------------------------+-----------------------------------+
|  [ STATUTORY WORKFLOWS ]       [ TALENT DEVELOPMENT ]        [ ENTERPRISE SERVICES ]             |
|  - Leave Accruals & Calendar   - Performance Cycles (KRAs)   - WhatsApp-Style Messaging          |
|  - 90/60/30-Day Contract Alerts - Training & Certifications   - Cryptographic Digital Stamping    |
|  - Structured Onboarding       - Institutional Housing       - Custom Report Builder (CSV/PDF)   |
|  - Multi-Dept Offboarding      - Benefits & Superannuation   - REST Webhook Integration Builder  |
+--------------------------------------------------------------------------------------------------+
```

---

## Table of Contents

1. [System Architecture & Multi-Channel Deployment](#1-system-architecture--multi-channel-deployment)
2. [Role-Based Access Control (RBAC) & Navigation Schema](#2-role-based-access-control-rbac--navigation-schema)
3. [Module 1: Authentication, Password Governance & Account Security](#3-module-1-authentication-password-governance--account-security)
4. [Module 2: Executive Dashboard & Operational Intelligence](#4-module-2-executive-dashboard--operational-intelligence)
5. [Module 3: Public Career Portal & Candidate Self-Registration](#5-module-3-public-career-portal--candidate-self-registration)
6. [Module 4: Vacancy Requisition & Publishing Wizard](#6-module-4-vacancy-requisition--publishing-wizard)
7. [Module 5: Recruitment Pipeline, Applicant Screening & Panel Evaluations](#7-module-5-recruitment-pipeline-applicant-screening--panel-evaluations)
8. [Module 6: Master Personnel Directory & Employee Dossiers](#8-module-6-master-personnel-directory--employee-dossiers)
9. [Module 7: Interactive Organizational Chart & Reporting Chains](#9-module-7-interactive-organizational-chart--reporting-chains)
10. [Module 8: Smart Attendance, GPS Geofencing & Biometric Interoperability](#10-module-8-smart-attendance-gps-geofencing--biometric-interoperability)
11. [Module 9: Lobby Kiosk Mode, Rotating QR Tokens & Emergency Muster Roll](#11-module-9-lobby-kiosk-mode-rotating-qr-tokens--emergency-muster-roll)
12. [Module 10: Comprehensive Leave Operations & Statutory Holiday Ledger](#12-module-10-comprehensive-leave-operations--statutory-holiday-ledger)
13. [Module 11: Employment Contract Lifecycle Management & Expiry Alerts](#13-module-11-employment-contract-lifecycle-management--expiry-alerts)
14. [Module 12: Employee Induction & Structured Onboarding Workflows](#14-module-12-employee-induction--structured-onboarding-workflows)
15. [Module 13: Separation Governance, Asset Recovery & Offboarding Clearance](#15-module-13-separation-governance-asset-recovery--offboarding-clearance)
16. [Module 14: Performance Management, Competency Scoring & Appraisals](#16-module-14-performance-management-competency-scoring--appraisals)
17. [Module 15: Professional Development, Training Catalog & Certifications](#17-module-15-professional-development-training-catalog--certifications)
18. [Module 16: Staff Benefits, Allowances & Property Housing Allocation](#18-module-16-staff-benefits-allowances--property-housing-allocation)
19. [Module 17: Central Document Vault, HR Letter Generation & Digital Stamps](#19-module-17-central-document-vault-hr-letter-generation--digital-stamps)
20. [Module 18: Real-Time Enterprise Messaging & Collaboration](#20-module-18-real-time-enterprise-messaging--collaboration)
21. [Module 19: Custom Report Generator & Data Extraction Engine](#21-module-19-custom-report-generator--data-extraction-engine)
22. [Module 20: System Administration, Access Grants & Audit Logs](#22-module-20-system-administration-access-grants--audit-logs)
23. [Module 21: Integration Builder, Webhooks & Payroll Interoperability](#23-module-21-integration-builder-webhooks--payroll-interoperability)
24. [Operational Troubleshooting & Comprehensive FAQ](#24-operational-troubleshooting--comprehensive-faq)

---

## 1. System Architecture & Multi-Channel Deployment

The platform is designed around a three-tier micro-service architecture:

```
[ CLIENT TIER ]
   |-- Parent Web Portal (Port 5173): Desktop administration, HR operations, dashboards, forms
   |-- Attendance & Kiosk Terminal (Port 5174): Mobile PWA, GPS geofencing sensor, QR reception screen
   |-- Public Portal (Port 5173/jobs): Unauthenticated vacancy directory & job application wizard
   |
[ APPLICATION & API TIER ]
   |-- Core REST API (Port 8080): Express / TypeScript backend, RBAC engine, validation schemas
   |-- Cryptographic Authentication: JWT + HMAC bearer session tokens, bcrypt password hashing
   |-- Biometric Ingestion Gateway: Standardized REST endpoint for turnstiles and timeclocks
   |
[ PERSISTENCE & INFRASTRUCTURE TIER ]
   |-- Relational Database: PostgreSQL with Drizzle ORM
   |-- Document Storage: Encrypted local storage and cloud object vault with digital watermarking
   |-- Audit Logger: Structured JSON security and transactional audit ledger
```

### 1.1 Client Runtime Requirements

| Component | Minimum Specification | Recommended Specification | Supported Platforms |
| :--- | :--- | :--- | :--- |
| **Desktop Web Portal** | Modern Chromium / Firefox / Safari (1024x768 display) | Chromium 120+, Edge 120+, Firefox 120+ (1920x1080 display) | Windows 10/11, macOS 12+, Linux |
| **Mobile Punch PWA** | Mobile Browser with HTML5 Geolocation API | iOS Safari 16+, Chrome for Android 115+ | Android 10+, iOS 15+ |
| **Lobby Kiosk Display** | 1080p Tablet or Wall-Mounted Screen | 10.5" or 12.9" Touch Display with constant power | Android Tablet, iPad, Windows POS |
| **Network Latency** | 256 kbps cellular or broadband connection | 2 Mbps low-latency enterprise intranet | TLS 1.3 / HTTPS Encrypted |

---

## 2. Role-Based Access Control (RBAC) & Navigation Schema

The portal implements strict Principle of Least Privilege (PoLP) security. Users are automatically assigned an organizational role defining accessible screens and write actions.

### 2.1 Role Access Matrix

| Functional Module | System Admin (`admin`) | HR Officer (`hr_officer`) | Hiring Manager (`hiring_manager`) | Executive (`executive`) | General Staff (`employee`) | Public Applicant (`applicant`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **System Administration & Logs** | Full Read/Write | No Access | No Access | Read Only | No Access | No Access |
| **User & RBAC Account Grants** | Full Read/Write | No Access | No Access | No Access | No Access | No Access |
| **Integration Builder & Webhooks**| Full Read/Write | Read Only | No Access | Read Only | No Access | No Access |
| **Core Personnel Directory** | Full Read/Write | Full Read/Write | Department Only | Read Only | Directory Only | No Access |
| **Employee Dossier Editing** | Full Read/Write | Full Read/Write | No Access | No Access | Personal Only | No Access |
| **Organizational Chart** | Full Read/Write | Full Read/Write | Read Only | Read Only | Read Only | No Access |
| **Attendance Operations** | Full Read/Write | Full Read/Write | Department Only | Strategic Overview | Self Punch | No Access |
| **Biometric & Kiosk Terminals** | Configure Terminals| Manage Tokens | View Presence | View Presence | Scan / Check-In | No Access |
| **Leave Approvals** | System Override | Final Approval | First Endorsement | Executive Leave | Self Request | No Access |
| **Contract Register & Alerts** | Full Read/Write | Full Read/Write | Department Only | Read & Sign | Personal View | No Access |
| **Recruitment & ATS Pipeline** | Full Read/Write | Full Read/Write | Department Only | Final Approvals | View Vacancies | Apply & Track |
| **Onboarding & Offboarding** | Full Read/Write | Full Read/Write | Department Tasks | Executive Oversight| Personal Tasks | No Access |
| **Performance Appraisals** | System Admin | Process Owner | Review & Score | Directorate Review | Self Assessment | No Access |
| **Training & Skills Catalog** | Manage Courses | Manage Courses | Department Nominate| View ROI | Course Request | No Access |
| **Benefits & Housing Allocation** | Full Read/Write | Full Read/Write | No Access | Read Only | View Entitlement| No Access |
| **Document Vault & Stamping** | Full Read/Write | Full Read/Write | Department Only | Digital Sign | Personal Vault | No Access |
| **Official HR Letters** | Full Read/Write | Generate Letters | No Access | Sign / Stamp | View Issued | No Access |
| **Enterprise Messaging** | All Channels | All Channels | Dept & Direct | Dept & Direct | Dept & Direct | No Access |
| **Report Generator & Exports** | Full Generator | Full Generator | Dept Reports | Strategic Reports| No Access | No Access |

---

## 3. Module 1: Authentication, Password Governance & Account Security

### 3.1 Overview
The Authentication module handles single sign-on, cryptographic token exchange, brute-force mitigation, and automated session invalidation.

### 3.2 Access Route
- **Login Portal:** `/login`
- **Password Reset Request:** `/reset-request`
- **Password Reset Action:** `/reset-password`
- **Personal Account Settings:** `/account`

### 3.3 Security Safeguards
1. **Brute-Force Account Lockout:** Accounts are locked automatically for 30 minutes following 5 consecutive failed login attempts.
2. **One-Way Token Hashing:** Password reset tokens are SHA-256 hashed prior to persistence; bearer tokens cannot be reverse-engineered from database exports.
3. **Session Invalidation:** Modifying account passwords or role permissions increments the internal `tokenVersion`, instantly terminating all active client sessions across devices.

### 3.4 Operational Procedures

```
[ LOGIN WORKFLOW ]
User Inputs Email + Password ---> POST /api/auth/login ---> Credentials Validated
                                                                 |
            +----------------------------------------------------+
            |
    [ Success ] ---> Issue JWT Bearer Token ---> Redirect to Dashboard
            |
    [ Failed ] ---> Increment failedLoginAttempts
                     |-- Attempts < 5: Display "Invalid credentials. X attempt(s) remaining."
                     +-- Attempts = 5: Lock Account for 30 Minutes (Status 423)
```

> 🔒 **Security Notice:** System administrators can bypass the 30-minute lockout timer in emergency situations by navigating to `/users`, selecting the locked account, and clicking `[ Unlock Account & Reset Attempts ]`.

---

## 4. Module 2: Executive Dashboard & Operational Intelligence

### 4.1 Overview
Provides executive leadership and department heads with real-time operational metrics, predictive alerts, compliance indicators, and organizational health metrics.

### 4.2 Access Routes
- **Operational HR Dashboard:** `/dashboard`
- **Strategic Executive Dashboard:** `/executive-dashboard`

### 4.3 Key Metrics & Analytics Panels
- **Workforce Headcount:** Total active personnel, breakdown by gender ratio, contract vs. permanent distribution, and provincial branch counts.
- **Contract Expiry Watchdog:** Real-time indicator highlighting agreements expiring in `<30 days`, `30-60 days`, and `60-90 days`.
- **Attendance & Punctuality Trends:** Real-time daily headcount attendance percentage, late arrival rates, and unnotified absence ratios.
- **Leave Accruals & Liability:** Total operational days outstanding and estimated fiscal liability.
- **Recruitment Funnel Metrics:** Open job requisitions, average time-to-hire in calendar days, and active applications undergoing screening.

---

## 5. Module 3: Public Career Portal & Candidate Self-Registration

### 5.1 Overview
Serves as the public-facing talent acquisition interface where external candidates discover open positions, understand statutory qualifications, and submit applications.

### 5.2 Access Routes
- **Public Jobs Directory:** `/jobs`
- **Position Specification:** `/jobs/:id`
- **Application Submission Wizard:** `/jobs/:id/apply`
- **Live Application Tracker:** `/track-application`
- **Candidate Registration:** `/applicant-register`

### 5.3 Operating Procedure: Submitting a Job Application
1. **Browse Vacancies:** Access `/jobs` and utilize the multi-criteria search bar to filter by Department, Employment Type (Permanent, Fixed-Term, Casual), and Location.
2. **Review Position Details:** Click `[ View Details ]` to examine the official duty statement, reporting structure, salary band, and minimum required education/experience.
3. **Launch Application Wizard:** Click `[ Apply Now ]`. Complete the 4-phase structured form:
   - *Phase 1 (Identity & Contact):* Legal name, personal email, phone number, and physical residential address.
   - *Phase 2 (Experience & Qualifications):* Highest degree obtained, educational institution, previous employers, and total years of relevant experience.
   - *Phase 3 (Document Attachment):* Upload Resume/Curriculum Vitae, Cover Letter, and scanned academic transcripts (PDF, maximum 10MB per file).
   - *Phase 4 (Declaration & Submission):* Review entered data, accept legal declarations, and confirm submission.
4. **Tracking Reference:** The system issues a unique, immutable application code (e.g., `APP-2026-0812`).
5. **Monitor Status:** Applicants can navigate to `/track-application` at any time and input their email and tracking code to view real-time stage progression.

---

## 6. Module 4: Vacancy Requisition & Publishing Wizard

### 6.1 Overview
Enables department directors to submit vacancy requisitions based on approved staffing budgets, and allows HR officers to publish approved vacancies to the public portal.

### 6.2 Access Routes
- **Requisitions Directory:** `/jobs` (Authenticated HR/Manager View)
- **Create New Requisition:** `/jobs/new`
- **Edit / Amend Requisition:** `/jobs/:id/edit`

### 6.3 Requisition Lifecycle

```
[ DRAFT ] ---> [ UNDER REVIEW ] ---> [ APPROVED ] ---> [ PUBLISHED ] ---> [ CLOSED ] ---> [ ARCHIVED ]
  HR/Dept        Divisional Head       Executive          Portal Live       Deadline Passed   Post-Hire
```

### 6.4 Key Data Fields
- **Position Metadata:** Official Position Title, Position Code, Division, Department, Unit, Grade Level.
- **Tenure & Work Modality:** Permanent, Fixed Term Contract, Temporary Acting, Remote/Field.
- **Duty Statement:** Core purpose, key operational deliverables, and supervisory responsibilities.
- **Statutory Requirements:** Minimum educational qualification, years of post-qualification experience, professional licensing, and police clearance requirements.
- **Publication Parameters:** Opening date, formal closing date/time, contact email, and recruitment quotas.

---

## 7. Module 5: Recruitment Pipeline, Applicant Screening & Panel Evaluations

### 7.1 Overview
An enterprise Applicant Tracking System (ATS) that streamlines candidate screening, panel interviews, objective scoring, and final selection.

### 7.2 Access Routes
- **Applications Master List:** `/applications`
- **Interactive Kanban Pipeline:** `/recruitment-workflow`
- **Applicant Evaluation Dossier:** `/applications/:id`
- **Shortlisted Candidate Management:** `/shortlisted`
- **Pipeline SLA Rules:** `/pipeline-sla-settings`

### 7.3 Recruitment Stages & Workflows

```
STAGE 1: Applied       ---> New submissions entering the unreviewed pool
STAGE 2: Screening     ---> HR checks basic eligibility, qualifications, and police clearance
STAGE 3: Shortlisted   ---> Candidate meets all criteria and is slated for panel evaluation
STAGE 4: Interview     ---> Panel interviews conducted; scores and remarks submitted
STAGE 5: Offer Issued  ---> Formal conditional offer letter generated and dispatched
STAGE 6: Hired         ---> Candidate accepts offer; converted into a master employee profile
```

### 7.4 Recruitment Stage SLA Reference

| Stage | Operational Description | Responsible Role | SLA Target | Automated Notification |
| :--- | :--- | :--- | :---: | :--- |
| **Applied** | Ingestion of raw application and resume | External Candidate | Immediate | Email confirmation with Tracking ID |
| **Screening** | Verification of qualifications & eligibility | HR Officer | 5 Working Days | Status update to "Under Screening" |
| **Shortlisted** | Candidate slates compiled for panel | Hiring Manager & HR | 3 Working Days | Invitation to Interview Letter dispatched |
| **Interview** | Structured panel interview scoring (1-100) | Evaluation Panel | 7 Working Days | Reminder sent to unsubmitted panelists |
| **Offer Issued** | Conditional appointment letter generated | Executive Director | 3 Working Days | Cryptographically stamped offer email |
| **Hired** | Conversion into permanent employee dossier | HR Officer | 2 Working Days | Onboarding induction package triggered |

### 7.5 Panel Scoring & Interview Assessment
Authorized panel members access the candidate dossier at `/applications/:id` and input structured scores (1-100 scale) across weighted evaluation criteria:
- **Core Competencies & Domain Expertise (40% Weight)**
- **Qualifications & Regulatory Certifications (30% Weight)**
- **Problem Solving & Behavioral Competence (20% Weight)**
- **Communication & Executive Presentation (10% Weight)**

> 💡 **Best Practice:** The system automatically aggregates panel submissions into an objective candidate score, preventing selection bias and maintaining audit compliance.

---

## 8. Module 6: Master Personnel Directory & Employee Dossiers

### 8.1 Overview
Serves as the single source of truth for all human capital records across the organization.

### 8.2 Access Routes
- **Master Employee Directory:** `/employees`
- **Add Employee Record:** `/employees/new`
- **Master Employee Dossier:** `/employees/:id`
- **Edit Dossier Record:** `/employees/:id/edit`

### 8.3 Enterprise Directory Table Features
The Employee Directory table includes:
- **Multi-Column Sorting:** Sort ascending or descending by Staff ID, Name, Department, Grade, Tenure, or Attendance Status.
- **Dynamic Page Size Control:** Choose between 10, 25, 50, or 100 records per page.
- **Search & Multi-Filter:** Filter instantaneously by Department, Division, Employment Status (*Active*, *Probationary*, *On Leave*, *Suspended*, *Separated*), or search by name and ID.
- **Column Visibility Toggles:** Show or hide secondary attributes (e.g., date of birth, emergency contact phone, national ID).
- **Export Capabilities:** One-click CSV export of filtered views for regulatory reporting.

### 8.4 Structure of the Master Dossier (`/employees/:id`)
- **Header Profile Card:** Portrait image, legal full name, employee number, job title, department badge, reporting manager, and real-time live attendance status badge.
- **Tab 1: Biodata & Demographics:** Residential address, postal contact, date of birth, gender, marital status, emergency contact details.
- **Tab 2: Position & History:** Grade level, appointment date, probation completion date, confirmation date, supervisor ID, and full history of internal transfers and promotions.
- **Tab 3: Employment Contracts:** Comprehensive register of contracts, terms, start/end dates, and digital contract PDF downloads.
- **Tab 4: Leave Ledger:** Current balance breakdown (Annual, Sick, Compassionate, Study) and history of approved leave.
- **Tab 5: Document Repository:** Personnel documents including national ID scans, academic credentials, medical declarations, and performance appraisals.
- **Tab 6: Audit History:** Immutable chronological record of every profile update, who performed it, and when.

---

## 9. Module 7: Interactive Organizational Chart & Reporting Chains

### 9.1 Overview
Renders the complete institutional hierarchy as an interactive visual tree, making reporting lines and operational spans of control clear.

### 9.2 Access Route
- **Interactive Org Chart:** `/org-chart`

### 9.3 Capabilities & User Interactions
- **Visual Nodes:** Each node displays staff photo, legal name, position title, department badge, and direct report count.
- **Expand / Collapse Branches:** Click any managerial node to expand or collapse subordinate reporting units.
- **Pan & Zoom Controls:** Smooth zooming from broad executive overviews down to specific operational units.
- **Direct Dossier Link:** Click any staff node to navigate directly to their master employee dossier.
- **Budgeted Vacancy Visualization:** Visualizes open, budgeted positions within departments alongside filled roles to identify staffing gaps.

---

## 10. Module 8: Smart Attendance, GPS Geofencing & Biometric Interoperability

### 10.1 Overview
An automated time and presence management system that combines mobile GPS geofencing, dynamic lobby kiosks, and hardware biometric terminals into a single unified ledger.

### 10.2 Access Routes
- **Attendance Management Dashboard:** `/attendance`
- **Dedicated Smart Attendance Application:** `http://localhost:5174` (Mobile PWA)
- **Biometric Device Ingestion API:** `POST /api/clocking/punches`

### 10.3 Clocking Verification Modalities

| Clocking Channel | Verification Method | Suitable Use Case | Hardware Required |
| :--- | :--- | :--- | :--- |
| **Contactless ID Card Swipe/Tap**| RFID 13.56MHz Mifare / 125kHz Prox / Magstripe | Lobby turnstiles, reception kiosks, security gates | USB RFID Reader / Magstripe Reader / Turnstile |
| **Fingerprint Biometric** | Optical / Capacitive Template (ISO 19794-2) | Turnstiles, workshops, laboratories, main entrances | USB Optical Scanner / Physical Turnstile |
| **Iris Biometric Scan** | Near-Infrared Dual-Eye Iris Code (ISO 19794-6) | High-security cleanrooms, executive areas, contact-free entry | Specialized Dual-Iris Wall / Desk Scanner |
| **Voice Recognition** | Acoustic Biometric Voiceprint Embedding | Remote field check-ins, telephone clock-in, mobile portal | Built-in Smartphone / Laptop Microphone |
| **Lobby Kiosk Scan** | Dynamic 15s Rolling TOTP QR + Registered Phone | Reception turnstiles, main office lobbies, floor entrances | Wall-Mounted Tablet + Registered Employee Phone |
| **Mobile GPS Geofence** | Device GPS vs. Defined Spatial Perimeter (200m) | Field officers, traveling staff, regional operations | Pre-Registered Smartphone with GPS |
| **Web Portal Direct** | Authenticated User Session Punch + IP Whitelist | Administrative personnel at designated workstations | Workstation Browser on Office Subnet |

### 10.4 Multi-Modal Biometric Enrollment: Fingerprint, Iris Scan & Voiceprint

Before employees can utilize hardware terminals or voice-based clocking, their biometric profiles must be formally enrolled by an authorized HR Officer or Security Administrator:

1. **Access Biometric Enrollment Console:** Navigate to **Employee Directory** (`/employees/:id`), select the **Security & Biometrics** tab, and click `[ Enroll New Biometric Modality ]`.
2. **Fingerprint Enrollment:**
   - Connect the certified USB fingerprint scanner (e.g., SilkID / Futronic optical reader).
   - Instruct the employee to place their primary finger (Right Index) three consecutive times to extract minutiae points.
   - The system computes an automated **Image Quality Score** (minimum required threshold: 85%).
   - Capture a secondary backup finger (Left Index or Right Thumb).
   - The encrypted minutiae template (ANSI/NIST-ITL standard) is persisted into the biometric vault. Raw fingerprint images are discarded immediately for privacy compliance.
3. **Iris Scan Enrollment:**
   - Position the employee 30–45 cm in front of the dual-iris scanner.
   - The system emits safe near-infrared illumination to capture the distinct cryptographic textural patterns of both left and right irises.
   - The system verifies pupil dilation and confirms an iris quality score $\ge 90\%$.
   - The generated 512-byte IrisCode vector is cryptographically signed and stored.
4. **Voiceprint Recognition Enrollment:**
   - Have the employee speak a standardized randomized pass-phrase into the microphone three times (e.g., *"My voice is my official identity for organizational attendance"*).
   - The acoustic engine extracts mel-frequency cepstral coefficients (MFCC) and deep neural network embeddings to generate a personalized voice biometric vector.
   - The voiceprint is calibrated against ambient room noise to establish a baseline signal-to-noise ratio.
5. **Confirmation & Hardware Sync:** Click `[ Save & Synchronize Terminals ]`. The new biometric templates are securely broadcast to all physical turnstiles and timeclocks within the employee's assigned facility within 60 seconds.

### 10.5 Contactless ID Card Swipe, Tap & Badge Management

The portal supports official institutional RFID smart cards, proximity badges, and magnetic stripe employee ID cards for instantaneous, frictionless tap-and-go clocking:

1. **ID Card Enrollment Procedure:**
   - Open the employee dossier at `/employees/:id` and select the **ID Badges & Access Cards** sub-tab.
   - Click `[ Register New ID Card ]`.
   - Tap the new physical card against the administrative USB RFID reader (e.g., ACR122U or Omnikey reader) or swipe the magnetic stripe card.
   - The system automatically captures the Card Serial Number (CSN) / Unique Identifier (UID) (e.g., `UID-A3F890B2`).
   - Select Card Type: *Mifare Classic 1K/4K*, *Mifare DESFire EV2/EV3*, *HID Proximity 125kHz*, or *Magnetic Stripe (Track 1/2)*.
   - Set Card Expiration Date (coinciding with the employee's contract end date or standard 3-year badge renewal cycle).
   - Click `[ Save & Issue Card ]`. The card is immediately active across all facility readers.
2. **Clocking with ID Card Swipe / Tap:**
   - At any lobby kiosk terminal (`:5174`) or entrance turnstile, the employee taps their badge against the card reader or swipes through the magnetic slot.
   - The terminal produces an affirmative acoustic tone (chime), displays the employee's portrait photo and legal name on the screen for 2.5 seconds, and logs the punch timestamp.
   - When paired with an optional kiosk web camera, the system snaps a verification photo to ensure the cardholder is the genuine badge owner.
3. **Lost / Stolen Card Revocation & Re-Issuance:**
   - If an employee reports a lost badge, an HR officer navigates to `/employees/:id`, locates the active card, and clicks `[ Revoke Badge ]`.
   - The badge is immediately placed on the global access blacklist (`REVOKED`), preventing any unauthorized facility entry or false attendance clocking.
   - A replacement card can be registered in under 30 seconds.

### 10.6 Registered Phone Device Binding for Lobby Kiosks

To prevent employees from clocking in on behalf of colleagues ("buddy punching"), the portal enforces strict **Hardware Device Binding**:

1. **Initial Device Registration:**
   - When an employee first logs into the Smart Attendance App (`:5174`), the application captures the device's unique cryptographic hardware fingerprint (WebAuthn hardware key / device token / secure UUID).
   - The employee enters an SMS/email verification OTP to authenticate and link the device.
   - The device status is saved on their employee profile as **Registered Attendance Phone** (only 1 primary active device allowed per employee).
2. **Scanning Kiosk Dynamic QR Codes:**
   - At the office lobby, the employee points their registered phone's camera at the 15-second rotating TOTP QR screen.
   - The app transmits the dynamic QR token **together with the cryptographic device signature**.
   - If a staff member attempts to scan using an unapproved or borrowed phone, the server immediately denies the punch:
     `HTTP 403 Forbidden: DEVICE_NOT_REGISTERED_FOR_EMPLOYEE`.
   - To replace a lost or upgraded phone, an employee must submit a formal **Device Reset Request** to HR, which de-authorizes the previous device.

### 10.7 Anti-Truancy Monitoring & Enforcement ("Check-in and Leave" Defense)

A critical operational challenge in workforce administration is personnel who check in during morning arrival, leave the premises for unauthorized personal activities, and only return at the end of the shift to clock out. The platform provides a multi-layered detection and disciplinary framework to actively monitor and eliminate this practice:

```
+--------------------------------------------------------------------------------------------------+
|                            ANTI-TRUANCY 5-LAYER MONITORING ECOSYSTEM                             |
+--------------------------------------------------------------------------------------------------+
| LAYER 1: Random Micro-Geofence Challenges (Silent mobile prompt requiring 60s confirmation)      |
| LAYER 2: Enterprise Wi-Fi BSSID Sniffing (Detects departure from office access points)           |
| LAYER 3: Digital Activity Telemetry (Cross-checks ERP/Portal actions against 8-hour shift)       |
| LAYER 4: Mandatory Mid-Day Meal Clocking (Enforces physical lobby punch-out and punch-in)        |
| LAYER 5: Supervisory Floor Muster Spot-Audits (Real-time digital roll-call on manager dashboard) |
+--------------------------------------------------------------------------------------------------+
                                                |
                                                v
             [ AUTOMATED ANOMALY FLAGGING -> SHOW-CAUSE NOTICE (LTR-DISCIP) ]
```

1. **Random Geofence Verification Challenges:**
   - During standard shift hours, the background service triggers 1–2 automated, randomized micro-challenges to the employee's registered mobile device.
   - The employee receives a notification: *"Workplace Presence Verification: Confirm your location within 60 seconds"*.
   - A single tap verifies that device coordinates are within the authorized 200m facility radius. Failure to respond or geofence failure flags the shift as **Suspicious Departure**.
2. **Enterprise Wi-Fi BSSID Network Sniffing:**
   - The attendance client captures the BSSID (MAC address) of the connected office Wi-Fi network.
   - If an employee disconnects from the enterprise access points for more than 45 continuous minutes without an approved field/duty pass, the session logs an **Unauthorized Absence Event**.
3. **Digital Activity Telemetry (Zero-Activity Flagging):**
   - The system cross-references attendance duration with user interactions inside the portal (document approvals, task completions, email interactions, ticket resolutions).
   - Employees who log an 8.0-hour presence with **zero digital actions or workstation telemetry** are automatically highlighted on the HR Exception Report.
4. **Mandatory Mid-Day Break Clocking:**
   - Organizations can configure a mandatory lunch break window (e.g., 12:00 PM – 2:00 PM).
   - Staff must punch out for lunch and punch back in at the lobby kiosk. Unpaired punches or departures exceeding 60 minutes automatically calculate salary deductions.
5. **Supervisor Digital Floor Muster Spot-Checks:**
   - Department supervisors have access to a real-time **Floor Presence Manifest** showing who is currently logged in as "Present".
   - Supervisors can initiate a surprise 5-minute digital spot-check. If a desk is vacant without justification, the manager clicks `[ Mark Absent on Spot-Check ]`, immediately locking the day's record.
6. **Automated Disciplinary Escalation & Show-Cause Issuance:**
   - If an employee accumulates 2 unverified absences or truancy flags within a 30-day cycle, the system automatically drafts a formal **Show-Cause & Disciplinary Notice** (`LTR-DISCIP`) via Module 17.
   - The notice specifies the timestamps, missing geofence challenges, and Wi-Fi disconnect times, requiring a written explanation within 48 hours under General Orders.

---

## 11. Module 9: Lobby Kiosk Mode, Rotating QR Tokens & Emergency Muster Roll

### 11.1 Overview
Transforms any standard tablet or wall-mounted monitor into a touch-free lobby clocking terminal.

### 11.2 Access Route
- **Kiosk Mode:** Available under the **Lobby Kiosk** tab on `:5174` or within the Kiosk Dialog on `:5173/attendance`.

### 11.3 Dynamic Rolling TOTP Security & Registered Device Enforcement
To eliminate "buddy punching" (where staff send photos of a static QR code to colleagues):
1. **15-Second Refresh Window:** The kiosk generates a cryptographic Time-based One-Time Password (TOTP) token that refreshes automatically every 15 seconds with a countdown progress ring.
2. **One-Time Token Burning:** Once a token is scanned and verified by an employee, it is immediately invalidated in the server memory cache.
3. **Device Signature Validation:** The scan must originate from the employee's pre-registered mobile phone. Any scan submitted from an unauthorized device or emulator is blocked.

### 11.4 Emergency Evacuation Muster Roll
In the event of a fire, earthquake, or emergency evacuation, designated safety wardens can click `[ Print Muster Roll (Emergency) ]` on the Staff Presence screen to generate an immediate, printable manifest of every employee verified on-premises today, including:
- Legal Employee Name & ID
- Department & Reporting Unit
- Exact Clock-In Timestamp
- Verification Method (e.g., *HQ Main Lobby Kiosk*, *North Turnstile*, *Dual-Iris Scanner*)
- Emergency Contact Telephone Number

---

## 12. Module 10: Comprehensive Leave Operations & Statutory Holiday Ledger

### 12.1 Overview
Governs leave entitlement calculations, multi-tier supervisory endorsements, operational coverage reviews, and statutory public holiday accounting.

### 12.2 Access Route
- **Leave Management Portal:** `/leave`

### 12.3 Leave Categories & Policy Rules

| Leave Category | Standard Annual Entitlement | Documentation Required | Carry-Over Policy |
| :--- | :--- | :--- | :--- |
| **Recreation / Annual** | 18–24 Working Days (Tenure-Based) | None (Planned 14 days in advance) | Max 10 days to subsequent year |
| **Sick Leave** | 15 Working Days per Annum | Medical Certificate for absences >2 days | Non-accumulative |
| **Compassionate / Bereavement** | 5 Working Days per Event | Death Notice / Funeral Program | Event-specific |
| **Maternity Leave** | 12 Weeks (Paid as per General Orders) | Official Medical Expectancy Certificate | Event-specific |
| **Paternity Leave** | 5 Working Days | Birth Certificate Notification | Event-specific |
| **Study & Exam Leave** | Discretionary (Up to 10 Days) | Accredited Institution Exam Schedule | Academic Year Only |
| **Leave Without Pay (LWOP)**| Discretionary (Max 12 Months) | Formal Ministerial / Executive Justification | Accruals frozen during term |

### 12.4 Step-by-Step: Requesting Leave
1. Navigate to **Leave Operations** (`/leave`).
2. Review your personal **Available Balance Cards** displayed across all categories.
3. Click `[ Apply for Leave ]`.
4. Select the **Leave Type**, **Start Date**, and **End Date**.
5. The system automatically computes net working days, excluding weekends and official public holidays.
6. Designate an acting staff member for duty handover if required.
7. Attach supporting medical or institutional documentation if applicable.
8. Click `[ Submit Request ]`. The request routes automatically to your supervisor for first-line endorsement.

---

## 13. Module 11: Employment Contract Lifecycle Management & Expiry Alerts

### 13.1 Overview
Maintains complete oversight of all employment agreements, fixed-term appointments, and professional consultancies, mitigating the risk of unauthorized contract lapse.

### 13.2 Access Routes
- **Contracts Register:** `/contracts`
- **Draft New Contract:** `/contracts/new`
- **Contract Agreement Dossier:** `/contracts/:id`

### 13.3 Automated Expiry Escalation Matrix
The system runs background checks every 6 hours and triggers notifications at critical contract milestones:

```
[ 90 DAYS PRIOR ] ---> Alert sent to HR Officer: Initiate performance & tenure review
        |
[ 60 DAYS PRIOR ] ---> Notification to Department Manager: Submit renewal recommendation
        |
[ 30 DAYS PRIOR ] ---> Urgent Escalation to Executive Director: Approve renewal or issue exit notice
        |
[ 0 DAYS (EXPIRY) ] ---> Contract status updates to "Expired"; system prevents unauthorized renewals
```

### 13.4 Drafting & Issuing Contracts
1. Navigate to `/contracts/new`.
2. Select the Employee from the searchable directory.
3. Choose the **Contract Type**: *Permanent Public Service Appointment*, *Fixed-Term Performance Agreement*, *Executive Contract*, or *Specialist Consultant*.
4. Input Effective Start Date, Expiry Date, Salary Band, Performance Allowance, and Applicable Notice Periods.
5. Upload or generate the legal agreement PDF.
6. Submit for digital signing and archival.

---

## 14. Module 12: Employee Induction & Structured Onboarding Workflows

### 14.1 Overview
Ensures every new hire is systematically provisioned with institutional equipment, security credentials, statutory training, and departmental briefings.

### 14.2 Access Route
- **Onboarding Coordination:** `/onboarding`

### 14.3 Multi-Departmental Onboarding Checklist

```
+--------------------------------------------------------------------------------------------------+
| PHASE 1: Human Resources Induction                                                               |
| [x] Employment Agreement & Code of Ethics Signed                                                |
| [x] Tax Identification Number (TIN) & Superannuation Registered                                 |
| [x] Official Bank Account Details Captured for Payroll                                           |
+--------------------------------------------------------------------------------------------------+
| PHASE 2: Information Technology (IT) Provisioning                                                |
| [x] Enterprise Email Account Created (username@institution.gov)                                  |
| [x] Access Permissions & Security Groups Configured                                              |
| [x] Workstation / Laptop Issued & Asset Tag Registered                                          |
| [x] Multi-Factor Authentication Configured                                                        |
+--------------------------------------------------------------------------------------------------+
| PHASE 3: Facilities, Security & Workplace Setup                                                  |
| [x] Physical Access Card / Biometric Turnstile Enrollment                                        |
| [x] Office Desk, Telephone Extension & Stationery Allocated                                      |
| [x] Workplace Health & Safety (WHS) Emergency Briefing Completed                                |
+--------------------------------------------------------------------------------------------------+
```

---

## 15. Module 13: Separation Governance, Asset Recovery & Offboarding Clearance

### 15.1 Overview
Ensures that employee resignations, retirements, contract expirations, or terminations are handled with complete legal compliance, asset recovery, and security de-provisioning.

### 15.2 Access Route
- **Offboarding Operations:** `/offboarding`

### 15.3 The 4-Way Clearance Workflow
Before final severance or entitlements are disbursed, the system requires four independent digital sign-offs:

| Clearance Department | Items Verified & Reclaimed | Authorized Signatory | Blocking Condition |
| :--- | :--- | :--- | :--- |
| **Departmental / Operational** | Working files, project handovers, keys, stamps | Department Head / Unit Supervisor | Yes (Blocks IT step) |
| **ICT Services** | Laptop, monitor, VPN token, software licenses | IT Infrastructure Lead | Yes (Blocks Finance) |
| **Finance & Assets** | Outstanding travel advances, corporate credit card | Chief Financial Officer | Yes (Blocks Final Payout) |
| **Human Resources** | Exit interview, Certificate of Service, leave payout | Director of Human Resources | Final Authority |

---

## 16. Module 14: Performance Management, Competency Scoring & Appraisals

### 16.1 Overview
Manages institutional performance appraisal cycles, objective setting, mid-year reviews, and year-end performance scoring.

### 16.2 Access Route
- **Performance Management:** `/performance`

### 16.3 Appraisal Sections & Weightings
- **Section A: Strategic Key Result Areas (KRAs) (50% Weight):** Direct evaluation of quantitative operational deliverables assigned at cycle commencement.
- **Section B: Attendance, Reliability & General Orders Compliance (20% Weight):** Synchronized directly from Module 8 (Smart Attendance records and punctuality scorecards).
- **Section C: Public Sector Core Competencies & Integrity (20% Weight):** Behavioral ratings covering ethical governance, teamwork, and accountability.
- **Section D: Innovation, Leadership & Continuous Improvement (10% Weight):** Contributions to institutional modernization and process efficiency.

### 16.4 Performance Rating Scale & Recommended Actions

| Score Range | Performance Band | Description | Incremental Reward / Action |
| :---: | :--- | :--- | :--- |
| **90 – 100%** | **Outstanding (Grade 1)** | Substantially exceeds all objectives and demonstrates exceptional leadership. | Priority for promotion, merit bonus, international training nomination. |
| **75 – 89%** | **Commendable (Grade 2)** | Fully meets and frequently exceeds operational deliverables. | Standard salary increment, commendation certificate. |
| **60 – 74%** | **Competent (Grade 3)** | Meets all core operational targets with acceptable diligence. | Maintained tenure, standard annual review. |
| **45 – 59%** | **Marginal (Grade 4)** | Inconsistent performance; fails key indicators without valid justification. | Placed on 90-day Performance Improvement Plan (PIP). |
| **Below 45%** | **Unsatisfactory (Grade 5)** | Persistent operational non-performance or misconduct. | Formal show-cause notice; potential tenure termination. |

---

## 17. Module 15: Professional Development, Training Catalog & Certifications

### 17.1 Overview
Maintains the institutional training course repository, coordinates nominations, tracks attendance, and preserves professional credentials.

### 17.2 Access Route
- **Training & Skills Hub:** `/training`

### 17.3 Core Capabilities
- **Course Catalog:** Search internal and external training programs categorized by Technical Skills, Public Sector Leadership, Compliance/Safety, and Project Management.
- **Supervisor Nomination:** Department managers can nominate subordinate staff members for upcoming courses with operational justification.
- **Certification Vault:** Staff upload digital certificates upon completion; the system tracks certificate renewal dates and triggers alerts prior to credential expiration.

---

## 18. Module 16: Staff Benefits, Allowances & Property Housing Allocation

### 18.1 Overview
Governs non-salary compensation, statutory superannuation contributions, medical insurance tiers, and institutional housing waitlists.

### 18.2 Access Routes
- **Benefits Administration:** `/benefits`
- **Institutional Housing Register:** `/housing`

### 18.3 Housing Priority Scoring Algorithm
To prevent favoritism and maintain transparent public sector governance, housing requests are scored objectively:

| Evaluation Factor | Weight | Scoring Logic |
| :--- | :---: | :--- |
| **Tenure of Continuous Service** | 30% | 3 points per full year of active service (Max 30 points) |
| **Official Salary Band & Grade** | 25% | Graded scale according to official executive schedule |
| **Operational Criticality** | 25% | Emergency responders, critical laboratory officers, and shift supervisors |
| **Family Size / Dependents** | 20% | Verified dependents registered on master personnel record |

---

## 19. Module 17: Central Document Vault, HR Letter Generation & Digital Stamps

### 19.1 Overview
A secure, centralized document repository integrated with an automated personnel letter generator that applies digital signatures and verification stamps.

### 19.2 Access Routes
- **Enterprise Document Vault:** `/documents`
- **Official HR Letter Generator:** `/hr-letters`

### 19.3 Automated Personnel Letter Templates

| Letter Template Type | Template Code | Required Approver | Cryptographic Seal Applied |
| :--- | :--- | :--- | :---: |
| **Letter of Formal Appointment** | `LTR-APPOINT` | Managing Director / Executive | Yes (Blue Seal) |
| **Confirmation of Permanent Tenure** | `LTR-CONFIRM` | Director of Human Resources | Yes (Blue Seal) |
| **Promotion & Salary Advancement** | `LTR-PROMOT` | Executive Panel | Yes (Gold Seal) |
| **Inter-Divisional Transfer Directive** | `LTR-TRANSF` | Director of Human Resources | Yes (Standard Seal) |
| **Show-Cause & Disciplinary Notice** | `LTR-DISCIP` | Legal Counsel & HR Director | Yes (Restricted Seal) |

### 19.4 Digital Signature & Verification Features
Generated letters include:
- **Digital Security Stamp:** High-resolution graphic seal displaying the institution's official verification metadata.
- **Signatory Name & Timestamp:** Cryptographically logged date/time of signature.
- **Unique Verification Code:** Distinct reference string (e.g., `DOC-VER-2026-9932`) allowing any third party to verify document authenticity.

---

## 20. Module 18: Real-Time Enterprise Messaging & Collaboration

### 20.1 Overview
An encrypted, internal instant messaging system designed to keep teams connected without relying on consumer chat applications.

### 20.2 Access Route
- **Enterprise Messaging:** `/messages`

### 20.3 Key Capabilities
- **Direct & Departmental Channels:** 1-on-1 private messaging and department-wide broadcast channels.
- **Presence Status:** Displays real-time status indicators (*Online*, *Away*, *Offline*).
- **Secure File Sharing:** Attach images, PDF memos, and spreadsheets directly within chat conversations.
- **Unread Notification Badges:** Real-time counters in the top navigation bar alert users to incoming messages.

---

## 21. Module 19: Custom Report Generator & Data Extraction Engine

### 21.1 Overview
Allows HR analysts and executive officers to query, filter, and extract complex datasets across all modules into standardized export formats.

### 21.2 Access Route
- **Custom Report Builder:** `/reports`

### 21.3 Pre-Built & Custom Report Categories
- **Master Staff Census Report:** Complete personnel breakdown by department, grade, tenure, age, and gender.
- **Attendance & Punctuality Audit:** Detailed timesheet records showing clock-in/out timestamps, tardiness minutes, and GPS verification status.
- **Leave Liability Statement:** Current outstanding recreation leave balances with calculated monetary liabilities for financial audits.
- **Recruitment SLA Compliance:** Turnaround times across job requisition creation, candidate shortlisting, and final offer issuance.
- **Export Formats:** Direct export to **Comma Separated Values (CSV)**, **Microsoft Excel (.xlsx)**, and **Print-Ready PDF**.

---

## 22. Module 20: System Administration, Access Grants & Audit Logs

### 22.1 Overview
Provides system administrators with granular user provisioning, permission management, session monitoring, and audit log inspection.

### 22.2 Access Routes
- **User Management & RBAC:** `/users`
- **Security & Audit Logs:** Accessible within `/users` and `/reports`

### 22.3 Audit Logging & Security Event Catalog

| Event Category | Logged Events | Security Metadata Captured | Retention Policy |
| :--- | :--- | :--- | :--- |
| **Authentication Events** | Login success, failed password, account lockout, logout | User ID, IP Address, User Agent, Timestamp | 7 Years (Statutory) |
| **Personnel Profile Edits** | Salary change, grade change, termination, promotion | Actor ID, Target ID, Before Value, After Value | Permanent Ledger |
| **Access Grants & RBAC** | Role reassignment, permission grant, password reset | Administrator ID, Target Account, Timestamp | Permanent Ledger |
| **Data Exports** | CSV census export, payroll summary, attendance dump | Requester ID, Filter Parameters, Row Count | 5 Years |

---

## 23. Module 21: Integration Builder, Webhooks & Payroll Interoperability

### 23.1 Overview
Connects the HR platform with external institutional systems, including centralized government payroll systems, financial ledgers, and third-party biometric terminals.

### 23.2 Access Route
- **Integration Builder:** `/integration-builder`

### 23.3 Interoperability Capabilities
- **Outbound Webhooks:** Configure HTTP POST webhooks triggered by specific platform events.
- **Inbound Biometric API:** Secure endpoints accepting standardized JSON punch payloads from physical turnstiles using unique device API keys (`X-Device-Key`).
- **Payroll Export Interface:** Generate fortnightly attendance punch summaries structured for direct import into government payroll software.

### 23.4 Supported Webhook Event Types

| Event Identifier | Trigger Condition | JSON Payload Content |
| :--- | :--- | :--- |
| `employee.created` | New personnel dossier established | Employee ID, Legal Name, Department, Grade, Appointment Date |
| `employee.terminated` | Formal separation clearance finalized | Employee ID, Separation Date, Separation Reason, Exit Clearance ID |
| `attendance.punch` | Biometric or GPS clock-in recorded | Punch ID, Employee ID, Timestamp, Channel, GPS Coords, Verification Status |
| `leave.approved` | Final supervisory approval granted | Leave Request ID, Employee ID, Leave Type, Start Date, End Date, Days |
| `contract.expiring` | Contract crosses 90/60/30-day threshold | Contract ID, Employee ID, Expiry Date, Days Remaining |

---

## 24. Operational Troubleshooting & Comprehensive FAQ

### Q1: An employee is unable to log in and sees an "Account Locked" notification. How is this resolved?
> **Answer:** The account was locked automatically following 5 consecutive incorrect password entries. It will unlock automatically after 30 minutes. An administrator can unlock the account immediately by navigating to **User Management** (`/users`), searching for the user, and clicking `[ Unlock Account & Reset Attempts ]`.

### Q2: Why does a mobile clock-in show "Outside Perimeter (Field Mode)" when the staff member is at the office?
> **Answer:** The device's GPS accuracy was greater than the authorized 200-meter radius, or device location permissions are disabled. Ensure the device has high-accuracy location services enabled. If conducting approved offsite work, the employee can proceed with clocking in and describe their activity in the **Duty Notes** field.

### Q3: How do safety wardens print an emergency muster roll during an evacuation?
> **Answer:** Open the **Smart Attendance App** (`:5174`) on any device, navigate to the **Staff Presence** tab, and click `[ Print Muster Roll (Emergency) ]`. This generates an immediate, printable list of all personnel verified on-premises today with emergency contact numbers.

### Q4: How does a supervisor approve a subordinate's leave application?
> **Answer:** The supervisor receives a notification in the portal. Navigate to **Leave Operations** (`/leave`), select the **Pending Approvals** tab, review the request details and leave balance, and click `[ Endorse & Approve ]` or `[ Decline with Justification ]`.

### Q5: How do I generate an official personnel letter with a digital verification stamp?
> **Answer:** Navigate to **HR Letters** (`/hr-letters`), click `[ Generate New Letter ]`, select the appropriate template (e.g., *Permanent Appointment*), choose the target employee, verify contract terms, enable **Apply Digital Seal & Stamp**, and click `[ Generate Letter ]`. The signed document is stored in the vault and available for immediate PDF download.

---

*Enterprise Workforce & Human Resource Management Platform — Technical Operations Manual v1.0*
