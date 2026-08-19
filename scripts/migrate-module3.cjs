const { createRequire } = require("module");
const path = require("path");

const pgPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/pg@8.20.0/node_modules/pg");
const { Client } = require(pgPkgPath);

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/nisit_hr_portal",
});

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL successfully!");

  // Safely add additive columns to users
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at timestamptz;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_saved_job_closing boolean NOT NULL DEFAULT true;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS closing_soon_days integer NOT NULL DEFAULT 7;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_stale_applications boolean NOT NULL DEFAULT true;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id integer;
  `);
  console.log("Users table updated with token_version and preference columns.");

  // Safely add additive columns to departments
  await client.query(`
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS code text;
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_department_id integer REFERENCES departments(id);
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS lead_employee_id integer;
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS description text;
  `);
  console.log("Departments table updated with additive columns.");

  // Safely add additive columns to positions
  await client.query(`
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS position_code text;
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS grade_level text NOT NULL DEFAULT 'Grade 10';
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS parent_position_id integer REFERENCES positions(id);
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS reports_to_title text;
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS job_description text;
  `);
  console.log("Positions table updated with additive columns.");

  // Create grades table if not exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS grades (
      id serial PRIMARY KEY,
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      level integer NOT NULL DEFAULT 10,
      minimum_salary numeric(12, 2),
      maximum_salary numeric(12, 2),
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log("Grades table confirmed.");

  // Auto-generate standard position codes if missing
  await client.query(`
    UPDATE positions SET position_code = 'POS-' || LPAD(id::text, 3, '0') WHERE position_code IS NULL;
  `);

  // Auto-generate standard department codes if missing
  await client.query(`
    UPDATE departments SET code = 'DIV-' || UPPER(SUBSTRING(name, 1, 3)) WHERE code IS NULL;
  `);

  console.log("Module 3 organization master data verified and enriched successfully!");
  await client.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
