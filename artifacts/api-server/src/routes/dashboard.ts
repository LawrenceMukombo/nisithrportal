import { Router, type IRouter } from "express";
import { eq, and, lt, gte, sql, count } from "drizzle-orm";
import { db, employeesTable, jobsTable, contractsTable, applicationsTable, departmentsTable, positionsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const dashboardRoles = requireRole("admin", "hr_officer", "executive");

router.get("/dashboard/summary", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const agencyId = req.query.agency_id
    ? parseInt(req.query.agency_id as string, 10)
    : (req.user?.roleName === "admin" ? undefined : req.user?.agencyId ?? undefined);

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  const employeeFilter = agencyId != null ? eq(employeesTable.agencyId, agencyId) : undefined;
  const jobFilter = agencyId != null ? eq(jobsTable.agencyId, agencyId) : undefined;
  const deptFilter = agencyId != null ? eq(departmentsTable.agencyId, agencyId) : undefined;

  const [totalEmployeesResult] = employeeFilter
    ? await db.select({ count: count() }).from(employeesTable).where(employeeFilter)
    : await db.select({ count: count() }).from(employeesTable);

  const [activeEmployeesResult] = employeeFilter
    ? await db.select({ count: count() }).from(employeesTable).where(and(employeeFilter, eq(employeesTable.status, "active")))
    : await db.select({ count: count() }).from(employeesTable).where(eq(employeesTable.status, "active"));

  const [openVacanciesResult] = jobFilter
    ? await db.select({ count: count() }).from(jobsTable).where(and(jobFilter, eq(jobsTable.status, "published")))
    : await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "published"));

  const [totalJobsResult] = jobFilter
    ? await db.select({ count: count() }).from(jobsTable).where(jobFilter)
    : await db.select({ count: count() }).from(jobsTable);

  const [contractsExpiringResult] = await db.select({ count: count() }).from(contractsTable)
    .where(and(
      eq(contractsTable.status, "active"),
      gte(contractsTable.endDate, nowStr),
      lt(contractsTable.endDate, in30Days),
    ));

  const [applicationsInPipelineResult] = await db.select({ count: count() }).from(applicationsTable)
    .where(sql`${applicationsTable.status} IN ('applied','shortlisted','interview')`);

  const [totalApplicationsResult] = await db.select({ count: count() }).from(applicationsTable);

  const [departmentsCountResult] = deptFilter
    ? await db.select({ count: count() }).from(departmentsTable).where(deptFilter)
    : await db.select({ count: count() }).from(departmentsTable);

  res.json({
    totalEmployees: Number(totalEmployeesResult.count),
    activeEmployees: Number(activeEmployeesResult.count),
    openVacancies: Number(openVacanciesResult.count),
    totalJobs: Number(totalJobsResult.count),
    contractsExpiringIn30Days: Number(contractsExpiringResult.count),
    applicationsInPipeline: Number(applicationsInPipelineResult.count),
    totalApplications: Number(totalApplicationsResult.count),
    departmentsCount: Number(departmentsCountResult.count),
  });
});

router.get("/dashboard/workforce-gaps", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const agencyId = req.query.agency_id
    ? parseInt(req.query.agency_id as string, 10)
    : (req.user?.roleName === "admin" ? undefined : req.user?.agencyId ?? undefined);

  const departments = agencyId != null
    ? await db.select().from(departmentsTable).where(eq(departmentsTable.agencyId, agencyId))
    : await db.select().from(departmentsTable);

  const gaps = await Promise.all(departments.map(async (dept) => {
    const [posResult] = await db.select({
      totalCount: sql<number>`COALESCE(SUM(${positionsTable.totalCount}), 0)`,
      filledCount: sql<number>`COALESCE(SUM(${positionsTable.filledCount}), 0)`,
    }).from(positionsTable).where(eq(positionsTable.departmentId, dept.id));

    const total = Number(posResult.totalCount ?? 0);
    const filled = Number(posResult.filledCount ?? 0);
    const gap = Math.max(0, total - filled);
    const fillRate = total > 0 ? Math.round((filled / total) * 10000) / 100 : 0;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      filledPositions: filled,
      totalPositions: total,
      gapCount: gap,
      fillRate,
    };
  }));

  res.json(gaps);
});

router.get("/dashboard/contract-expiries", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
  const agencyId = req.query.agency_id
    ? parseInt(req.query.agency_id as string, 10)
    : (req.user?.roleName === "admin" ? undefined : req.user?.agencyId ?? undefined);

  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  const contracts = await db.select().from(contractsTable)
    .where(and(
      eq(contractsTable.status, "active"),
      gte(contractsTable.endDate, nowStr),
      lt(contractsTable.endDate, futureDate),
    ));

  const result = await Promise.all(contracts.map(async (contract) => {
    const [empResult] = await db.select().from(employeesTable).where(eq(employeesTable.id, contract.employeeId));

    if (agencyId != null && empResult?.agencyId !== agencyId) return null;

    const endDate = contract.endDate ?? "";
    const daysUntilExpiry = Math.ceil((new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      contractId: contract.id,
      employeeId: contract.employeeId,
      employeeName: empResult?.name ?? "Unknown",
      contractType: contract.type,
      endDate,
      daysUntilExpiry,
      status: contract.status,
    };
  }));

  const filtered = result.filter((r): r is NonNullable<typeof r> => r !== null);
  filtered.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  res.json(filtered);
});

router.get("/dashboard/recruitment-pipeline", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const agencyId = req.query.agency_id
    ? parseInt(req.query.agency_id as string, 10)
    : (req.user?.roleName === "admin" ? undefined : req.user?.agencyId ?? undefined);

  const statuses = ["applied", "shortlisted", "interview", "selected", "rejected"];
  const pipeline = await Promise.all(statuses.map(async (status) => {
    let result;
    if (agencyId != null) {
      const agencyJobIds = await db.select({ id: jobsTable.id }).from(jobsTable)
        .where(eq(jobsTable.agencyId, agencyId));
      const ids = agencyJobIds.map((j) => j.id);
      if (ids.length === 0) return { status, count: 0 };
      const [row] = await db.select({ count: count() }).from(applicationsTable)
        .where(and(
          eq(applicationsTable.status, status),
          sql`${applicationsTable.jobId} = ANY(${ids})`,
        ));
      result = row;
    } else {
      [result] = await db.select({ count: count() }).from(applicationsTable)
        .where(eq(applicationsTable.status, status));
    }
    return { status, count: Number(result.count) };
  }));

  res.json(pipeline);
});

export default router;
