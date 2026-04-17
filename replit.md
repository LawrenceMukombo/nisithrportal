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

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `JWT_SECRET` — JWT signing secret (should be set in production)
- `OPENAI_API_KEY` or `REPLIT_AI_KEY` — for AI features
- `OPENAI_BASE_URL` — optional custom AI API base URL
- `PORT` — server port (auto-assigned by Replit)

## Seeding

On startup, the server automatically seeds: 5 default roles, the NISIT agency, and 8 departments if no agencies exist. Seed logic: `artifacts/api-server/src/lib/seed.ts`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
