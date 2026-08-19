import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("../lib/db/node_modules/pg");

const client = new Client({
  connectionString: "postgresql://postgres:postgres@localhost:5432/nisit_hr_portal",
});

async function run() {
  await client.connect();
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id integer REFERENCES employees(id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at timestamptz;
  `);
  console.log("SUCCESS: User security columns added.");
  await client.end();
}

run().catch(console.error);
