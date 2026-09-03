# PNG National Institute of Standards & Industrial Technology (NISIT)
## Integrated HR Portal — Hostinger VPS Deployment Standard Operating Procedure (SOP)

**Target Infrastructure**:
- **Hostinger VPS IP**: `72.60.233.213`
- **Domain**: `nisithrportal.lamtoninvestments.com`
- **Application Directory**: `/var/www/nisithrportal`
- **PM2 Process Name**: `nisithrportal` *(Do NOT run `pm2 restart all` — other applications share this VPS)*
- **Database Engine**: PostgreSQL 16+ (PostGIS enabled)
- **Database Name**: `nisithr_db`
- **Web Server / Reverse Proxy**: Nginx + Let's Encrypt SSL (Certbot)
- **Data Policy**: **NO WIPE. NO TRUNCATE. UPSERT ONLY.**

---

## 1. Architecture & Port Mapping

| Component | Internal Port | Description |
|---|---|---|
| **API Server (Backend)** | `http://localhost:8080` | Express TypeScript REST API |
| **HR Portal (Frontend)** | Static Build (`dist/public`) | React 18 + Vite SPA served via Nginx |
| **PostgreSQL Database** | `localhost:5432/nisithr_db` | Relational database with PostGIS |
| **Nginx Ingress** | Port `80` (HTTP) / `443` (HTTPS) | Reverse proxies `/api/` to `8080` and `/` to frontend |

---

## 2. Server Environment Variables Configuration

The production `.env` is located at `/var/www/nisithrportal/.env`.

> [!IMPORTANT]
> - Never commit `.env` to Git.
> - If the database password contains special characters (e.g. `@`), it must be URL-encoded in `DATABASE_URL` (e.g. `@` becomes `%40`).
> - When updating `.env`, always restart PM2 with `--update-env`.

```ini
# Database Connection (URL-encode special characters in password, e.g. @ -> %40)
DATABASE_URL="postgresql://postgres:S%40mund3ng0@localhost:5432/nisithr_db"

# Server & Client URLs
PORT=8080
APP_BASE_URL=https://nisithrportal.lamtoninvestments.com

# Security Secrets (Generate using: openssl rand -base64 32)
JWT_SECRET=your-secure-production-jwt-secret-key-32-chars
SESSION_SECRET=your-secure-production-session-secret-key-32-chars

# Node Environment
NODE_ENV=production
SEED_ON_STARTUP=false
```

---

## 3. PostgreSQL Credential Alignment Protocol

If PostgreSQL throws error `28P01: password authentication failed for user "postgres"`, align PostgreSQL's internal password with `.env` in one command:

```bash
# 1. Set the PostgreSQL password to match the raw password in .env (e.g. S@mund3ng0)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'S@mund3ng0';"

# 2. Verify connection from command line
node scripts/inspect-users.cjs
```

---

## 4. Standard Update & Deployment Protocol

> [!CAUTION]
> **MULTI-APP VPS RULE**: Other live services run on this VPS (`vaxplan`, `visitpng`, `zachipos`, `zamroam`, `ccets`). 
> **NEVER run `pm2 restart all` or `pm2 kill`.** Only restart `nisithrportal`.

### Standard Release Workflow:

```bash
# Step 1: Navigate to application directory
cd /var/www/nisithrportal

# Step 2: Check git status to ensure working directory is clean
git status

# Step 3: Pull latest verified code from GitHub
git pull origin main

# Step 4: Build both backend API server and frontend React portal
pnpm run build || npm run build

# Step 5: Run the self-healing DB schema & admin unlock script
node scripts/inspect-users.cjs

# Step 6: Restart ONLY the nisithrportal PM2 process with updated environment
pm2 restart nisithrportal --update-env

# Step 7: Verify healthy startup in the logs
pm2 logs nisithrportal --lines 25 --nostream
```

---

## 5. Automated Self-Healing Architecture

The application includes automated self-healing mechanisms that execute on **every boot** (independent of `SEED_ON_STARTUP`):

1. **`ensureUserSecurityColumnsExist()`**:
   Automatically executes `ALTER TABLE users ADD COLUMN IF NOT EXISTS ...` for security columns (`failed_login_attempts`, `locked_until`, `last_login_at`, `token_version`, etc.).
2. **`ensureAdminUserExists()`**:
   Guarantees that `admin@nisit.gov.pg` is present, role is `admin`, status is `active`, lockouts are cleared, and the SOP password `Admin123!` is configured.
3. **`ensureLeaveTablesAndColumnsExist()`**:
   Auto-creates PNG public holidays and balance adjustment audit tables.
4. **`ensureContractColumnsExist()` & `ensureChatTablesExist()`**:
   Auto-provisions contract contents and messaging schemas.

---

## 6. Post-Deployment Verification Checklist

Execute these CLI health checks on the VPS to confirm deployment health:

### 1. Test Backend Authentication (Localhost)
```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nisit.gov.pg","password":"Admin123!"}' | grep "token"
```
*Expected Result*: Returns JSON containing valid `token` and `user` object.

### 2. Test Backend Authentication (Live Public Domain)
```bash
curl -s -X POST https://nisithrportal.lamtoninvestments.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nisit.gov.pg","password":"Admin123!"}' | grep "token"
```
*Expected Result*: Returns `token` over HTTPS.

### 3. Verify PM2 Process Status
```bash
pm2 status nisithrportal
```
*Expected Result*: Status `online`, CPU `0%`, memory ~70-150mb.

---

## 7. Administrative Credentials & Statutory Roles

| Account Role | Email | Password | Purpose |
|---|---|---|---|
| **System Administrator** | `admin@nisit.gov.pg` | `Admin123!` | System configuration, user management, audit logs |
| **HR Officer** | `m.tolo@nisit.gov.pg` | `Admin123!` | Leave, attendance, recruitment, employee records |
| **Director General / Executive** | `director@nisit.gov.pg` | `Admin123!` | Executive approvals, KPI dashboards, escalations |
| **Applicant Account** | `applicant@nisit.gov.pg` | `Admin123!` | Job applications, candidate portal testing |

---

## 8. Emergency Troubleshooting Guide

| Symptom | Probable Cause | Instant Solution |
|---|---|---|
| `password authentication failed for user "postgres"` (code `28P01`) | PostgreSQL password differs from `.env` | Run `sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '<RawPassword>';"` |
| `column "..." does not exist` on users table | Missing database columns | Run `node scripts/inspect-users.cjs` |
| `Invalid email or password` for admin account | Account locked from failed attempts or wrong hash | Run `node scripts/inspect-users.cjs` and restart PM2 |
| PM2 still running with old variables after `.env` edit | PM2 cached environment | Run `pm2 restart nisithrportal --update-env` |
| Frontend displays blank white page | Static files not updated | Run `pnpm run build` and check `ls -la dist/public` |

