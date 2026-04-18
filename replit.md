# AI-Enabled Government HR Recruitment & Workforce Management Portal

## Overview

Full-stack pnpm workspace monorepo for an AI-powered Government HR portal. Initially deployed for the PNG National Institute of Standards and Industrial Technology (NISIT). Multi-tenant architecture allows adoption by other government agencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Replit AI Integration (OpenAI proxy via `@workspace/integrations-openai-ai-server`, model: gpt-5-mini) — CV parsing, candidate ranking, interview questions, workforce predictions; auto CV parse on application submit

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

Core tables (all in `lib/db/src/schema/`):
- `agencies` — multi-tenant government agencies
- `roles` — role definitions (admin, hr_officer, hiring_manager, executive, applicant)
- `users` — system users with role and agency assignment
- `departments` — departments within an agency
- `positions` — position definitions with filled/total counts
- `jobs` — job vacancies (draft/published/closed)
- `candidates` — applicant records (extended with personal/contact/demographic fields)
- `candidate_education` — education history per candidate
- `candidate_experience` — work experience history per candidate
- `candidate_languages` — languages spoken per candidate
- `candidate_diversity` — voluntary D&I data per candidate
- `candidate_referees` — referees linked to an application
- `applications` — job applications (extended with position/compensation/skills/declaration fields)
- `application_documents` — uploaded document references per application
- `application_draft` — save/resume draft per candidate+job
- `job_screening_questions` — custom screening questions per job
- `application_screening_answers` — candidate answers to screening questions
- `employees` — staff records
- `contracts` — employment contracts with expiry tracking
- `ai_scores` — AI candidate scoring results
- `notifications` — in-app notifications (userId, type, message, read, createdAt)

## API Modules

All routes under `/api/`:
- `POST /auth/register` — register user + create agency
- `POST /auth/login` — returns JWT token
- `GET /auth/me` — current user profile
- `GET/POST /agencies` — agency management
- `GET/POST /departments` — department management
- `GET/POST /positions` — position management
- `GET/POST /jobs` + publish/close — job vacancy management
- `GET/POST /candidates` — candidate management
- `GET /candidates/:id/profile` — full candidate profile with all sub-records (education, experience, languages, diversity, referees, applications)
- `GET/POST /applications` — application tracking (extended: POST accepts 9-step wizard body with all extended fields)
- `GET/POST/DELETE /applications/draft` — save/resume draft application
- `GET /applications/my` — returns only the authenticated user's own applications (scoped by email → candidate lookup)
- `GET/POST/DELETE /jobs/:id/screening-questions` — manage custom screening questions per job
- `GET/POST /employees` — employee records
- `GET/POST /contracts` — contract lifecycle management
- `GET /ai-scores` — AI scoring results
- `GET /dashboard/summary` — key metrics
- `GET /dashboard/workforce-gaps` — filled vs unfilled positions
- `GET /dashboard/contract-expiries` — contracts expiring soon
- `GET /dashboard/recruitment-pipeline` — applications by status
- `POST /ai/parse-cv` — AI CV parsing
- `POST /ai/rank-candidates` — AI candidate ranking
- `POST /ai/interview-questions` — AI interview question generation
- `GET /ai/predictions/workforce` — AI workforce predictions

## Auth & RBAC

JWT-based authentication. Tokens expire in 7 days. `JWT_SECRET` env var controls signing (exits process in production if unset, warns in development). `authMiddleware` validates Bearer tokens. `requireRole(...roles)` enforces role-based access control.

### Role Permissions

| Role | Agencies | Jobs | Candidates | Applications | Employees/Contracts | Dashboard |
|---|---|---|---|---|---|---|
| admin | full CRUD | full CRUD | read/write | read/write | full CRUD | full |
| hr_officer | read | full CRUD | read/write | read/write | full CRUD | full |
| hiring_manager | read | read | read | read/update status | read | — |
| executive | read | read | — | — | read | full |
| applicant | read | read | self-create | self-create | — | — |

All write routes use Zod validation via generated schemas from `@workspace/api-zod`. Dashboard endpoints apply agency_id scoping so non-admin users only see their own agency's data.

### Multi-Tenant Isolation

Every authenticated request is scoped to the user's `agencyId` from their JWT:
- **List endpoints**: automatically filtered to the user's agency
- **GET /id endpoints**: return 403 if resource belongs to a different agency
- **Write endpoints**: check ownership before updating/deleting
- **Transitive resources**: applications are scoped via their job's agencyId; contracts via their employee's agencyId
- **Public endpoints** (job listings, submitting applications): use optional auth — unauthenticated users see all published jobs, authenticated users see only their agency's jobs
- `admin` is a **per-agency admin**, not a super-admin — scoped to their own agency

Tenant enforcement middleware: `artifacts/api-server/src/middlewares/tenant.ts`

## Object Storage

Replit Object Storage is provisioned and configured for CV and document file uploads.
- **Upload flow**: Client requests presigned URL via `POST /api/storage/uploads/request-url`, then PUTs file directly to Google Cloud Storage
- **Serving**: Uploaded files served via `GET /api/storage/objects/{objectPath}`
- **CV upload**: Job applications use presigned URL flow (max 10 MB, PDF/DOC/DOCX)
- **Server files**: `artifacts/api-server/src/lib/objectStorage.ts`, `objectAcl.ts`, `routes/storage.ts`

## Notifications

In-app notification system for status updates and contract expiry alerts.
- **Trigger 1**: Application status change → creates notification for applicant user (matched by email)
- **Trigger 2**: `GET /contracts` → fire-and-forget check for contracts expiring within 30 days → notifies HR Officers (once per 24h per contract)
- **API**: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
- **Bell UI**: `artifacts/hr-portal/src/components/notification-bell.tsx` — polls every 30s, shows unread badge, dropdown, mark as read
- **Notification service**: `artifacts/api-server/src/lib/notificationService.ts`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `JWT_SECRET` — JWT signing secret (should be set in production)
- `OPENAI_API_KEY` or `REPLIT_AI_KEY` — for AI features
- `OPENAI_BASE_URL` — optional custom AI API base URL
- `PORT` — server port (auto-assigned by Replit)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` — GCS bucket for file storage (auto-set by Replit)
- `PUBLIC_OBJECT_SEARCH_PATHS` — search paths for public assets (auto-set)
- `PRIVATE_OBJECT_DIR` — directory for private uploaded objects (auto-set)

## Frontend HR Portal

The React + Vite frontend (`artifacts/hr-portal/`) includes:
- **Landing page** — public job listings with search and apply flow
- **Auth pages** — login and register with JWT stored in `localStorage` as `hr_portal_token`
- **Dashboard** — KPI cards (open vacancies, applications, employees, expiring contracts), recruitment pipeline bar chart, workforce gaps, contract expiry table
- **Jobs** — list with search + department filter + status filter; publish/close/delete actions; create/edit form
- **Applications** — list with normalized status pipeline (applied → screening → interview → offer → hired / rejected / withdrawn); detail page with AI score display; inline status update
- **Candidates** — list with search; detail page with parsed CV data (skills, education)
- **Employees** — list with search/filter; detail with contract history
- **Contracts** — list with status filter; detail page
- **Agencies & Departments** — admin-only CRUD management pages
- **My Applications** — applicant-only view of own submitted applications (scoped by authenticated user's email, uses `GET /applications/my`)
- **Apply Dialog** — includes CV/Résumé file upload using presigned GCS URL (max 10 MB, PDF/DOC/DOCX); file uploads directly to GCS, objectPath saved as cvUrl
- **Notification Bell** — in top header bar; polls for notifications every 30s; unread count badge; dropdown with mark-as-read per item and mark-all-read; type icons (📋 application status, ⚠️ contract expiry)

### Auth Notes

- `AuthProvider` sets `isLoading: true` on init; flips `false` after reading token from localStorage
- `ProtectedRoute` waits for `isLoading=false` before deciding to redirect — prevents premature `/login` redirects on page load/refresh
- Token stored in `localStorage` as `hr_portal_token`

### Key Implementation Notes

- JWT payload field is `roleName` (not `role`) — `decodeToken()` reads `payload.roleName`
- Role names in DB: `admin`, `hr_officer`, `hiring_manager`, `executive`, `applicant`
- All API response fields are camelCase (`jobId`, `candidateId`, `closingDate`, etc.)
- `useGetAgencies` takes only 1 argument (options), no params
- `useGetDepartments` takes (params?, options?) — pass `undefined` first if no params
- `CreateApplicationRequest` accepts `candidateName`/`candidateEmail` directly (no pre-create candidate needed)
- Application status pipeline: `applied` (initial) → `screening` → `interview` → `offer` → `hired` (terminal: `rejected`, `withdrawn`)

## Seeding

On startup, the server automatically seeds: 5 default roles, the NISIT agency, and 8 departments if no agencies exist. Seed logic: `artifacts/api-server/src/lib/seed.ts`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
