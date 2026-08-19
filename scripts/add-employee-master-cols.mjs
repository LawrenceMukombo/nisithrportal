import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("../lib/db/node_modules/pg");

const client = new Client({
  connectionString: "postgresql://postgres:postgres@localhost:5432/nisit_hr_portal",
});

async function run() {
  await client.connect();
  console.log("Connected to PostgreSQL...");

  // 1. Add additive columns to employees table
  await client.query(`
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_number text UNIQUE;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_name text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_name text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS middle_name text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth date;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS national_id text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS passport_number text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS residential_address text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS postal_address text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS province text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_address text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS supervisor_id integer REFERENCES employees(id);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS grade_level text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS division text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS unit text;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'permanent';
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_start_date date;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_end_date date;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS confirmation_date date;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS separation_date date;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS separation_reason text;
  `);

  // 2. Create employee_position_history table
  await client.query(`
    CREATE TABLE IF NOT EXISTS employee_position_history (
      id serial PRIMARY KEY,
      employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      position_id integer REFERENCES positions(id),
      department_id integer REFERENCES departments(id),
      grade_level text,
      start_date date NOT NULL,
      end_date date,
      change_type text NOT NULL DEFAULT 'appointment',
      notes text,
      changed_by_user_id integer,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // 3. Backfill employee_number for any existing records that lack it
  const { rows: emps } = await client.query("SELECT id, name FROM employees WHERE employee_number IS NULL ORDER BY id ASC");
  for (const emp of emps) {
    const empNum = `NISIT-EMP-${String(10000 + emp.id)}`;
    await client.query("UPDATE employees SET employee_number = $1 WHERE id = $2", [empNum, emp.id]);
    console.log(`Assigned ${empNum} to employee ${emp.name} (ID: ${emp.id})`);
  }

  console.log("SUCCESS: Employee master columns and position history table created.");
  await client.end();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
