# Changelog & Release Version Management

All notable changes, bug fixes, database enhancements, and feature upgrades to the **PNG NISIT Integrated HR Portal** are documented in this file.

---

## [v1.1.0] - 2026-08-19

### 🚀 Major Features & Upgrades
- **Candidate Hub & Applicant Dashboard**: Role-tailored dashboard rendering for applicants featuring live submission metrics, recent application tracking with real-time status pills, and recommended NISIT vacancies.
- **Enterprise Visual Organization Hierarchy (`/org-chart`)**: Multi-tier SVG-connected diagram linking the National Council & Director General down to 8 operational divisions, dynamically showing filled incumbents and vacant position quota badges.
- **Automated Onboarding Engine**: Automatic provisioning of Employee Master Records and standard 7-step onboarding task workflows when candidates are marked `hired` in the recruitment workflow.
- **Offboarding & Separation Protocol**: Multi-reason separation tracking (`contract_end`, `redundancy`, `resignation`, `retirement`, `termination`), clearance checklist tracking, and automatic user account deactivation upon final separation clearance.
- **Statutory Training Catalogue**: ISO/IEC 17025 Laboratory Accreditation, Legal Metrology, PNG National Quality Policy, and Public Sector Ethics courses with self-service enrollment.
- **Hostinger VPS Production Deployment SOP**: Comprehensive standard operating procedure (`DEPLOYMENT_SOP.md`) and idempotent database uplift scripts (`scripts/production_seed_upsert.sql`).

### 🛠️ Bug Fixes & Resilience Enhancements
- **Local Storage Fallback for File Uploads**: Resolved 500 server error on CV and document uploads when Google Cloud Storage is unconfigured by implementing an automatic, zero-dependency local disk storage fallback (`uploads/`).
- **Job Application Submission Validation**: Resolved 422 "Job is not accepting applications" error by adding flexible `jobId` type coercion (`z.coerce.number()`), case-insensitive status matching (`open`, `published`, `active`), and safe timestamp-based closing date verification.
- **Authentication & Login Recovery**: Added safe timestamp parsing and missing `token_version` database column migrations to resolve intermittent login rejections.
- **Training Enrollment Caller Resolution**: Fixed user-to-employee ID resolution to properly associate course enrollments with employee master records.

### 🛡️ Database & Data Safety
- **Policy**: Strictly **UPSERT ONLY** (No wipes, no truncates, no drops, no overwrites).
- All 606 relational seed records exported with explicit `ON CONFLICT ("id") DO UPDATE SET ...` and sequence pointer resets.

---

## [v1.0.0] - 2026-08-18

### Initial Baseline Release
- Initial implementation of Modules 1 through 26 per the NISIT Integrated HR Portal PRD Baseline.
- Role-based Access Control (RBAC) supporting Admin, HR Officer, Hiring Manager, Executive, and Applicant roles.
- Core Employee Master Records, Public Service Grades (Grade 1 to 20), Job Postings, and ATS Recruitment Pipeline.
