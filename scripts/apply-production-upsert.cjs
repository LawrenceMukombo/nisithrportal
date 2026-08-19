const path = require("path");
const fs = require("fs");
const pgPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/pg@8.20.0/node_modules/pg");
const { Client } = require(pgPkgPath);

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log("Connected to PostgreSQL for Safe Production Uplift...");

  const sqlFile = path.resolve(__dirname, "production_seed_upsert.sql");
  if (!fs.existsSync(sqlFile)) {
    console.error(`ERROR: Seed SQL file not found at ${sqlFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, "utf8");
  console.log("Applying idempotent UPSERT statements (NO WIPE, NO OVERWRITE, UPSERT ONLY)...");
  
  await client.query(sql);
  console.log("✅ Production database successfully uplifted with all seeded master data!");
  
  await client.end();
}

main().catch(err => {
  console.error("❌ Production database uplift failed:", err);
  process.exit(1);
});
