# PNG NISIT HR Portal
## AI-Enabled Recruitment & Workforce Management Platform

**Prepared for:** PNG NISIT Stakeholders, Partners & Clients
**Version:** 1.1
**Date:** April 2026
**Deployment Mode:** Single-tenant — exclusively for the Papua New Guinea National Institute of Standards and Industrial Technology (PNG NISIT)

---

## 1. Executive Summary

The PNG NISIT HR Portal is a secure recruitment and workforce management platform purpose-built and exclusively deployed for the Papua New Guinea National Institute of Standards and Industrial Technology (PNG NISIT). It modernises the entire hiring lifecycle — from public job advertising through to employee onboarding and contract management — while applying AI to reduce manual screening effort and improve decision quality.

The platform consolidates what is typically managed across spreadsheets, email inboxes and disparate tools into a single auditable system, with role-based access and government-grade audit logging.

> **Single-tenant deployment.** This release of the platform is locked to PNG NISIT. All jobs, applications, candidates, employees and contracts in the system belong to NISIT. The underlying architecture supports multi-agency operation and can be re-enabled in a future phase if PNG NISIT chooses to extend the platform to partner agencies.

---

## 2. Who It Is For

| Audience | Primary Benefit |
|---|---|
| **PNG NISIT HR Team** | Streamlined hiring, less paperwork, defensible audit trails |
| **PNG NISIT Hiring Managers** | Faster shortlists, AI-ranked candidates, better interview prep |
| **PNG NISIT Executive Leadership** | Real-time workforce visibility, attrition forecasting |
| **System Administrators** | User & integration management, compliance reporting |
| **Job Applicants (Public)** | Modern, mobile-friendly application experience for NISIT vacancies |

---

## 3. Key Feature Highlights

### 3.1 Public Career Portal & Application Wizard
- NISIT-branded public landing page listing all open NISIT vacancies
- Filtering by department, location and employment type
- "Save Job" feature with optional closing-soon email reminders (configurable: 3, 7 or 14 days ahead)
- 8-step guided application wizard covering personal details, experience, education, documents, screening questions and legal declarations
- Auto-save drafts so applicants can return and complete later
- Real-time application status tracking for applicants

### 3.2 AI-Assisted Recruitment
- **Automatic CV parsing** — extracts skills, experience and education from PDF and DOCX uploads
- **Candidate ranking** — scores applicants against the specific job description and surfaces best-fit candidates first
- **Interview question generator** — produces targeted questions tailored to the candidate and role
- **Workforce forecasting** — predictive insight into upcoming vacancies and attrition risk

### 3.3 End-to-End Recruitment Workflow
- Job creation, publishing, closing and re-posting
- Configurable screening questions with auto-reject logic for mandatory criteria
- Application pipeline: Applied → Shortlisted → Interview → Offer → Hired / Rejected
- Bulk actions with server-side filter support (operate on entire filter results, not just visible rows)
- Confirmation safeguards on bulk actions, with live match counts before any change is committed
- Internal notes, scoring and tagging

### 3.4 Offer Letters & Contract Management
- Branded PDF offer letter generation
- One-click send to candidate via email, with confirm-before-send safeguards
- Resend protection: warns if an offer letter was sent within the last 24 hours
- Complete send history per application — who sent it, when, and to which email
- Contract lifecycle management (Fixed-term, Permanent, Casual)
- Signed contract upload with reason-tracked replacement and removal
- Automated contract expiry alerts (30 days ahead)

### 3.5 Document Management
- Secure object storage for CVs, cover letters, certificates and signed contracts
- Per-tenant ACL isolation — agencies cannot see each other's documents
- Removed-document audit trail with mandatory reason capture for sensitive removals
- Document version history

### 3.6 Notifications & Communication
- Status-update emails to applicants at each pipeline stage
- Stalled-application alerts to hiring managers (with one-click unsubscribe)
- Saved-job closing-soon reminders (per-user opt-in and frequency control)
- One-click RFC 8058–compliant unsubscribe links (Gmail / Outlook compatible)
- In-app notification bell for HR (new applications, contract expiry, etc.)
- Per-user notification preferences

### 3.7 Single-Tenant Deployment for PNG NISIT
- Platform locked to PNG NISIT — every job, application, employee and contract belongs to NISIT
- All API endpoints enforce the NISIT agency scope server-side, regardless of caller
- Public job board, application portal and admin tools are all branded and scoped to NISIT
- Underlying multi-tenant architecture is preserved in the codebase, allowing PNG NISIT to extend the platform to partner agencies in a future phase without re-engineering

### 3.8 Role-Based Access Control (RBAC)
- **System Admin** — full oversight, user management, integrations
- **HR Officer** — day-to-day recruitment operations and contract administration
- **Hiring Manager** — review shortlists and AI-ranked candidates for their roles
- **Executive Leadership** — workforce analytics and forecasting dashboards
- **Applicant** — self-service public access

### 3.9 Audit & Compliance
- Comprehensive audit trail for every administrative action (logins, status changes, document removals, offer sends, AI ranking clears)
- Searchable, filterable audit log view
- Status-history tracking with the user who made each change
- Reason capture on sensitive operations (document removal, contract replacement)
- Designed to support PNG government PII handling and accountability requirements

### 3.10 Analytics & Reporting
- Vacancy vs. filled-position dashboards
- Recruitment funnel and time-to-hire metrics
- Staff distribution by department, location and employment type
- Workforce forecasting (AI-powered)
- Exportable reports with filter context preserved

### 3.11 Integration Builder
- Configure outbound API connectors without code (Bearer, API Key, custom headers)
- Health monitoring with configurable success-rate thresholds (Healthy / Degraded / Unhealthy)
- Export logs with filtering for troubleshooting and compliance review

### 3.12 Account & Security Features
- Self-service registration and password reset (email-token based)
- JWT-based authentication
- Server-side rate limiting on sensitive endpoints
- Account linking for applicants who registered with different identities
- Session management

---

## 4. Differentiators

| | Traditional HR Systems | PNG NISIT HR Portal |
|---|---|---|
| **Setup for NISIT** | Generic, requires customisation | Built specifically for PNG NISIT |
| **AI Screening** | Add-on or absent | Built-in CV parsing, ranking, interview prep |
| **Audit Logging** | Often partial | Comprehensive, with reason capture |
| **Public Application UX** | Long, single-page forms | Modern 8-step wizard with auto-save |
| **Offer Letter Workflow** | Manual Word documents | Branded PDF, tracked, one-click send |
| **Notifications** | Bulk, no opt-out | Per-user controls, RFC 8058 unsubscribe |
| **Future-proofing** | Locked architecture | Multi-agency capable if NISIT later expands scope |

---

## 5. Security & Compliance

- Encrypted secrets and credentials via managed environment variables
- All data access scoped to PNG NISIT and enforced at the API layer
- All sensitive document operations recorded with actor, timestamp and reason
- Role-based access enforced on every endpoint
- Rate limiting and signed tokens on public-facing actions (e.g. unsubscribe)
- Object storage with access-control policies

---

## 6. Architecture Overview (At a Glance)

- **Frontend** — Modern React single-page application with responsive UI
- **Backend** — Node.js / Express REST API with typed OpenAPI contract
- **Database** — PostgreSQL with versioned migrations
- **Storage** — Cloud object storage for documents
- **AI Layer** — Managed LLM integration for parsing, ranking and forecasting
- **Email** — SMTP delivery with branded templates and unsubscribe headers
- **Hosting** — Cloud-hosted with TLS, automatic scaling, and health checks

---

## 7. Roadmap Themes

- Expanded analytics (diversity reporting, source-of-hire effectiveness)
- Mobile applicant experience enhancements
- Additional integration connectors (payroll, identity providers)
- Advanced workforce planning scenarios
- Localisation for additional languages
- Optional future expansion to partner government agencies (multi-agency mode), should PNG NISIT choose to extend the platform

---

## 8. Contact

For demonstrations, onboarding, or partnership enquiries, please contact the PNG NISIT HR Portal team.

---

*This document is intended for stakeholder distribution. The current release is a single-tenant deployment exclusively for PNG NISIT.*
