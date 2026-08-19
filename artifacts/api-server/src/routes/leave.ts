import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, leaveTypesTable, leaveBalancesTable, leaveRequestsTable, employeesTable, usersTable, approvalInstancesTable } from "@workspace/db";
import { authMiddleware, optionalAuth, requireRole } from "../middlewares/auth";
import { createApproval } from "./workflows";

const router: IRouter = Router();

// GET /api/leave/types - List all active leave types
router.get("/leave/types", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const types = await db.select().from(leaveTypesTable).where(eq(leaveTypesTable.active, true)).orderBy(leaveTypesTable.name);
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leave types" });
  }
});

// GET /api/leave/balances - Get balances for employee
router.get("/leave/balances", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    
    let targetEmployeeId = employeeIdParam;
    if (!targetEmployeeId) {
      const allEmps = await db.select().from(employeesTable).limit(1);
      if (allEmps.length > 0) targetEmployeeId = allEmps[0].id;
    }

    if (!targetEmployeeId) {
      res.json([]);
      return;
    }

    const currentYear = new Date().getFullYear();
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

    const requests = await db
      .select({
        id: leaveRequestsTable.id,
        employeeId: leaveRequestsTable.employeeId,
        employeeName: employeesTable.name,
        leaveTypeId: leaveRequestsTable.leaveTypeId,
        leaveTypeName: leaveTypesTable.name,
        startDate: leaveRequestsTable.startDate,
        endDate: leaveRequestsTable.endDate,
        days: leaveRequestsTable.days,
        reason: leaveRequestsTable.reason,
        status: leaveRequestsTable.status,
        approverId: leaveRequestsTable.approverId,
        approverComment: leaveRequestsTable.approverComment,
        approvedAt: leaveRequestsTable.approvedAt,
        attachmentUrl: leaveRequestsTable.attachmentUrl,
        createdAt: leaveRequestsTable.createdAt,
      })
      .from(leaveRequestsTable)
      .leftJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id))
      .leftJoin(leaveTypesTable, eq(leaveRequestsTable.leaveTypeId, leaveTypesTable.id))
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
    const { employeeId, leaveTypeId, startDate, endDate, days, reason, attachmentUrl } = req.body;
    const targetEmployeeId = employeeId ? parseInt(employeeId) : (req as any).user?.userId || 1;

    if (!leaveTypeId || !startDate || !endDate) {
      res.status(400).json({ error: "Leave type, start date, and end date are required" });
      return;
    }
    if (typeof startDate !== "string" || typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
      res.status(400).json({ error: "Leave end date must be on or after a valid start date" });
      return;
    }

    const calculatedDays = String(Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1);

    const [newRequest] = await db
      .insert(leaveRequestsTable)
      .values({
        employeeId: targetEmployeeId,
        leaveTypeId: parseInt(leaveTypeId),
        startDate,
        endDate,
        days: calculatedDays,
        reason: reason || "Standard Annual Leave Request",
        attachmentUrl: attachmentUrl || null,
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
          pendingDays: sql`COALESCE(pending_days, 0) + ${Number(calculatedDays)}`,
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

// PATCH /api/leave/requests/:id/status - Approve or reject leave request
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
    const [approval] = await db.select().from(approvalInstancesTable)
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

export default router;
