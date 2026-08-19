import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Connected to PostgreSQL via @workspace/db...");

  // Safely add additive columns to departments
  await db.execute(sql`
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS code text;
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_department_id integer REFERENCES departments(id);
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS lead_employee_id integer;
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS description text;
  `);
  console.log("Departments table updated with additive columns.");

  // Safely add additive columns to positions
  await db.execute(sql`
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS position_code text;
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS grade_level text NOT NULL DEFAULT 'Grade 10';
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS parent_position_id integer REFERENCES positions(id);
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS reports_to_title text;
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    ALTER TABLE positions ADD COLUMN IF NOT EXISTS job_description text;
  `);
  console.log("Positions table updated with additive columns.");

  // Create grades table if not exists
  await db.execute(sql`
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
  await db.execute(sql`
    UPDATE positions SET position_code = 'POS-' || LPAD(id::text, 3, '0') WHERE position_code IS NULL;
  `);

  // Auto-generate standard department codes if missing
  await db.execute(sql`
    UPDATE departments SET code = 'DIV-' || UPPER(SUBSTRING(name, 1, 3)) WHERE code IS NULL;
  `);

  console.log("Module 3 organization master data verified and enriched successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
