# PNG NISIT HR Portal
## AI-Enabled Government Recruitment & Workforce Management Platform

**Prepared for:** Stakeholders, Partners & Client Agencies
**Version:** 1.0
**Date:** April 2026

---

## 1. Executive Summary

The PNG NISIT HR Portal is a secure, multi-tenant recruitment and workforce management platform purpose-built for Papua New Guinea government agencies. It modernises the entire hiring lifecycle — from public job advertising through to employee onboarding and contract management — while applying AI to reduce manual screening effort and improve decision quality.

The platform consolidates what is typically managed across spreadsheets, email inboxes and disparate tools into a single auditable system, with role-based access, full data isolation between agencies, and government-grade audit logging.

---

## 2. Who It Is For

| Audience | Primary Benefit |
|---|---|
| **Government Agencies (HR Teams)** | Streamlined hiring, less paperwork, defensible audit trails |
| **Hiring Managers** | Faster shortlists, AI-ranked candidates, better interview prep |
| **Executive Leadership** | Real-time workforce visibility, attrition forecasting |
| **System Administrators** | Multi-tenant control, integrations, compliance reporting |
| **Job Applicants (Public)** | Modern, mobile-friendly application experience |

---

## 3. Key Feature Highlights

### 3.1 Public Career Portal & Application Wizard
- Branded public landing page listing all open vacancies across participating agencies
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

### 3.7 Multi-Tenant Agency Support
- Strict data isolation between agencies (jobs, applications, employees, documents)
- Agency-specific branding and configuration
- Cross-tenant candidate profile (applicants apply once, can be considered by multiple agencies)
- Per-agency administrators with scoped access

### 3.8 Role-Based Access Control (RBAC)
- **System Admin** — full oversight, multi-tenant management, integrations
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
| **Setup for PNG Government** | Generic, requires customisation | Built specifically for PNG agencies |
| **AI Screening** | Add-on or absent | Built-in CV parsing, ranking, interview prep |
| **Multi-Agency Isolation** | Usually single-tenant | Native multi-tenant from day one |
| **Audit Logging** | Often partial | Comprehensive, with reason capture |
| **Public Application UX** | Long, single-page forms | Modern 8-step wizard with auto-save |
| **Offer Letter Workflow** | Manual Word documents | Branded PDF, tracked, one-click send |
| **Notifications** | Bulk, no opt-out | Per-user controls, RFC 8058 unsubscribe |

---

## 5. Security & Compliance

- Encrypted secrets and credentials via managed environment variables
- Tenant-scoped data access enforced at the API layer
- All sensitive document operations recorded with actor, timestamp and reason
- Role-based access enforced on every endpoint
- Rate limiting and signed tokens on public-facing actions (e.g. unsubscribe)
- Object storage with per-tenant ACLs

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

---

## 8. Contact

For demonstrations, onboarding, or partnership enquiries, please contact the PNG NISIT HR Portal team.

---

*This document is intended for stakeholder distribution. Feature availability may vary by deployment configuration and agency subscription tier.*
