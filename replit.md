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
- **AI**: OpenAI-compatible API (CV parsing, candidate ranking, interview questions, workforce predictions)

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
- `candidates` — applicant records with parsed CV data
- `applications` — job applications with pipeline status
- `employees` — staff records
- `contracts` — employment contracts with expiry tracking
- `ai_scores` — AI candidate scoring results

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
- `GET/POST /applications` + status update — application tracking
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

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `JWT_SECRET` — JWT signing secret (should be set in production)
- `OPENAI_API_KEY` or `REPLIT_AI_KEY` — for AI features
- `OPENAI_BASE_URL` — optional custom AI API base URL
- `PORT` — server port (auto-assigned by Replit)

## Frontend HR Portal

The React + Vite frontend (`artifacts/hr-portal/`) includes:
- **Landing page** — public job listings with search and apply flow
- **Auth pages** — login and register with JWT stored in `localStorage` as `hr_portal_token`
- **Dashboard** — KPI cards (open vacancies, applications, employees, expiring contracts), recruitment pipeline bar chart, workforce gaps, contract expiry table
- **Jobs** — list with publish/close/delete actions; create/edit form
- **Applications** — list with status filter; detail page with AI score display; inline status update
- **Candidates** — list with search; detail page with parsed CV data (skills, education)
- **Employees** — list with search/filter; detail with contract history
- **Contracts** — list with status filter; detail page
- **Agencies & Departments** — admin-only CRUD management pages

### Key Implementation Notes

- JWT payload field is `roleName` (not `role`) — `decodeToken()` reads `payload.roleName`
- Role names in DB: `admin`, `hr_officer`, `hiring_manager`, `executive`, `applicant`
- All API response fields are camelCase (`jobId`, `candidateId`, `closingDate`, etc.)
- `useGetAgencies` takes only 1 argument (options), no params
- `useGetDepartments` takes (params?, options?) — pass `undefined` first if no params
- `CreateApplicationRequest` accepts `candidateName`/`candidateEmail` directly (no pre-create candidate needed)

## Seeding

On startup, the server automatically seeds: 5 default roles, the NISIT agency, and 8 departments if no agencies exist. Seed logic: `artifacts/api-server/src/lib/seed.ts`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
