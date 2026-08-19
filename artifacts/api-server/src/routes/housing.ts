import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, housingSchemesTable, housingApplicationsTable, employeesTable, positionsTable } from "@workspace/db";
import { authMiddleware, optionalAuth, requireRole } from "../middlewares/auth";
import { createApproval } from "./workflows";
import { currentEmployeeId, hasSensitiveReadAccess, canManageEmployee } from "../lib/employee-access";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

// GET /api/housing/schemes - List schemes
router.get("/housing/schemes", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const schemes = await db.select().from(housingSchemesTable).where(eq(housingSchemesTable.active, true)).orderBy(housingSchemesTable.title);
    res.json(schemes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch housing schemes" });
  }
});

// POST /api/housing/schemes - Create scheme (HR/Admin)
router.post("/housing/schemes", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { title, schemeType, eligibilityCriteria, maxMonthlyAllowance, description } = req.body;
    if (!title || !eligibilityCriteria) {
      res.status(400).json({ error: "Title and eligibility criteria are required" });
      return;
    }

    const [scheme] = await db
      .insert(housingSchemesTable)
      .values({
        title,
        schemeType: schemeType || "institutional_rental",
        eligibilityCriteria,
        maxMonthlyAllowance: maxMonthlyAllowance ? String(maxMonthlyAllowance) : null,
        description,
        active: true,
      })
      .returning();

    res.status(201).json(scheme);
  } catch (error) {
    res.status(500).json({ error: "Failed to create housing scheme" });
  }
});

// GET /api/housing/applications - List applications
router.get("/housing/applications", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const statusParam = req.query.status as string | undefined;

    const conditions = [];
    if (employeeIdParam) conditions.push(eq(housingApplicationsTable.employeeId, employeeIdParam));
    if (statusParam && statusParam !== "all") conditions.push(eq(housingApplicationsTable.status, statusParam));
    if (hasSensitiveReadAccess(req)) {
      const agencyId = getTenantAgencyId(req);
      if (agencyId != null) conditions.push(eq(employeesTable.agencyId, agencyId));
    } else {
      const ownEmployeeId = await currentEmployeeId(req);
      if (!ownEmployeeId || (employeeIdParam && employeeIdParam !== ownEmployeeId)) { res.status(403).json({ error: "Forbidden" }); return; }
      conditions.push(eq(housingApplicationsTable.employeeId, ownEmployeeId));
    }

    const applications = await db
      .select({
        id: housingApplicationsTable.id,
        employeeId: housingApplicationsTable.employeeId,
        employeeName: employeesTable.name,
        employeePosition: positionsTable.title,
        schemeId: housingApplicationsTable.schemeId,
        schemeTitle: housingSchemesTable.title,
        schemeType: housingSchemesTable.schemeType,
        propertyAddress: housingApplicationsTable.propertyAddress,
        landlordName: housingApplicationsTable.landlordName,
        monthlyRentRequested: housingApplicationsTable.monthlyRentRequested,
        leasePeriodMonths: housingApplicationsTable.leasePeriodMonths,
        status: housingApplicationsTable.status,
        reviewedByUserId: housingApplicationsTable.reviewedByUserId,
        reviewComments: housingApplicationsTable.reviewComments,
        approvedAmount: housingApplicationsTable.approvedAmount,
        approvedAt: housingApplicationsTable.approvedAt,
        createdAt: housingApplicationsTable.createdAt,
      })
      .from(housingApplicationsTable)
      .leftJoin(housingSchemesTable, eq(housingApplicationsTable.schemeId, housingSchemesTable.id))
      .leftJoin(employeesTable, eq(housingApplicationsTable.employeeId, employeesTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(housingApplicationsTable.createdAt));

    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch housing applications" });
  }
});

// POST /api/housing/applications - Submit housing application
router.post("/housing/applications", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, schemeId, propertyAddress, landlordName, monthlyRentRequested, leasePeriodMonths } = req.body;
    const requestedEmployeeId = employeeId ? parseInt(employeeId) : null;
    const ownEmployeeId = await currentEmployeeId(req);
    const targetEmployeeId = requestedEmployeeId ?? ownEmployeeId;
    if (!targetEmployeeId || (requestedEmployeeId && requestedEmployeeId !== ownEmployeeId && !await canManageEmployee(req, requestedEmployeeId))) { res.status(403).json({ error: "Forbidden: cannot submit for this employee" }); return; }

    if (!propertyAddress) {
      res.status(400).json({ error: "Property address is required" });
      return;
    }

    const [application] = await db
      .insert(housingApplicationsTable)
      .values({
        employeeId: targetEmployeeId,
        schemeId: schemeId ? parseInt(schemeId) : 1,
        propertyAddress,
        landlordName: landlordName || null,
        monthlyRentRequested: monthlyRentRequested ? String(monthlyRentRequested) : "2500",
        leasePeriodMonths: leasePeriodMonths ? parseInt(leasePeriodMonths) : 12,
        status: "submitted",
      })
      .returning();

    const [employee] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, targetEmployeeId));
    await createApproval("housing_application", application.id, req.user?.userId ?? null, employee?.agencyId ?? null);

    res.status(201).json(application);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit housing application" });
  }
});

// PATCH /api/housing/applications/:id/status - Review / approve / reject
router.patch("/housing/applications/:id/status", authMiddleware, requireRole("admin", "hr_manager", "hr_officer", "executive"), async (req, res): Promise<void> => {
  try {
    const appId = parseInt(req.params.id as string);
    const { status, reviewComments, approvedAmount } = req.body;
    const [existing] = await db.select({ employeeId: housingApplicationsTable.employeeId }).from(housingApplicationsTable).where(eq(housingApplicationsTable.id, appId));
    if (!existing || !await canManageEmployee(req, existing.employeeId)) { res.status(404).json({ error: "Housing application not found" }); return; }

    const [updated] = await db
      .update(housingApplicationsTable)
      .set({
        status,
        reviewComments: reviewComments || undefined,
        approvedAmount: approvedAmount !== undefined ? String(approvedAmount) : undefined,
        reviewedByUserId: req.user?.userId,
        approvedAt: status === "approved" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(housingApplicationsTable.id, appId))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update housing application" });
  }
});

export default router;
