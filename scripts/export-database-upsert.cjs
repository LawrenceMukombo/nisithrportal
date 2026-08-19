const path = require("path");
const fs = require("fs");
const pgPkgPath = path.resolve(__dirname, "../node_modules/.pnpm/pg@8.20.0/node_modules/pg");
const { Client } = require(pgPkgPath);

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/nisit_hr_portal",
});

// Dependency-ordered tables for safe relational insertion
const TABLE_ORDER = [
  { table: "agencies", uniqueKey: "id" },
  { table: "roles", uniqueKey: "id" },
  { table: "departments", uniqueKey: "id" },
  { table: "grades", uniqueKey: "id" },
  { table: "positions", uniqueKey: "id" },
  { table: "permissions", uniqueKey: "id" },
  { table: "role_permissions", uniqueKey: "id" },
  { table: "employees", uniqueKey: "id" },
  { table: "employee_position_history", uniqueKey: "id" },
  { table: "users", uniqueKey: "id" },
  { table: "jobs", uniqueKey: "id" },
  { table: "job_screening_questions", uniqueKey: "id" },
  { table: "candidates", uniqueKey: "id" },
  { table: "applications", uniqueKey: "id" },
  { table: "application_screening_answers", uniqueKey: "id" },
  { table: "application_status_history", uniqueKey: "id" },
  { table: "application_documents", uniqueKey: "id" },
  { table: "candidate_education", uniqueKey: "id" },
  { table: "candidate_experience", uniqueKey: "id" },
  { table: "candidate_languages", uniqueKey: "id" },
  { table: "candidate_referees", uniqueKey: "id" },
  { table: "candidate_skills", uniqueKey: "id" },
  { table: "candidate_diversity", uniqueKey: "id" },
  { table: "onboarding_templates", uniqueKey: "id" },
  { table: "onboarding_template_tasks", uniqueKey: "id" },
  { table: "onboarding_workflows", uniqueKey: "id" },
  { table: "onboarding_tasks", uniqueKey: "id" },
  { table: "offboarding_workflows", uniqueKey: "id" },
  { table: "offboarding_tasks", uniqueKey: "id" },
  { table: "contracts", uniqueKey: "id" },
  { table: "contract_amendments", uniqueKey: "id" },
  { table: "contract_document_deletions", uniqueKey: "id" },
  { table: "leave_types", uniqueKey: "id" },
  { table: "leave_balances", uniqueKey: "id" },
  { table: "leave_requests", uniqueKey: "id" },
  { table: "attendance_records", uniqueKey: "id" },
  { table: "benefit_plans", uniqueKey: "id" },
  { table: "benefit_enrollments", uniqueKey: "id" },
  { table: "housing_units", uniqueKey: "id" },
  { table: "housing_applications", uniqueKey: "id" },
  { table: "training_courses", uniqueKey: "id" },
  { table: "training_enrollments", uniqueKey: "id" },
  { table: "performance_cycles", uniqueKey: "id" },
  { table: "performance_goals", uniqueKey: "id" },
  { table: "performance_reviews", uniqueKey: "id" },
  { table: "hr_letter_templates", uniqueKey: "id" },
  { table: "hr_letter_requests", uniqueKey: "id" },
  { table: "audit_logs", uniqueKey: "id" },
  { table: "saved_jobs", uniqueKey: "id" },
  { table: "notifications", uniqueKey: "id" },
  { table: "approvals", uniqueKey: "id" },
  { table: "approval_steps", uniqueKey: "id" },
];

function escapeLiteral(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    if (val instanceof Date) return `'${val.toISOString()}'::timestamptz`;
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL on localhost:5432...");

  const outLines = [];
  outLines.push(`-- =============================================================================`);
  outLines.push(`-- PNG NISIT INTEGRATED HR PORTAL — PRODUCTION DATABASE UPLIFT & SEED DUMP`);
  outLines.push(`-- Target VPS: 72.60.233.213 (nisithrportal.lamtoninvestments.com)`);
  outLines.push(`-- Policy: UPSERT ONLY (NO WIPE, NO TRUNCATE, NO DROP, NO OVERWRITE)`);
  outLines.push(`-- Generated: ${new Date().toISOString()}`);
  outLines.push(`-- =============================================================================\n`);
  outLines.push(`BEGIN;\n`);

  let totalRowsExported = 0;

  for (const { table, uniqueKey } of TABLE_ORDER) {
    try {
      const tableExists = await client.query(`
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1
      `, [table]);

      if (tableExists.rows.length === 0) {
        continue;
      }

      const res = await client.query(`SELECT * FROM "${table}" ORDER BY "${uniqueKey}" ASC`);
      if (res.rows.length === 0) continue;

      outLines.push(`-- Table: ${table} (${res.rows.length} rows)`);
      const cols = Object.keys(res.rows[0]);
      const quotedCols = cols.map(c => `"${c}"`).join(", ");

      for (const row of res.rows) {
        const vals = cols.map(c => escapeLiteral(row[c])).join(", ");
        
        // Build update assignments for all non-unique columns
        const updateCols = cols.filter(c => c !== uniqueKey && c !== "created_at");
        let onConflictClause = "";
        if (updateCols.length > 0) {
          const updateAssignments = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(", ");
          onConflictClause = `ON CONFLICT ("${uniqueKey}") DO UPDATE SET ${updateAssignments}`;
        } else {
          onConflictClause = `ON CONFLICT ("${uniqueKey}") DO NOTHING`;
        }

        outLines.push(`INSERT INTO "${table}" (${quotedCols}) VALUES (${vals}) ${onConflictClause};`);
        totalRowsExported++;
      }

      // Reset auto-increment sequence safely to max(id) + 1
      outLines.push(`SELECT setval(pg_get_serial_sequence('"${table}"', '${uniqueKey}'), COALESCE((SELECT MAX("${uniqueKey}") FROM "${table}"), 1), true);\n`);
    } catch (err) {
      console.warn(`Warning exporting table ${table}:`, err.message);
    }
  }

  outLines.push(`COMMIT;\n`);

  const sqlContent = outLines.join("\n");
  const exportPath = path.resolve(__dirname, "production_seed_upsert.sql");
  fs.writeFileSync(exportPath, sqlContent, "utf8");

  console.log(`Successfully exported ${totalRowsExported} records to ${exportPath}`);
  await client.end();
}

main().catch(console.error);
