import { Router, type IRouter } from "express";
import { eq, and, lt, gte, sql, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, employeesTable, jobsTable, contractsTable, applicationsTable, departmentsTable, positionsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();
const dashboardRoles = requireRole("admin", "hr_officer", "executive");

const DashboardQueryParams = z.object({
  agency_id: z.coerce.number().int().positive().optional(),
  days: z.coerce.number().int().min(1).max(730).optional(),
});

function resolveAgencyId(req: Parameters<typeof getTenantAgencyId>[0]): number | undefined {
  const fromQuery = req.query?.agency_id ? Number(req.query.agency_id) : undefined;
  const fromToken = req.user?.agencyId ?? undefined;
  return fromToken ?? fromQuery;
}

router.get("/dashboard/summary", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const query = DashboardQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid query parameters" }); return; }
  const agencyId = resolveAgencyId(req);

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  const employeeWhere = agencyId != null ? eq(employeesTable.agencyId, agencyId) : undefined;
  const jobWhere = agencyId != null ? eq(jobsTable.agencyId, agencyId) : undefined;
  const deptWhere = agencyId != null ? eq(departmentsTable.agencyId, agencyId) : undefined;

  const [totalEmployeesResult] = employeeWhere
    ? await db.select({ count: count() }).from(employeesTable).where(employeeWhere)
    : await db.select({ count: count() }).from(employeesTable);

  const [activeEmployeesResult] = employeeWhere
    ? await db.select({ count: count() }).from(employeesTable).where(and(employeeWhere, eq(employeesTable.status, "active")))
    : await db.select({ count: count() }).from(employeesTable).where(eq(employeesTable.status, "active"));

  const [openVacanciesResult] = jobWhere
    ? await db.select({ count: count() }).from(jobsTable).where(and(jobWhere, eq(jobsTable.status, "published")))
    : await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "published"));

  const [totalJobsResult] = jobWhere
    ? await db.select({ count: count() }).from(jobsTable).where(jobWhere)
    : await db.select({ count: count() }).from(jobsTable);

  const [departmentsCountResult] = deptWhere
    ? await db.select({ count: count() }).from(departmentsTable).where(deptWhere)
    : await db.select({ count: count() }).from(departmentsTable);

  let contractsExpiringCount = 0;
  let applicationsInPipelineCount = 0;
  let totalApplicationsCount = 0;

  if (agencyId != null) {
    const agencyEmployees = await db.select({ id: employeesTable.id })
      .from(employeesTable).where(eq(employeesTable.agencyId, agencyId));
    const empIds = agencyEmployees.map((e) => e.id);

    if (empIds.length > 0) {
      const [contractsResult] = await db.select({ count: count() }).from(contractsTable)
        .where(and(
          inArray(contractsTable.employeeId, empIds),
          eq(contractsTable.status, "active"),
          gte(contractsTable.endDate, nowStr),
          lt(contractsTable.endDate, in30Days),
        ));
      contractsExpiringCount = Number(contractsResult.count);
    }

    const agencyJobs = await db.select({ id: jobsTable.id })
      .from(jobsTable).where(eq(jobsTable.agencyId, agencyId));
    const jobIds = agencyJobs.map((j) => j.id);

    if (jobIds.length > 0) {
      const [pipelineResult] = await db.select({ count: count() }).from(applicationsTable)
        .where(and(
          inArray(applicationsTable.jobId, jobIds),
          sql`${applicationsTable.status} IN ('applied','shortlisted','interview')`,
        ));
      applicationsInPipelineCount = Number(pipelineResult.count);

      const [totalAppsResult] = await db.select({ count: count() }).from(applicationsTable)
        .where(inArray(applicationsTable.jobId, jobIds));
      totalApplicationsCount = Number(totalAppsResult.count);
    }
  } else {
    const [contractsResult] = await db.select({ count: count() }).from(contractsTable)
      .where(and(
        eq(contractsTable.status, "active"),
        gte(contractsTable.endDate, nowStr),
        lt(contractsTable.endDate, in30Days),
      ));
    contractsExpiringCount = Number(contractsResult.count);

    const [pipelineResult] = await db.select({ count: count() }).from(applicationsTable)
      .where(sql`${applicationsTable.status} IN ('applied','shortlisted','interview')`);
    applicationsInPipelineCount = Number(pipelineResult.count);

    const [totalAppsResult] = await db.select({ count: count() }).from(applicationsTable);
    totalApplicationsCount = Number(totalAppsResult.count);
  }

  res.json({
    totalEmployees: Number(totalEmployeesResult.count),
    activeEmployees: Number(activeEmployeesResult.count),
    openVacancies: Number(openVacanciesResult.count),
    totalJobs: Number(totalJobsResult.count),
    contractsExpiringIn30Days: contractsExpiringCount,
    applicationsInPipeline: applicationsInPipelineCount,
    totalApplications: totalApplicationsCount,
    departmentsCount: Number(departmentsCountResult.count),
  });
});

router.get("/dashboard/workforce-gaps", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const query = DashboardQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid query parameters" }); return; }
  const agencyId = resolveAgencyId(req);

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
  const query = DashboardQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid query parameters" }); return; }
  const days = query.data.days ?? 90;
  const agencyId = resolveAgencyId(req);

  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  let employeeIds: number[] | undefined;
  if (agencyId != null) {
    const agencyEmployees = await db.select({ id: employeesTable.id })
      .from(employeesTable).where(eq(employeesTable.agencyId, agencyId));
    employeeIds = agencyEmployees.map((e) => e.id);
    if (employeeIds.length === 0) {
      res.json([]);
      return;
    }
  }

  const contracts = employeeIds != null
    ? await db.select().from(contractsTable).where(and(
        inArray(contractsTable.employeeId, employeeIds),
        eq(contractsTable.status, "active"),
        gte(contractsTable.endDate, nowStr),
        lt(contractsTable.endDate, futureDate),
      ))
    : await db.select().from(contractsTable).where(and(
        eq(contractsTable.status, "active"),
        gte(contractsTable.endDate, nowStr),
        lt(contractsTable.endDate, futureDate),
      ));

  const result = await Promise.all(contracts.map(async (contract) => {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, contract.employeeId));
    const endDate = contract.endDate ?? "";
    const daysUntilExpiry = Math.ceil((new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      contractId: contract.id,
      employeeId: contract.employeeId,
      employeeName: emp?.name ?? "Unknown",
      contractType: contract.type,
      endDate,
      daysUntilExpiry,
      status: contract.status,
    };
  }));

  result.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  res.json(result);
});

router.get("/dashboard/recruitment-pipeline", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const query = DashboardQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid query parameters" }); return; }
  const agencyId = resolveAgencyId(req);
  const statuses = ["applied", "shortlisted", "interview", "selected", "rejected"];

  let jobIds: number[] | undefined;
  if (agencyId != null) {
    const agencyJobs = await db.select({ id: jobsTable.id })
      .from(jobsTable).where(eq(jobsTable.agencyId, agencyId));
    jobIds = agencyJobs.map((j) => j.id);
    if (jobIds.length === 0) {
      res.json(statuses.map((status) => ({ status, count: 0 })));
      return;
    }
  }

  const pipeline = await Promise.all(statuses.map(async (status) => {
    let result;
    if (jobIds != null) {
      [result] = await db.select({ count: count() }).from(applicationsTable)
        .where(and(eq(applicationsTable.status, status), inArray(applicationsTable.jobId, jobIds)));
    } else {
      [result] = await db.select({ count: count() }).from(applicationsTable)
        .where(eq(applicationsTable.status, status));
    }
    return { status, count: Number(result.count) };
  }));

  res.json(pipeline);
});

export default router;
