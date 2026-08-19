const path = require("path");
const pgPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/pg@8.20.0/node_modules/pg");
const bcryptPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs");
const { Client } = require(pgPkgPath);
const bcrypt = require(bcryptPkgPath);

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/nisit_hr_portal",
});

async function main() {
  await client.connect();
  console.log("Connected to database...");

  const res = await client.query("SELECT id, name, email, status, failed_login_attempts, locked_until FROM users");
  console.log("Users found in database:", res.rows);

  // Set clean password for admin@nisit.gov.pg
  const hash = await bcrypt.hash("Admin123!", 10);
  await client.query(`
    UPDATE users 
    SET password_hash = $1, status = 'active', failed_login_attempts = 0, locked_until = NULL 
    WHERE email = 'admin@nisit.gov.pg'
  `, [hash]);

  console.log("Admin account (admin@nisit.gov.pg) refreshed with password 'Admin123!' and lockouts cleared.");
  await client.end();
}

main().catch(console.error);
