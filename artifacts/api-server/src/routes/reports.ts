import { Router, type IRouter } from "express";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import {
  db,
  employeesTable,
  departmentsTable,
  positionsTable,
  contractsTable,
  leaveRequestsTable,
  leaveTypesTable,
  attendanceRecordsTable,
  trainingEnrollmentsTable,
  trainingCoursesTable,
  housingApplicationsTable,
  applicationsTable,
  jobsTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => quote(row[header])).join(","))].join("\r\n");
}

// GET /api/reports/overview - High-level executive and HR overview KPIs
router.get("/reports/overview", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const totalEmployees = await db.select({ count: sql<number>`count(*)` }).from(employeesTable).where(eq(employeesTable.status, "active"));
    const totalJobs = await db.select({ count: sql<number>`count(*)` }).from(jobsTable).where(eq(jobsTable.status, "open"));
    const totalApplications = await db.select({ count: sql<number>`count(*)` }).from(applicationsTable);
    const pendingLeave = await db.select({ count: sql<number>`count(*)` }).from(leaveRequestsTable).where(eq(leaveRequestsTable.status, "pending"));
    const pendingHousing = await db.select({ count: sql<number>`count(*)` }).from(housingApplicationsTable).where(eq(housingApplicationsTable.status, "submitted"));
    const trainingCompletions = await db.select({ count: sql<number>`count(*)` }).from(trainingEnrollmentsTable).where(eq(trainingEnrollmentsTable.status, "completed"));

    // Department breakdown
    const deptDistribution = await db
      .select({
        departmentId: employeesTable.departmentId,
        departmentName: departmentsTable.name,
        count: sql<number>`count(*)`,
      })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .where(eq(employeesTable.status, "active"))
      .groupBy(employeesTable.departmentId, departmentsTable.name);

    res.json({
      headcount: Number(totalEmployees[0]?.count || 0),
      openVacancies: Number(totalJobs[0]?.count || 0),
      totalApplicants: Number(totalApplications[0]?.count || 0),
      pendingLeaveRequests: Number(pendingLeave[0]?.count || 0),
      pendingHousingRequests: Number(pendingHousing[0]?.count || 0),
      trainingCompletedCount: Number(trainingCompletions[0]?.count || 0),
      departmentDistribution: deptDistribution.map((d) => ({
        name: d.departmentName || "Unassigned",
        count: Number(d.count),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch overview metrics" });
  }
});

// GET /api/reports/contracts - Contract lifecycle, probation, and expiry alerts
router.get("/reports/contracts", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const contracts = await db
      .select({
        id: contractsTable.id,
        employeeId: contractsTable.employeeId,
        employeeName: employeesTable.name,
        positionTitle: positionsTable.title,
        departmentName: departmentsTable.name,
        type: contractsTable.type,
        status: contractsTable.status,
        startDate: contractsTable.startDate,
        endDate: contractsTable.endDate,
        documentUrl: contractsTable.documentUrl,
      })
      .from(contractsTable)
      .leftJoin(employeesTable, eq(contractsTable.employeeId, employeesTable.id))
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .orderBy(contractsTable.endDate);

    const now = new Date();
    const withExpiryBuckets = contracts.map((c) => {
      let daysRemaining = null;
      let expiryStatus = "normal";
      if (c.endDate) {
        const diffMs = new Date(c.endDate).getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) expiryStatus = "expired";
        else if (daysRemaining <= 30) expiryStatus = "expiring_30_days";
        else if (daysRemaining <= 60) expiryStatus = "expiring_60_days";
        else if (daysRemaining <= 90) expiryStatus = "expiring_90_days";
      }
      return { ...c, daysRemaining, expiryStatus };
    });

    res.json(withExpiryBuckets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contracts report" });
  }
});

// GET /api/reports/leave - Leave utilisation report
router.get("/reports/leave", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const utilisation = await db
      .select({
        leaveTypeId: leaveRequestsTable.leaveTypeId,
        leaveTypeName: leaveTypesTable.name,
        status: leaveRequestsTable.status,
        totalRequests: sql<number>`count(*)`,
        totalDays: sql<number>`sum(CAST(days AS numeric))`,
      })
      .from(leaveRequestsTable)
      .leftJoin(leaveTypesTable, eq(leaveRequestsTable.leaveTypeId, leaveTypesTable.id))
      .groupBy(leaveRequestsTable.leaveTypeId, leaveTypesTable.name, leaveRequestsTable.status);

    res.json(utilisation);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leave report" });
  }
});

// GET /api/reports/attendance - Attendance punctuality & attendance summary
router.get("/reports/attendance", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const summary = await db
      .select({
        status: attendanceRecordsTable.status,
        count: sql<number>`count(*)`,
      })
      .from(attendanceRecordsTable)
      .groupBy(attendanceRecordsTable.status);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance summary" });
  }
});

// Controlled export endpoint: only named reports are exported; users cannot
// submit arbitrary filters or SQL against operational tables.
router.get("/reports/:report/export", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  try {
    const report = req.params.report;
    let rows: Record<string, unknown>[];
    if (report === "contracts") {
      rows = await db.select({ id: contractsTable.id, employeeId: contractsTable.employeeId, status: contractsTable.status, endDate: contractsTable.endDate }).from(contractsTable) as Record<string, unknown>[];
    } else if (report === "leave") {
      rows = await db.select({ id: leaveRequestsTable.id, employeeId: leaveRequestsTable.employeeId, status: leaveRequestsTable.status, startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate, days: leaveRequestsTable.days }).from(leaveRequestsTable) as Record<string, unknown>[];
    } else if (report === "attendance") {
      rows = await db.select({ id: attendanceRecordsTable.id, employeeId: attendanceRecordsTable.employeeId, date: attendanceRecordsTable.date, status: attendanceRecordsTable.status, lateMinutes: attendanceRecordsTable.lateMinutes }).from(attendanceRecordsTable) as Record<string, unknown>[];
    } else { res.status(404).json({ error: "Supported reports are contracts, leave and attendance" }); return; }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${report}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(toCsv(rows));
  } catch { res.status(500).json({ error: "Failed to export report" }); }
});

export default router;
