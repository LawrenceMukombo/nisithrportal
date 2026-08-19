import { Router, type IRouter } from "express";
import { eq, and, lt, gte, sql, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, employeesTable, jobsTable, contractsTable, applicationsTable, candidatesTable, departmentsTable, positionsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();
const dashboardRoles = requireRole("admin", "hr_officer", "executive");

const DashboardQueryParams = z.object({
  agency_id: z.coerce.number().int().positive().optional(),
  days: z.coerce.number().int().min(1).max(730).optional(),
});

const DashboardDrilldownQueryParams = DashboardQueryParams.extend({
  metric: z.enum(["open_jobs", "total_jobs", "applications", "active_employees", "expiring_contracts", "pipeline", "department_capacity"]),
  status: z.string().trim().min(1).max(80).optional(),
  department_id: z.coerce.number().int().positive().optional(),
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

// The dashboard deliberately returns the source records separately from its aggregate
// endpoints. This keeps the initial overview light while allowing every visual to be
// audited back to real tenant-scoped data when a user selects it.
router.get("/dashboard/drilldown", authMiddleware, dashboardRoles, async (req, res): Promise<void> => {
  const query = DashboardDrilldownQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid drill-down parameters" }); return; }
  const { metric, status, department_id: departmentId } = query.data;
  const agencyId = resolveAgencyId(req);
  const employeeScope = agencyId != null ? eq(employeesTable.agencyId, agencyId) : undefined;
  const jobScope = agencyId != null ? eq(jobsTable.agencyId, agencyId) : undefined;
  const now = new Date();
  const nowStr = now.toISOString().split("T")[0];
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  if (metric === "open_jobs" || metric === "total_jobs") {
    const conditions = [jobScope, metric === "open_jobs" ? eq(jobsTable.status, "published") : undefined].filter(Boolean);
    const records = await db.select({
      id: jobsTable.id, title: jobsTable.title, status: jobsTable.status, closingDate: jobsTable.closingDate,
      department: departmentsTable.name,
    }).from(jobsTable).leftJoin(departmentsTable, eq(jobsTable.departmentId, departmentsTable.id))
      .where(conditions.length ? and(...conditions) : undefined).orderBy(jobsTable.createdAt);
    res.json({ title: metric === "open_jobs" ? "Open jobs" : "All jobs", records: records.map((r) => ({
      id: r.id, primary: r.title, secondary: [r.department, r.closingDate ? `Closes ${r.closingDate}` : "No closing date"].filter(Boolean).join(" · "), status: r.status, href: `/jobs/${r.id}`,
    })) });
    return;
  }

  if (metric === "applications" || metric === "pipeline") {
    const conditions = [
      agencyId != null ? inArray(applicationsTable.jobId, db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.agencyId, agencyId))) : undefined,
      metric === "pipeline" && status ? eq(applicationsTable.status, status) : undefined,
    ].filter(Boolean);
    const records = await db.select({ id: applicationsTable.id, status: applicationsTable.status, score: applicationsTable.score,
      candidate: candidatesTable.name, job: jobsTable.title,
    }).from(applicationsTable).leftJoin(candidatesTable, eq(applicationsTable.candidateId, candidatesTable.id))
      .leftJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id)).where(conditions.length ? and(...conditions) : undefined)
      .orderBy(applicationsTable.createdAt);
    res.json({ title: metric === "pipeline" && status ? `${status} applications` : "All applications", records: records.map((r) => ({
      id: r.id, primary: r.candidate ?? `Candidate #${r.id}`, secondary: [r.job, r.score != null ? `Score ${r.score}` : null].filter(Boolean).join(" · "), status: r.status, href: `/applications/${r.id}`,
    })) });
    return;
  }

  if (metric === "active_employees") {
    const conditions = [employeeScope, eq(employeesTable.status, "active")].filter(Boolean);
    const records = await db.select({ id: employeesTable.id, name: employeesTable.name, employeeNumber: employeesTable.employeeNumber,
      employmentType: employeesTable.employmentType, department: departmentsTable.name,
    }).from(employeesTable).leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .where(and(...conditions)).orderBy(employeesTable.name);
    res.json({ title: "Active employees", records: records.map((r) => ({
      id: r.id, primary: r.name, secondary: [r.employeeNumber, r.department].filter(Boolean).join(" · "), status: r.employmentType, href: `/employees/${r.id}`,
    })) });
    return;
  }

  if (metric === "expiring_contracts") {
    const conditions = [
      employeeScope ? inArray(contractsTable.employeeId, db.select({ id: employeesTable.id }).from(employeesTable).where(employeeScope)) : undefined,
      eq(contractsTable.status, "active"), gte(contractsTable.endDate, nowStr), lt(contractsTable.endDate, in90Days),
    ].filter(Boolean);
    const records = await db.select({ id: contractsTable.id, type: contractsTable.type, endDate: contractsTable.endDate, employee: employeesTable.name,
    }).from(contractsTable).leftJoin(employeesTable, eq(contractsTable.employeeId, employeesTable.id))
      .where(and(...conditions)).orderBy(contractsTable.endDate);
    res.json({ title: "Contracts expiring in the next 90 days", records: records.map((r) => ({
      id: r.id, primary: r.employee ?? `Employee for contract #${r.id}`, secondary: r.endDate ? `Ends ${r.endDate}` : "No end date", status: r.type, href: `/contracts/${r.id}`,
    })) });
    return;
  }

  const conditions = [agencyId != null ? eq(departmentsTable.agencyId, agencyId) : undefined, departmentId != null ? eq(departmentsTable.id, departmentId) : undefined].filter(Boolean);
  const records = await db.select({ id: positionsTable.id, title: positionsTable.title, total: positionsTable.totalCount,
    filled: positionsTable.filledCount, department: departmentsTable.name,
  }).from(positionsTable).innerJoin(departmentsTable, eq(positionsTable.departmentId, departmentsTable.id))
    .where(conditions.length ? and(...conditions) : undefined).orderBy(departmentsTable.name, positionsTable.title);
  res.json({ title: departmentId != null ? "Department capacity" : "Workforce capacity by position", records: records.map((r) => ({
    id: r.id, primary: r.title, secondary: `${r.department} · ${r.filled ?? 0} filled of ${r.total ?? 0}`, status: `${Math.max(0, (r.total ?? 0) - (r.filled ?? 0))} vacant`, href: "/departments",
  })) });
});

export default router;
