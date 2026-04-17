import { eq } from "drizzle-orm";
import { db, rolesTable, agenciesTable, departmentsTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_ROLES = [
  { name: "admin", permissions: { all: true } },
  { name: "hr_officer", permissions: { jobs: true, applications: true, candidates: true, employees: true, contracts: true } },
  { name: "hiring_manager", permissions: { applications: ["read", "review"], candidates: ["read"] } },
  { name: "executive", permissions: { dashboard: true, employees: ["read"], contracts: ["read"] } },
  { name: "applicant", permissions: { jobs: ["read"], applications: ["create", "read"] } },
];

export async function seedInitialData(): Promise<void> {
  try {
    for (const role of DEFAULT_ROLES) {
      const existing = await db.select().from(rolesTable).where(eq(rolesTable.name, role.name));
      if (existing.length === 0) {
        await db.insert(rolesTable).values({ name: role.name, permissions: role.permissions });
        logger.info({ role: role.name }, "Seeded role");
      }
    }

    const agencies = await db.select().from(agenciesTable);
    if (agencies.length === 0) {
      const [agency] = await db.insert(agenciesTable).values({
        name: "PNG National Institute of Standards and Industrial Technology",
        type: "government",
      }).returning();

      const depts = [
        "Human Resources",
        "Finance",
        "Information Technology",
        "Operations",
        "Standards and Metrology",
        "Industrial Development",
        "Research and Development",
        "Administration",
      ];

      for (const name of depts) {
        await db.insert(departmentsTable).values({ name, agencyId: agency.id });
      }

      logger.info({ agency: agency.name }, "Seeded default agency and departments");
    }
  } catch (err) {
    logger.error(err, "Seed failed (non-fatal)");
  }
}
