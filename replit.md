# AI-Enabled Government HR Recruitment & Workforce Management Portal

## Overview

This project is a full-stack monorepo for an AI-powered Government HR portal designed for recruitment and workforce management. Its primary purpose is to streamline HR processes for government agencies, starting with the PNG National Institute of Standards and Industrial Technology (NISIT). The multi-tenant architecture allows for broad adoption across various government bodies, enhancing efficiency and modernizing HR operations. Key capabilities include AI-driven CV parsing, candidate ranking, interview question generation, and workforce predictions, alongside comprehensive modules for job vacancy management, application tracking, employee records, and contract lifecycle management. The vision is to provide a robust, scalable, and intelligent platform that supports effective human capital management within the public sector.

## User Preferences

- I prefer clear and concise communication.
- Focus on high-level solutions and architectural decisions.
- Use best practices for code structure and maintainability.
- If an existing function or method fits the requirement, use it rather than creating a new one.

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Technology Stack:**
- **Node.js**: 24
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)
- **Frontend**: React + Vite

**UI/UX Decisions:**
- **Landing Page**: Public job listings with search, department/employment type filters, PNG flag-colored hero, NISIT "N" logo, redesigned job cards with department color accents and closing-date indicators.
- **Dashboard**: KPI cards (open vacancies, applications, employees, expiring contracts), recruitment pipeline bar chart, workforce gaps visualization, contract expiry table.
- **Application Workflow**: 9-step wizard for job applications, including AI auto-fill from CVs and draft save/resume functionality. PNG-specific nationality and province dropdowns are included.
- **Notifications**: In-app notification bell polls every 30s, shows unread badge, dropdown with mark-as-read features, and type icons (application status, contract expiry).

**Core Features & Technical Implementations:**
- **AI Integration**: Utilizes Replit AI (OpenAI proxy `gpt-5-mini`) for CV parsing, candidate ranking, interview question generation, and workforce predictions. Auto CV parsing occurs upon application submission.
- **Multi-Tenancy**: Implemented via `agencyId` scoping for all authenticated requests, ensuring data isolation between government agencies. `admin` roles are agency-specific, not super-admins.
- **Role-Based Access Control (RBAC)**: JWT-based with `requireRole` middleware enforcing specific permissions for `admin`, `hr_officer`, `hiring_manager`, `executive`, and `applicant` roles.
- **Object Storage**: Replit Object Storage (Google Cloud Storage) is used for secure handling of CV and document uploads (max 10 MB, PDF/DOC/DOCX). Presigned URLs facilitate direct client-to-storage uploads.
- **API Modules**: Comprehensive set of RESTful APIs covering authentication, agency/department/position management, job vacancies, candidates, applications, employees, contracts, AI services, and integrations. All response fields are camelCase.
- **Notification System**: In-app notifications are triggered by application status changes and contract expiry alerts.
- **Integration Builder**: Admin-only interface for configuring connections to external PNG government systems (e.g., IFMIS, Identity Verification) with AI-powered field mapping suggestions.
- **Database Schema**: Centralized `lib/db/src/schema/` defines tables for agencies, roles, users, departments, positions, jobs, candidates (with detailed sub-records like education, experience), applications, employees, contracts, AI scores, notifications, and integration configurations/logs.
- **Seeding**: Automatic server seeding provides initial default roles, NISIT agency data, departments, job vacancies, candidate profiles, applications, employees, and contracts, with idempotency guards to prevent duplicate data.

## External Dependencies

- **PostgreSQL**: Primary relational database.
- **Replit AI Integration (OpenAI)**: Used for AI capabilities like CV parsing, candidate ranking, interview question generation, and workforce predictions.
- **Google Cloud Storage (via Replit Object Storage)**: For storing uploaded CVs and other documents.
- **External PNG Government Systems**: Integration capabilities for systems like IFMIS, Exam Verification, Identity Verification, and LMS (via configurable connectors).