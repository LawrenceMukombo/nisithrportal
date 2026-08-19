# PNG National Institute of Standards & Industrial Technology (NISIT)
## Integrated HR Portal — Hostinger VPS Deployment Standard Operating Procedure (SOP)

**Target Infrastructure**:
- **Hostinger VPS IP**: `72.60.233.213`
- **Domain**: `nisithrportal.lamtoninvestments.com`
- **Application Directory**: `/var/www/nisithrportal`
- **Database Engine**: PostgreSQL 16+ (PostGIS enabled)
- **Process Manager**: PM2
- **Web Server / Reverse Proxy**: Nginx + Let's Encrypt SSL (Certbot)
- **Data Policy**: **NO WIPE. NO TRUNCATE. UPSERT ONLY.**

---

## 1. Architecture & Port Mapping

| Component | Internal Port | Description |
|---|---|---|
| **API Server (Backend)** | `http://localhost:8080` | Express TypeScript REST API |
| **HR Portal (Frontend)** | Static Build (`/dist/public`) or `http://localhost:5173` | React 18 + Vite SPA |
| **PostgreSQL Database** | `localhost:5432/nisit_hr_portal` | Relational database with PostGIS |
| **Nginx Ingress** | Port `80` (HTTP) / `443` (HTTPS) | Reverse proxies `/api` to `8080` and `/` to frontend |

---

## 2. Server Prerequisites Checklist

Ensure the following packages are installed on the VPS:

```bash
# Node.js 20 LTS & Corepack / PNPM
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx postgresql postgresql-contrib certbot python3-certbot-nginx
sudo npm install -g pnpm pm2
```

---

## 3. Environment Variables Configuration

Create `/var/www/nisithrportal/.env` manually on the VPS. 

> [!IMPORTANT]
> Never commit `.env` to Git. Configure production values securely on the server.

```ini
# Database Connection
DATABASE_URL=postgresql://nisit_user:YourSecurePassword123!@localhost:5432/nisit_hr_portal

# Server & Client URLs
PORT=8080
APP_BASE_URL=https://nisithrportal.lamtoninvestments.com

# Security Secrets (Generate using: openssl rand -base64 32)
JWT_SECRET=your-secure-production-jwt-secret-key-32-chars
SESSION_SECRET=your-secure-production-session-secret-key-32-chars

# Node Environment
NODE_ENV=production
```

---

## 4. Step-by-Step Deployment Protocol

### Step 4.1: Clone or Pull Codebase

```bash
# Navigate to deployment directory
cd /var/www/nisithrportal

# Check current status
git status

# Pull latest code from GitHub
git pull origin main

# Install all workspace dependencies
pnpm install
```

---

### Step 4.2: Additive Database Schema & Safe Master Data Uplift

> [!IMPORTANT]
> Our data policy is strictly **UPSERT ONLY**. No existing records are deleted or wiped.

```bash
# 1. Apply additive schema migrations (new columns/tables only)
export DATABASE_URL="postgresql://nisit_user:YourSecurePassword123!@localhost:5432/nisit_hr_portal"
node scripts/migrate-module3.cjs

# 2. Uplift and synchronize all 606 relational seed records (agencies, departments, positions, employees, statutory roles, training catalogue, workflows)
node scripts/apply-production-upsert.cjs
```

---

### Step 4.3: Build Application Bundles

```bash
# Build both backend API server and frontend React application
pnpm run build
```

---

### Step 4.4: PM2 Process Management

Start or reload the API server process using PM2:

```bash
# Start backend API daemon
pm2 start "pnpm --filter @workspace/api-server run start" --name "nisit-api" --time

# Save PM2 process list to start automatically on system boot
pm2 save
pm2 startup
```

---

### Step 4.5: Nginx Reverse Proxy Configuration

Create or update `/etc/nginx/sites-available/nisithrportal.lamtoninvestments.com`:

```nginx
server {
    server_name nisithrportal.lamtoninvestments.com;

    # Static Frontend Assets
    root /var/www/nisithrportal/artifacts/hr-portal/dist/public;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # API Backend Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }

    # Frontend Single Page App Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

Enable the site and apply SSL certificate:

```bash
# Enable Nginx configuration
sudo ln -sf /etc/nginx/sites-available/nisithrportal.lamtoninvestments.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt SSL certificate
sudo certbot --nginx -d nisithrportal.lamtoninvestments.com
```

---

## 5. Post-Deployment Verification Checklist

Execute these CLI health checks on the VPS:

1. **Verify Backend Health & Authentication**:
   ```bash
   curl -X POST http://localhost:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@nisit.gov.pg","password":"Admin123!"}'
   ```
   *Expected Result*: Returns `HTTP 200` with JWT token and user profile.

2. **Verify Training Courses API**:
   ```bash
   curl -s http://localhost:8080/api/training/courses | grep "ISO/IEC 17025"
   ```
   *Expected Result*: Returns active course listing.

3. **Verify Organization Structure API**:
   ```bash
   curl -s http://localhost:8080/api/org-chart
   ```
   *Expected Result*: Returns 8 operational divisions and positions.

4. **Monitor PM2 Status**:
   ```bash
   pm2 status
   pm2 logs nisit-api --lines 50
   ```

---

## 6. Default Administrative Credentials

| Account Role | Email | Default Initial Password |
|---|---|---|
| **System Administrator** | `admin@nisit.gov.pg` | `Admin123!` |
| **HR Officer** | `m.tolo@nisit.gov.pg` | `Admin123!` |
| **Director General / Exec** | `director@nisit.gov.pg` | `Admin123!` |
| **Applicant Account** | `applicant@nisit.gov.pg` | `Admin123!` |
