import { Router, type IRouter } from "express";
import { eq, and, desc, sql, gte, lte, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  leaveTypesTable,
  leaveBalancesTable,
  leaveRequestsTable,
  publicHolidaysTable,
  leaveBalanceAdjustmentsTable,
  employeesTable,
  departmentsTable,
  positionsTable,
  usersTable,
  approvalInstancesTable,
} from "@workspace/db";
import { authMiddleware, optionalAuth, requireRole } from "../middlewares/auth";
import { createApproval } from "./workflows";
import { canManageEmployee, currentEmployeeId, hasSensitiveReadAccess } from "../lib/employee-access";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

const handoverEmployees = alias(employeesTable, "handover_employees");

/**
 * Calculates working days between start date and end date (inclusive)
 * excluding weekends (Saturday/Sunday) and official public holidays.
 */
function calculateWorkingDays(
  startDateStr: string,
  endDateStr: string,
  periodType: string = "full_day",
  holidayDates: Set<string> = new Set()
): number {
  if (periodType === "half_day_am" || periodType === "half_day_pm") {
    return 0.5;
  }

  const start = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return 0;
  }

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const dateKey = current.toISOString().slice(0, 10);

    // If it's a weekday and not a designated public holiday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateKey)) {
      workingDays += 1;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return workingDays;
}

// GET /api/leave/types - List all active leave types
router.get("/leave/types", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const types = await db.select().from(leaveTypesTable).where(eq(leaveTypesTable.active, true)).orderBy(leaveTypesTable.name);
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leave types" });
  }
});

// PATCH /api/leave/types/:id - Update leave type policy rules
router.patch("/leave/types/:id", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const typeId = parseInt(req.params.id as string);
    const { name, defaultDays, carryOverMax, isPaid, description, active } = req.body;

    const [updated] = await db
      .update(leaveTypesTable)
      .set({
        ...(name !== undefined && { name }),
        ...(defaultDays !== undefined && { defaultDays: Number(defaultDays) }),
        ...(carryOverMax !== undefined && { carryOverMax: Number(carryOverMax) }),
        ...(isPaid !== undefined && { isPaid: Boolean(isPaid) }),
        ...(description !== undefined && { description }),
        ...(active !== undefined && { active: Boolean(active) }),
        updatedAt: new Date(),
      })
      .where(eq(leaveTypesTable.id, typeId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Leave type not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update leave type policy" });
  }
});

// GET /api/leave/balances - Get balances for employee or all staff
router.get("/leave/balances", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const allStaff = req.query.all === "true";
    const currentYear = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const isHROrAdmin = hasSensitiveReadAccess(req);

    if (allStaff && isHROrAdmin) {
      const agencyId = getTenantAgencyId(req);
      const conditions = [eq(leaveBalancesTable.year, currentYear)];
      if (agencyId != null) {
        conditions.push(eq(employeesTable.agencyId, agencyId));
      }

      const allBalances = await db
        .select({
          id: leaveBalancesTable.id,
          employeeId: leaveBalancesTable.employeeId,
          employeeName: employeesTable.name,
          employeeNumber: employeesTable.employeeNumber,
          departmentName: departmentsTable.name,
          leaveTypeId: leaveBalancesTable.leaveTypeId,
          leaveTypeName: leaveTypesTable.name,
          leaveTypeCode: leaveTypesTable.code,
          year: leaveBalancesTable.year,
          allocatedDays: leaveBalancesTable.allocatedDays,
          usedDays: leaveBalancesTable.usedDays,
          pendingDays: leaveBalancesTable.pendingDays,
        })
        .from(leaveBalancesTable)
        .innerJoin(employeesTable, eq(leaveBalancesTable.employeeId, employeesTable.id))
        .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
        .leftJoin(leaveTypesTable, eq(leaveBalancesTable.leaveTypeId, leaveTypesTable.id))
        .where(and(...conditions))
        .orderBy(employeesTable.name, leaveTypesTable.name);

      res.json(allBalances);
      return;
    }

    const ownEmployeeId = await currentEmployeeId(req);
    const targetEmployeeId = employeeIdParam ?? ownEmployeeId ?? undefined;
    if (employeeIdParam && employeeIdParam !== ownEmployeeId && !isHROrAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!targetEmployeeId) {
      res.json([]);
      return;
    }

    const balances = await db
      .select({
        id: leaveBalancesTable.id,
        employeeId: leaveBalancesTable.employeeId,
        leaveTypeId: leaveBalancesTable.leaveTypeId,
        leaveTypeName: leaveTypesTable.name,
        leaveTypeCode: leaveTypesTable.code,
        year: leaveBalancesTable.year,
        allocatedDays: leaveBalancesTable.allocatedDays,
        usedDays: leaveBalancesTable.usedDays,
        pendingDays: leaveBalancesTable.pendingDays,
      })
      .from(leaveBalancesTable)
      .leftJoin(leaveTypesTable, eq(leaveBalancesTable.leaveTypeId, leaveTypesTable.id))
      .where(and(eq(leaveBalancesTable.employeeId, targetEmployeeId), eq(leaveBalancesTable.year, currentYear)));

    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leave balances" });
  }
});

// GET /api/leave/requests - List leave requests
router.get("/leave/requests", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const statusParam = req.query.status as string | undefined;

    const conditions = [];
    if (employeeIdParam) {
      conditions.push(eq(leaveRequestsTable.employeeId, employeeIdParam));
    }
    if (statusParam && statusParam !== "all") {
      conditions.push(eq(leaveRequestsTable.status, statusParam));
    }
    const ownEmployeeId = await currentEmployeeId(req);
    if (hasSensitiveReadAccess(req)) {
      const agencyId = getTenantAgencyId(req);
      if (agencyId != null) conditions.push(eq(employeesTable.agencyId, agencyId));
    } else {
      if (!ownEmployeeId || (employeeIdParam && employeeIdParam !== ownEmployeeId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      conditions.push(eq(leaveRequestsTable.employeeId, ownEmployeeId));
    }

    const requests = await db
      .select({
        id: leaveRequestsTable.id,
        employeeId: leaveRequestsTable.employeeId,
        employeeName: employeesTable.name,
        departmentName: departmentsTable.name,
        positionTitle: positionsTable.title,
        leaveTypeId: leaveRequestsTable.leaveTypeId,
        leaveTypeName: leaveTypesTable.name,
        leaveTypeCode: leaveTypesTable.code,
        startDate: leaveRequestsTable.startDate,
        endDate: leaveRequestsTable.endDate,
        days: leaveRequestsTable.days,
        reason: leaveRequestsTable.reason,
        status: leaveRequestsTable.status,
        approverId: leaveRequestsTable.approverId,
        approverComment: leaveRequestsTable.approverComment,
        approvedAt: leaveRequestsTable.approvedAt,
        attachmentUrl: leaveRequestsTable.attachmentUrl,
        handoverEmployeeId: leaveRequestsTable.handoverEmployeeId,
        handoverEmployeeName: handoverEmployees.name,
        leavePeriodType: leaveRequestsTable.leavePeriodType,
        emergencyContact: leaveRequestsTable.emergencyContact,
        medicalCertificateNumber: leaveRequestsTable.medicalCertificateNumber,
        createdAt: leaveRequestsTable.createdAt,
      })
      .from(leaveRequestsTable)
      .leftJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .leftJoin(leaveTypesTable, eq(leaveRequestsTable.leaveTypeId, leaveTypesTable.id))
      .leftJoin(handoverEmployees, eq(leaveRequestsTable.handoverEmployeeId, handoverEmployees.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaveRequestsTable.createdAt));

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
});

// POST /api/leave/requests - Submit a new leave request
router.post("/leave/requests", authMiddleware, async (req, res): Promise<void> => {
  try {
    const {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      leavePeriodType = "full_day",
      handoverEmployeeId,
      emergencyContact,
      medicalCertificateNumber,
      days,
      reason,
      attachmentUrl,
    } = req.body;

    const requestedEmployeeId = employeeId ? parseInt(employeeId) : null;
    const ownEmployeeId = await currentEmployeeId(req);
    const targetEmployeeId = requestedEmployeeId ?? ownEmployeeId;

    if (!targetEmployeeId || (requestedEmployeeId && requestedEmployeeId !== ownEmployeeId && !(await canManageEmployee(req, requestedEmployeeId)))) {
      res.status(403).json({ error: "Forbidden: cannot submit leave for this employee" });
      return;
    }

    if (!leaveTypeId || !startDate || !endDate) {
      res.status(400).json({ error: "Leave type, start date, and end date are required" });
      return;
    }
    if (
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
      endDate < startDate
    ) {
      res.status(400).json({ error: "Leave end date must be on or after a valid start date" });
      return;
    }

    // Retrieve public holidays within date range to calculate working days accurately
    const startYear = new Date(startDate).getFullYear();
    const holidays = await db
      .select({ date: publicHolidaysTable.date })
      .from(publicHolidaysTable)
      .where(or(eq(publicHolidaysTable.year, startYear), eq(publicHolidaysTable.isRecurring, true)));

    const holidayDatesSet = new Set(holidays.map((h) => h.date));

    // Calculate working days excluding weekends and public holidays
    let computedWorkingDays = calculateWorkingDays(startDate, endDate, leavePeriodType, holidayDatesSet);
    if (computedWorkingDays <= 0) {
      // If employee explicitly submitted days override or fallback to minimum 0.5/1
      computedWorkingDays = days ? Math.max(0.5, parseFloat(days)) : 1;
    }

    const calculatedDaysStr = String(computedWorkingDays);

    const [newRequest] = await db
      .insert(leaveRequestsTable)
      .values({
        employeeId: targetEmployeeId,
        leaveTypeId: parseInt(leaveTypeId),
        startDate,
        endDate,
        days: calculatedDaysStr,
        reason: reason || "Standard Leave Request",
        attachmentUrl: attachmentUrl || null,
        handoverEmployeeId: handoverEmployeeId ? parseInt(handoverEmployeeId) : null,
        leavePeriodType: leavePeriodType || "full_day",
        emergencyContact: emergencyContact || null,
        medicalCertificateNumber: medicalCertificateNumber || null,
        status: "pending",
      })
      .returning();

    const [employee] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, targetEmployeeId));
    await createApproval("leave_request", newRequest.id, req.user?.userId ?? null, employee?.agencyId ?? null);

    // Increment pending days in balance if balance exists
    const currentYear = new Date(startDate).getFullYear();
    try {
      await db
        .update(leaveBalancesTable)
        .set({
          pendingDays: sql`COALESCE(pending_days, 0) + ${Number(calculatedDaysStr)}`,
          updatedAt: new Date(),
        })
        .where(and(eq(leaveBalancesTable.employeeId, targetEmployeeId), eq(leaveBalancesTable.leaveTypeId, parseInt(leaveTypeId)), eq(leaveBalancesTable.year, currentYear)));
    } catch (e) {
      // Balance record update non-blocking
    }

    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit leave request" });
  }
});

// PATCH /api/leave/requests/:id/status - Approve or reject single leave request
router.patch("/leave/requests/:id/status", authMiddleware, requireRole("admin", "hr_manager", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  try {
    const requestId = parseInt(req.params.id as string);
    const { status, approverComment } = req.body;

    if (!["approved", "rejected", "cancelled"].includes(status)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    const existing = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, requestId)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }

    const request = existing[0];
    if (!(await canManageEmployee(req, request.employeeId))) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }

    const [approval] = await db
      .select()
      .from(approvalInstancesTable)
      .where(and(eq(approvalInstancesTable.entityType, "leave_request"), eq(approvalInstancesTable.entityId, requestId)));

    if (approval?.status === "rejected" && status === "approved") {
      res.status(409).json({ error: "This request was rejected in the approval workflow" });
      return;
    }

    const [updated] = await db
      .update(leaveRequestsTable)
      .set({
        status,
        approverId: req.user?.userId ?? null,
        approverComment: approverComment || null,
        approvedAt: status === "approved" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(leaveRequestsTable.id, requestId))
      .returning();

    // Adjust balances
    const year = new Date(request.startDate).getFullYear();
    const daysNum = Number(request.days);

    if (status === "approved") {
      await db
        .update(leaveBalancesTable)
        .set({
          pendingDays: sql`GREATEST(0, COALESCE(pending_days, 0) - ${daysNum})`,
          usedDays: sql`COALESCE(used_days, 0) + ${daysNum}`,
          updatedAt: new Date(),
        })
        .where(and(eq(leaveBalancesTable.employeeId, request.employeeId), eq(leaveBalancesTable.leaveTypeId, request.leaveTypeId), eq(leaveBalancesTable.year, year)));
    } else {
      await db
        .update(leaveBalancesTable)
        .set({
          pendingDays: sql`GREATEST(0, COALESCE(pending_days, 0) - ${daysNum})`,
          updatedAt: new Date(),
        })
        .where(and(eq(leaveBalancesTable.employeeId, request.employeeId), eq(leaveBalancesTable.leaveTypeId, request.leaveTypeId), eq(leaveBalancesTable.year, year)));
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update leave request status" });
  }
});

// POST /api/leave/requests/bulk-status - Bulk approve or reject leave requests
router.post("/leave/requests/bulk-status", authMiddleware, requireRole("admin", "hr_manager", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  try {
    const { ids, status, approverComment } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Array of request IDs is required" });
      return;
    }
    if (!["approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status must be approved or rejected" });
      return;
    }

    const numericIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
    const existingRequests = await db
      .select()
      .from(leaveRequestsTable)
      .where(inArray(leaveRequestsTable.id, numericIds));

    let processedCount = 0;

    for (const reqRecord of existingRequests) {
      if (reqRecord.status !== "pending") continue;
      if (!(await canManageEmployee(req, reqRecord.employeeId))) continue;

      await db
        .update(leaveRequestsTable)
        .set({
          status,
          approverId: req.user?.userId ?? null,
          approverComment: approverComment || `Bulk ${status} by ${req.user?.email || "Officer"}`,
          approvedAt: status === "approved" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(leaveRequestsTable.id, reqRecord.id));

      const year = new Date(reqRecord.startDate).getFullYear();
      const daysNum = Number(reqRecord.days);

      if (status === "approved") {
        await db
          .update(leaveBalancesTable)
          .set({
            pendingDays: sql`GREATEST(0, COALESCE(pending_days, 0) - ${daysNum})`,
            usedDays: sql`COALESCE(used_days, 0) + ${daysNum}`,
            updatedAt: new Date(),
          })
          .where(and(eq(leaveBalancesTable.employeeId, reqRecord.employeeId), eq(leaveBalancesTable.leaveTypeId, reqRecord.leaveTypeId), eq(leaveBalancesTable.year, year)));
      } else {
        await db
          .update(leaveBalancesTable)
          .set({
            pendingDays: sql`GREATEST(0, COALESCE(pending_days, 0) - ${daysNum})`,
            updatedAt: new Date(),
          })
          .where(and(eq(leaveBalancesTable.employeeId, reqRecord.employeeId), eq(leaveBalancesTable.leaveTypeId, reqRecord.leaveTypeId), eq(leaveBalancesTable.year, year)));
      }

      processedCount++;
    }

    res.json({ success: true, processedCount, totalRequested: ids.length, status });
  } catch (error) {
    res.status(500).json({ error: "Failed to process bulk leave status updates" });
  }
});

// GET /api/leave/calendar - Team absence calendar schedule
router.get("/leave/calendar", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { start, end, department_id } = req.query;
    const agencyId = getTenantAgencyId(req);

    const conditions = [];
    if (agencyId != null) {
      conditions.push(eq(employeesTable.agencyId, agencyId));
    }
    if (department_id && department_id !== "all") {
      conditions.push(eq(employeesTable.departmentId, parseInt(department_id as string)));
    }

    // Default to current year or provided window
    if (start && typeof start === "string") {
      conditions.push(gte(leaveRequestsTable.endDate, start));
    }
    if (end && typeof end === "string") {
      conditions.push(lte(leaveRequestsTable.startDate, end));
    }

    // Only approved and pending leaves appear on calendar
    conditions.push(inArray(leaveRequestsTable.status, ["approved", "pending"]));

    const calendarLeaves = await db
      .select({
        id: leaveRequestsTable.id,
        employeeId: leaveRequestsTable.employeeId,
        employeeName: employeesTable.name,
        departmentName: departmentsTable.name,
        leaveTypeId: leaveRequestsTable.leaveTypeId,
        leaveTypeName: leaveTypesTable.name,
        leaveTypeCode: leaveTypesTable.code,
        startDate: leaveRequestsTable.startDate,
        endDate: leaveRequestsTable.endDate,
        days: leaveRequestsTable.days,
        status: leaveRequestsTable.status,
        leavePeriodType: leaveRequestsTable.leavePeriodType,
      })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .leftJoin(leaveTypesTable, eq(leaveRequestsTable.leaveTypeId, leaveTypesTable.id))
      .where(and(...conditions))
      .orderBy(leaveRequestsTable.startDate);

    res.json(calendarLeaves);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch absence calendar" });
  }
});

// GET /api/leave/analytics - Comprehensive interactive leave metrics & charts
router.get("/leave/analytics", authMiddleware, async (req, res): Promise<void> => {
  try {
    const currentYear = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const todayStr = new Date().toISOString().slice(0, 10);
    const agencyId = getTenantAgencyId(req);

    const agencyCondition = agencyId != null ? eq(employeesTable.agencyId, agencyId) : undefined;

    // 1. Total employees count
    const [empCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeesTable)
      .where(agencyCondition);

    // 2. Active staff on leave today
    const [activeToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .where(
        and(
          eq(leaveRequestsTable.status, "approved"),
          lte(leaveRequestsTable.startDate, todayStr),
          gte(leaveRequestsTable.endDate, todayStr),
          agencyCondition
        )
      );

    // 3. Pending approvals count
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .where(and(eq(leaveRequestsTable.status, "pending"), agencyCondition));

    // 4. Total leave days taken this year
    const [daysTaken] = await db
      .select({ total: sql<number>`COALESCE(sum(days::numeric), 0)::float` })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .where(
        and(
          eq(leaveRequestsTable.status, "approved"),
          sql`EXTRACT(YEAR FROM start_date) = ${currentYear}`,
          agencyCondition
        )
      );

    // 5. Total balance allocation & utilization rate
    const [balanceTotals] = await db
      .select({
        allocated: sql<number>`COALESCE(sum(allocated_days::numeric), 0)::float`,
        used: sql<number>`COALESCE(sum(used_days::numeric), 0)::float`,
      })
      .from(leaveBalancesTable)
      .innerJoin(employeesTable, eq(leaveBalancesTable.employeeId, employeesTable.id))
      .where(and(eq(leaveBalancesTable.year, currentYear), agencyCondition));

    const totalAllocated = Number(balanceTotals?.allocated || 0);
    const totalUsed = Number(balanceTotals?.used || 0);
    const utilizationRate = totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0;

    // 6. Leave distribution by leave type
    const byType = await db
      .select({
        typeId: leaveTypesTable.id,
        name: leaveTypesTable.name,
        code: leaveTypesTable.code,
        requestCount: sql<number>`count(${leaveRequestsTable.id})::int`,
        daysTaken: sql<number>`COALESCE(sum(CASE WHEN ${leaveRequestsTable.status} = 'approved' THEN ${leaveRequestsTable.days}::numeric ELSE 0 END), 0)::float`,
      })
      .from(leaveTypesTable)
      .leftJoin(
        leaveRequestsTable,
        and(
          eq(leaveTypesTable.id, leaveRequestsTable.leaveTypeId),
          sql`EXTRACT(YEAR FROM ${leaveRequestsTable.startDate}) = ${currentYear}`
        )
      )
      .groupBy(leaveTypesTable.id, leaveTypesTable.name, leaveTypesTable.code)
      .orderBy(desc(sql`daysTaken`));

    // 7. Monthly leave trends (Jan - Dec)
    const monthlyRequests = await db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${leaveRequestsTable.startDate})::int`,
        days: sql<number>`COALESCE(sum(${leaveRequestsTable.days}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .where(
        and(
          eq(leaveRequestsTable.status, "approved"),
          sql`EXTRACT(YEAR FROM ${leaveRequestsTable.startDate}) = ${currentYear}`,
          agencyCondition
        )
      )
      .groupBy(sql`EXTRACT(MONTH FROM ${leaveRequestsTable.startDate})`)
      .orderBy(sql`EXTRACT(MONTH FROM ${leaveRequestsTable.startDate})`);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrend = monthNames.map((name, index) => {
      const found = monthlyRequests.find((m) => m.month === index + 1);
      return {
        month: name,
        monthIndex: index + 1,
        days: found ? Number(found.days) : 0,
        count: found ? Number(found.count) : 0,
      };
    });

    // 8. Departmental leave distribution
    const byDepartment = await db
      .select({
        departmentName: departmentsTable.name,
        daysTaken: sql<number>`COALESCE(sum(CASE WHEN ${leaveRequestsTable.status} = 'approved' THEN ${leaveRequestsTable.days}::numeric ELSE 0 END), 0)::float`,
        pendingRequests: sql<number>`count(CASE WHEN ${leaveRequestsTable.status} = 'pending' THEN 1 ELSE NULL END)::int`,
      })
      .from(departmentsTable)
      .leftJoin(employeesTable, eq(departmentsTable.id, employeesTable.departmentId))
      .leftJoin(
        leaveRequestsTable,
        and(
          eq(employeesTable.id, leaveRequestsTable.employeeId),
          sql`EXTRACT(YEAR FROM ${leaveRequestsTable.startDate}) = ${currentYear}`
        )
      )
      .where(agencyId != null ? eq(departmentsTable.agencyId, agencyId) : undefined)
      .groupBy(departmentsTable.name)
      .orderBy(desc(sql`daysTaken`));

    // 9. Status distribution
    const statusCounts = await db
      .select({
        status: leaveRequestsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leaveRequestsTable)
      .innerJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .where(agencyCondition)
      .groupBy(leaveRequestsTable.status);

    res.json({
      summary: {
        totalEmployees: Number(empCount?.count || 0),
        activeOnLeaveToday: Number(activeToday?.count || 0),
        pendingApprovalsCount: Number(pendingCount?.count || 0),
        totalDaysTakenYear: Number(daysTaken?.total || 0),
        utilizationRate,
        currentYear,
      },
      byType,
      monthlyTrend,
      byDepartment,
      statusCounts: statusCounts.reduce((acc, curr) => ({ ...acc, [curr.status]: curr.count }), {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      }),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate leave analytics" });
  }
});

// GET /api/leave/holidays - List statutory public holidays
router.get("/leave/holidays", optionalAuth, async (req, res): Promise<void> => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const holidays = await db
      .select()
      .from(publicHolidaysTable)
      .where(or(eq(publicHolidaysTable.year, year), eq(publicHolidaysTable.isRecurring, true)))
      .orderBy(publicHolidaysTable.date);

    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch public holidays" });
  }
});

// POST /api/leave/holidays - Add statutory or agency public holiday
router.post("/leave/holidays", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { name, date, year, isRecurring, notes } = req.body;
    if (!name || !date) {
      res.status(400).json({ error: "Holiday name and date are required" });
      return;
    }

    const agencyId = getTenantAgencyId(req);
    const resolvedYear = year ? Number(year) : new Date(date).getFullYear();

    const [newHoliday] = await db
      .insert(publicHolidaysTable)
      .values({
        name,
        date,
        year: resolvedYear,
        isRecurring: Boolean(isRecurring),
        agencyId: agencyId ?? null,
        notes: notes || null,
      })
      .returning();

    res.status(201).json(newHoliday);
  } catch (error) {
    res.status(500).json({ error: "Failed to create public holiday" });
  }
});

// GET /api/leave/adjustments - List balance adjustments ledger
router.get("/leave/adjustments", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeId = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    const conditions = [];
    if (employeeId) {
      conditions.push(eq(leaveBalanceAdjustmentsTable.employeeId, employeeId));
    }
    if (year) {
      conditions.push(eq(leaveBalanceAdjustmentsTable.year, year));
    }

    const adjustments = await db
      .select({
        id: leaveBalanceAdjustmentsTable.id,
        employeeId: leaveBalanceAdjustmentsTable.employeeId,
        employeeName: employeesTable.name,
        leaveTypeId: leaveBalanceAdjustmentsTable.leaveTypeId,
        leaveTypeName: leaveTypesTable.name,
        year: leaveBalanceAdjustmentsTable.year,
        adjustmentDays: leaveBalanceAdjustmentsTable.adjustmentDays,
        adjustmentType: leaveBalanceAdjustmentsTable.adjustmentType,
        reason: leaveBalanceAdjustmentsTable.reason,
        authorizedByName: usersTable.name,
        createdAt: leaveBalanceAdjustmentsTable.createdAt,
      })
      .from(leaveBalanceAdjustmentsTable)
      .innerJoin(employeesTable, eq(leaveBalanceAdjustmentsTable.employeeId, employeesTable.id))
      .innerJoin(leaveTypesTable, eq(leaveBalanceAdjustmentsTable.leaveTypeId, leaveTypesTable.id))
      .leftJoin(usersTable, eq(leaveBalanceAdjustmentsTable.authorizedByUserId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leaveBalanceAdjustmentsTable.createdAt));

    res.json(adjustments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leave balance adjustments" });
  }
});

// POST /api/leave/adjustments - Apply a balance adjustment
router.post("/leave/adjustments", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { employeeId, leaveTypeId, year = 2026, adjustmentDays, adjustmentType = "accrual", reason } = req.body;

    if (!employeeId || !leaveTypeId || adjustmentDays === undefined || !reason) {
      res.status(400).json({ error: "Employee ID, Leave Type ID, adjustment days, and reason are required" });
      return;
    }

    const empId = parseInt(employeeId);
    const ltId = parseInt(leaveTypeId);
    const adjYear = parseInt(year);
    const delta = parseFloat(adjustmentDays);

    const [adjustment] = await db
      .insert(leaveBalanceAdjustmentsTable)
      .values({
        employeeId: empId,
        leaveTypeId: ltId,
        year: adjYear,
        adjustmentDays: String(delta),
        adjustmentType,
        reason,
        authorizedByUserId: req.user?.userId ?? null,
      })
      .returning();

    // Check if balance row exists, if so update allocatedDays, otherwise create
    const [existingBalance] = await db
      .select()
      .from(leaveBalancesTable)
      .where(and(eq(leaveBalancesTable.employeeId, empId), eq(leaveBalancesTable.leaveTypeId, ltId), eq(leaveBalancesTable.year, adjYear)));

    if (existingBalance) {
      await db
        .update(leaveBalancesTable)
        .set({
          allocatedDays: sql`GREATEST(0, COALESCE(allocated_days, 0) + ${delta})`,
          updatedAt: new Date(),
        })
        .where(eq(leaveBalancesTable.id, existingBalance.id));
    } else {
      await db.insert(leaveBalancesTable).values({
        employeeId: empId,
        leaveTypeId: ltId,
        year: adjYear,
        allocatedDays: String(Math.max(0, delta)),
        usedDays: "0",
        pendingDays: "0",
      });
    }

    res.status(201).json(adjustment);
  } catch (error) {
    res.status(500).json({ error: "Failed to record leave balance adjustment" });
  }
});

export default router;
