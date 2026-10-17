const path = require("path");
const pgPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/pg@8.20.0/node_modules/pg");
const { Client } = require(pgPkgPath);

const client = new Client({
  connectionString: "postgresql://postgres:postgres@localhost:5432/nisit_hr_portal",
});

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL...");

  // Run each DDL statement individually to ensure columns exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS geofence_zones (
      id SERIAL PRIMARY KEY,
      agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      latitude TEXT NOT NULL,
      longitude TEXT NOT NULL,
      radius_meters INTEGER NOT NULL DEFAULT 150,
      address TEXT,
      province TEXT NOT NULL DEFAULT 'National Capital District',
      is_active TEXT NOT NULL DEFAULT 'true',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS live_attendance_status TEXT NOT NULL DEFAULT 'out_of_office';");
  await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_clock_in_at TIMESTAMPTZ;");
  await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_clock_out_at TIMESTAMPTZ;");
  await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS punctuality_score TEXT DEFAULT '100.0';");

  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS geofence_zone_id INTEGER REFERENCES geofence_zones(id) ON DELETE SET NULL;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_latitude TEXT;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_longitude TEXT;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_accuracy TEXT;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_latitude TEXT;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_longitude TEXT;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_accuracy TEXT;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'web';");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS self_photo_url TEXT;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0;");
  await client.query("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_status TEXT DEFAULT 'none';");

  console.log("Confirmed all geofence and smart attendance columns on employees and attendance_records!");

  const users = await client.query("SELECT id, name, email, employee_id FROM users");
  const emps = await client.query("SELECT id, name, email FROM employees ORDER BY id LIMIT 10");

  const adminUser = users.rows.find(u => u.email === "admin@nisit.gov.pg");
  if (adminUser) {
    const adminEmp = emps.rows.find(e => e.email === "admin@nisit.gov.pg");
    if (adminEmp) {
      await client.query("UPDATE users SET employee_id = $1 WHERE id = $2", [adminEmp.id, adminUser.id]);
      console.log(`Linked admin user ${adminUser.id} to existing employee ${adminEmp.id}`);
    } else {
      const res = await client.query(`
        INSERT INTO employees (name, email, division, agency_id, live_attendance_status)
        VALUES ('NISIT Administrator', 'admin@nisit.gov.pg', 'Executive Management', 1, 'out_of_office')
        RETURNING id
      `);
      const newEmpId = res.rows[0].id;
      await client.query("UPDATE users SET employee_id = $1 WHERE id = $2", [newEmpId, adminUser.id]);
      console.log(`Created and linked admin user ${adminUser.id} to employee ${newEmpId}`);
    }
  }

  // Also ensure Margaret Tolo is linked
  const margaretUser = users.rows.find(u => u.email === "m.tolo@nisit.gov.pg");
  const margaretEmp = emps.rows.find(e => e.email === "m.tolo@nisit.gov.pg");
  if (margaretUser && margaretEmp) {
    await client.query("UPDATE users SET employee_id = $1 WHERE id = $2", [margaretEmp.id, margaretUser.id]);
    console.log(`Linked Margaret user ${margaretUser.id} to employee ${margaretEmp.id}`);
  }

  const finalCheck = await client.query(`
    SELECT e.id, e.name, e.email, e.live_attendance_status, u.id as user_id 
    FROM employees e 
    JOIN users u ON u.employee_id = e.id
  `);
  console.log("Linked Users & Employees:", finalCheck.rows);

  await client.end();
}

main().catch(console.error);
