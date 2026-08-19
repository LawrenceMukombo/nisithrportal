# PNG NISIT HR Portal — AI-Enabled Government HR Recruitment & Workforce Management

## Overview

This project is a full-stack monorepo for an AI-powered Government HR portal designed for recruitment and workforce management. Its primary purpose is to streamline HR processes for government agencies, starting with the Papua New Guinea National Institute of Standards and Industrial Technology (NISIT). The multi-tenant architecture allows for broad adoption across various government bodies, enhancing efficiency and modernizing HR operations.

Key capabilities include:
- AI-driven CV parsing, candidate ranking, interview question generation, and workforce predictions
- Public job listings & 9-step candidate application wizard with CV auto-fill
- Role-based staff access for HR Officers, Hiring Managers, and Executives
- Employee records, contract lifecycle management, and expiry alerting
- Department & agency multi-tenancy with RBAC
- Enterprise-grade interactive dashboards, KPI metrics, and reporting

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Technology Stack:**
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.9
- **Backend**: Express 5 REST API (`artifacts/api-server`)
- **Database**: PostgreSQL with Drizzle ORM (`lib/db`)
- **Frontend**: React 19 + Vite 7 + Tailwind CSS v4 (`artifacts/hr-portal`)
- **State & Data Fetching**: TanStack Query v5 + custom React Query API client (`lib/api-client-react`)
- **UI Components**: Radix UI primitives, Lucide Icons, Recharts
- **Validation**: Zod schema definitions (`lib/api-zod`)

## Workspace Structure

```
├── artifacts/
│   ├── api-server/        # Express backend REST API server
│   ├── hr-portal/         # React + Vite frontend application
│   └── mockup-sandbox/    # UI mockup & component preview sandbox
├── lib/
│   ├── api-client-react/  # Generated React Query hooks & API client
│   ├── api-spec/          # OpenAPI specification
│   ├── api-zod/           # Zod validation schemas
│   ├── db/                # Drizzle ORM schema and database migrations
│   ├── integrations-openai-ai-react/  # AI React hooks and helpers
│   ├── integrations-openai-ai-server/ # Server-side OpenAI client
│   └── object-storage-web/            # File upload & storage utilities
└── scripts/               # Project utility and build scripts
```

## Running Locally

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Variables**:
   Configure the following environment variables (e.g. in your environment or launch scripts):
   - `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/nisit_hr`)
   - `JWT_SECRET`: Secret key for signing JWT auth tokens
   - `SESSION_SECRET`: Secret key for session management
   - `APP_BASE_URL`: Frontend URL origin (e.g. `http://localhost:5173`)
   - `PORT`: Port for the API server (e.g. `3000` or `8080`)
   - `OPENAI_API_KEY`: (Optional) OpenAI API key for AI-powered CV parsing and candidate ranking
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: (Optional) SMTP credentials for email alerts

3. **Start the API Server**:
   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

4. **Start the HR Portal Frontend**:
   ```bash
   pnpm --filter @workspace/hr-portal run dev
   ```
