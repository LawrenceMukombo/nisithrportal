# PAPUA NEW GUINEA NATIONAL INSTITUTE OF STANDARDS & INDUSTRIAL TECHNOLOGY (NISIT)
## ENTERPRISE HR & RECRUITMENT MANAGEMENT PORTAL
### Comprehensive Requirements Gathering & Discovery Checklist (v1.0)

---

## 1. Executive Summary & Document Purpose

The purpose of this document is to serve as the definitive **Requirements Gathering, Discovery, and Gap-Analysis Checklist** for the **PNG NISIT HR & Recruitment Management Portal**. It provides institutional stakeholders, HR directors, technical officers, hiring managers, and system administrators with a structured methodology to validate functional coverage, regulatory compliance, statutory document workflows, and operational readiness before deploying system releases.

---

## 2. Institutional Context & Stakeholder Matrix

| Stakeholder Group | Primary Role & Responsibilities | Key Portal Touchpoints |
| :--- | :--- | :--- |
| **Executive Directorate (ED / Board)** | Strategic oversight, executive approvals, high-level workforce metrics, final appointment endorsements. | Executive Brief, Analytics Dashboard, Document Sign-off |
| **HR Directorate & Officers** | Core portal administration, job vacancy publishing, application screening, contract management, employee records, onboarding/offboarding. | Recruitment Pipeline, Employee Master, Statutory Documents, Role Permissions |
| **Hiring Managers / Technical Panels** | Technical job requisition, candidate evaluation, interview scoring, applicant shortlisting. | Job Requisitions, Candidate Shortlisting, Scoring Matrices |
| **Institutional Staff** | Internal peer collaboration, document access, leave requests, directory lookups. | Secure Messenger, Staff Directory, My Profile |
| **External Job Applicants** | Public career browsing, self-registration, resume uploading, application tracking. | Public Careers Portal, Candidate Dashboard |
| **System Administrators & ICT Team** | Server infrastructure, database backups, audit monitoring, user lifecycle, RBAC enforcement. | User Management, Audit Log, System Settings |

---

## 3. Core Functional Requirements Checklist

### Module A: Organizational Hierarchy & Position Control
- [ ] **Institutional Structure Definition**: Ability to define PNG NISIT divisions (e.g., Standards Division, Metrology & Testing, Quality Assurance, Corporate Services, Executive).
- [ ] **Position Budgeting & Headcount**: Established position numbers, approved headcount caps, and vacant vs. occupied tracking.
- [ ] **Salary Grade Bands**: PNG Public Service salary scales, allowances, and step increments.
- [ ] **Reporting Hierarchy**: Dynamic reporting lines for line managers, division heads, and executive directors.

### Module B: Job Vacancy & Requisition Management
- [ ] **Job Drafting & Approval**: Multi-step wizard to create vacancies with salary bands, qualifications, duties, and closing dates.
- [ ] **Drafting & Saving State**: Capacity to save drafts mid-flow without loss of entered form data.
- [ ] **Public Portal Visibility**: Granular status control (`draft`, `published`, `closed`, `archived`) with instant live career page updates.
- [ ] **PNG Public Service Gazette Compliance**: Gazette notice numbers, reference IDs, and statutory publication dates.

### Module C: Applicant Intake & Recruitment Workflow Pipeline
- [ ] **Public Application Intake**: Frictionless candidate application with CV, educational credentials, and police clearance attachments.
- [ ] **Recruitment Pipeline Stages**:
  - [ ] Stage 1: New Submission / Intake
  - [ ] Stage 2: HR Initial Screening & Eligibility Check
  - [ ] Stage 3: Technical Panel Shortlisting
  - [ ] Stage 4: Panel Interview Scheduling & Structured Scoring
  - [ ] Stage 5: Executive Offer Issuance
  - [ ] Stage 6: Formal Appointment & Hiring Conversion
- [ ] **Stage-Specific Permissions**: Enforced RBAC ensuring only authorized personnel can advance, reject, or hire candidates.
- [ ] **Automated Candidate Communications**: Stage-triggered email notifications (Receipt of application, Shortlist notice, Interview invite, Regret letter).

### Module D: Digital Signing, Official Stamping & Verification
- [ ] **Digital Signature Modals**: Multi-mode signing capabilities (Drawn canvas, Typed font signature, Uploaded secure cryptographic image).
- [ ] **Institutional Seal / Official NISIT Stamp**: Stamping overlay with timestamp, verification code, and signer credentials.
- [ ] **Role-Gated Signing Delegation**: Granular permissions (`documents.sign`, `documents.stamp`) restricted to Executive Director and designated HR Officers.
- [ ] **Verification QR / Reference Code**: Tamper-evident verification hash on generated PDFs to validate authenticity.

### Module E: Employee Records, Lifecycle & Contracts
- [ ] **Comprehensive Personnel Profiles**: Full demographics, contact details, emergency contacts, National Identity (NID) / Passport numbers.
- [ ] **Contract Lifecycle Management**: Employment start/end dates, renewal alerts (90, 60, 30-day triggers), probationary reviews.
- [ ] **Digital Onboarding Checklist**: Statutory forms, IT asset allocation, security badges, orientation milestones.
- [ ] **Offboarding & Clearances**: Exit interviews, asset recovery, final clearance certifications, access revocation.

### Module F: Statutory Document Generation & Repository
- [ ] **Standardized Templates**:
  - [ ] Formal Letter of Offer (Contractual)
  - [ ] Confirmation of Permanent Appointment
  - [ ] Acting Appointment / Departmental Transfer
  - [ ] Disciplinary & Performance Improvement Notice
  - [ ] Certificate of Service / Exit Reference
- [ ] **Template Variable Merge**: Automatic population of candidate name, salary, grade, division, and effective dates.
- [ ] **Versioned Document Repository**: Permanent audit trail of all signed contracts and statutory correspondence.

### Module G: Internal Staff Collaboration (WhatsApp-Style Messenger)
- [ ] **Real-Time 1-on-1 & Group Messaging**: Fast, encrypted communication across NISIT personnel.
- [ ] **Categorized Emoji Library**: Complete WhatsApp-style categorized emoji drawer (Smileys, People, Nature, Food, Work, Symbols) and quick reaction bar.
- [ ] **In-Chat Message Search**: Real-time keyword filtering, match counter (`X of Y`), and jump-to-match auto-scrolling.
- [ ] **Audio & Video Calling**: Secure NISIT video conference and voice calling interfaces with mute, camera, screen share, and call logging.
- [ ] **Rich Attachments**: Document sharing (PDF, Word, Excel), image gallery with lightbox, colleague contact cards, and team polls.
- [ ] **Human-Readable Roles**: Display clean titles (`HR Officer`, `System Administrator`) instead of raw technical slugs.

### Module H: Executive Brief & Workforce Analytics
- [ ] **KPI Summary Cards**: Total headcount, active vacancies, pending applications, expiring contracts, monthly payroll estimate.
- [ ] **Recruitment Funnel Analytics**: Time-to-hire, stage-by-stage drop-off rates, applicant source demographics.
- [ ] **Interactive Cross-Filtering**: Dynamic filtering by Division, Position Grade, Status, and Date ranges.
- [ ] **Export Capabilities**: Clean CSV, Excel, and PDF export for executive board reports.

---

## 4. Security, RBAC & Compliance Checklist

| Requirement Area | Specification / Standard | Status |
| :--- | :--- | :---: |
| **Authentication & Tokens** | JWT with version tracking (`tokenVersion`), secure token invalidation on password reset or profile modification. | Passed |
| **Government Email Enforcement** | Administrative and HR roles require `@nisit.gov.pg` or approved organizational domains. Public applicants isolated to personal domains. | Passed |
| **Role-Based Access Control (RBAC)** | Role permissions matrix with granular resource actions (`Create`, `View`, `Edit`, `Delete`, `Review`, `Digital Sign`, `Official Stamp`). | Passed |
| **Immutable Audit Logging** | Dedicated logging of all security events, role updates, stage progressions, document deletions, and logins with actor ID, IP, and timestamp. | Passed |
| **Data Protection & Zero-Wipe** | Non-destructive database operations only (UPSERT / insert-if-not-exists). Strictly no truncation, drops, or overwrites. | Passed |

---

## 5. Stakeholder Discovery Questionnaire

### For HR Directorate:
1. What specific salary grade bands and allowance structures are currently active at PNG NISIT?
2. What are the mandatory clearance documents required before a candidate can be transitioned to "Hired"?
3. Who holds statutory authority to apply the NISIT Official Stamp on contracts and appointment letters?
4. What is the standard escalation timeline for stalled job applications (e.g. 14 days without stage progress)?

### For Hiring Managers & Technical Panels:
1. What evaluation scoring criteria and weighting (1–5 scale) should be applied for technical interview scorecards?
2. How many panel members are typically required to reach consensus on shortlisting?
3. What standard pre-screening questions should be included on technical job postings?

### For ICT & Infrastructure Team:
1. What are the backup retention schedules for PostgreSQL database dumps and uploaded PDF documents?
2. Are external SMTP credentials configured for automated email alerts and password reset links?
3. What are the uptime and failover requirements for the production Hostinger VPS environment?

---

## 6. Verification & Sign-Off Matrix

| Milestone Phase | Target Output | Lead Stakeholder | Sign-off Date | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Discovery & Scoping** | Approved Requirements Checklist | HR Director | — | Pending Review |
| **Phase 2: UI/UX & Workflow Validation** | Interactive Feature Walkthrough | Executive Directorate | — | In Progress |
| **Phase 3: Security & RBAC Audit** | Penetration & Access Matrix Test | Head of ICT | — | Verified |
| **Phase 4: UAT & Staging Deployment** | Candidate to Hire Trial Run | HR Operations Panel | — | Queued |
| **Phase 5: Production Go-Live** | Live Deployment on Hostinger VPS | Lead DevOps Engineer | — | Live (`srv1061051`) |

---
*Document prepared for Papua New Guinea National Institute of Standards & Industrial Technology (NISIT).*
