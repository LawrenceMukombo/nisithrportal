const path = require("path");
let Client, bcrypt;
try {
  Client = require("pg").Client;
} catch {
  const pgPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/pg@8.20.0/node_modules/pg");
  Client = require(pgPkgPath).Client;
}
try {
  bcrypt = require("bcryptjs");
} catch {
  const bcryptPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs");
  bcrypt = require(bcryptPkgPath);
}

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const fs = require("fs");
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (match) {
      dbUrl = match[1];
    }
  }
}

const client = new Client({
  connectionString: dbUrl || "postgresql://postgres:postgres@localhost:5432/nisit_hr_portal",
});

async function main() {
  await client.connect();
  console.log("Connected to database...");

  // Guarantee columns exist on production table
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_saved_job_closing BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS closing_soon_days INTEGER NOT NULL DEFAULT 7;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_stale_applications BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
  console.log("Verified users table security and preference columns exist.");

  const hash = await bcrypt.hash("Admin123!", 10);
  const roleRes = await client.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
  const roleId = roleRes.rows[0]?.id || 1;
  const agencyRes = await client.query("SELECT id FROM agencies LIMIT 1");
  const agencyId = agencyRes.rows[0]?.id || 1;

  await client.query(`
    INSERT INTO users (name, email, password_hash, role_id, agency_id, status, failed_login_attempts, locked_until)
    VALUES ('NISIT Administrator', 'admin@nisit.gov.pg', $1, $2, $3, 'active', 0, NULL)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      status = 'active',
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  `, [hash, roleId, agencyId]);

  console.log("Admin account (admin@nisit.gov.pg) upserted and unlocked with password 'Admin123!'.");

  const res = await client.query("SELECT id, name, email, status, failed_login_attempts, locked_until FROM users ORDER BY id");
  console.log("Current user list:", res.rows);

  await client.end();
}

main().catch(console.error);

