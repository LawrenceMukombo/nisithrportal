import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, benefitsTable, benefitEnrollmentsTable, employeesTable } from "@workspace/db";
import { authMiddleware, optionalAuth, requireRole } from "../middlewares/auth";
import { canManageEmployee, canReadEmployee, currentEmployeeId, hasSensitiveReadAccess } from "../lib/employee-access";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

// GET /api/benefits - List benefits catalogue
router.get("/benefits", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const benefits = await db.select().from(benefitsTable).where(eq(benefitsTable.active, true)).orderBy(benefitsTable.name);
    res.json(benefits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch benefits" });
  }
});

// POST /api/benefits - Create benefit item
router.post("/benefits", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { name, type, description, provider, defaultCoverage, taxable } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: "Name and type are required" });
      return;
    }

    const [benefit] = await db
      .insert(benefitsTable)
      .values({
        name,
        type,
        description,
        provider,
        defaultCoverage,
        taxable: !!taxable,
        active: true,
      })
      .returning();

    res.status(201).json(benefit);
  } catch (error) {
    res.status(500).json({ error: "Failed to create benefit" });
  }
});

// GET /api/benefits/enrollments - List enrollments
router.get("/benefits/enrollments", authMiddleware, async (req, res): Promise<void> => {
  try {
    const requestedEmployeeId = req.query.employee_id ? Number.parseInt(req.query.employee_id as string, 10) : undefined;
    if (requestedEmployeeId !== undefined && !Number.isInteger(requestedEmployeeId)) {
      res.status(400).json({ error: "Invalid employee ID" }); return;
    }
    const ownEmployeeId = await currentEmployeeId(req);
    const employeeIdParam = requestedEmployeeId ?? (hasSensitiveReadAccess(req) ? undefined : ownEmployeeId ?? undefined);
    if (requestedEmployeeId !== undefined && !await canReadEmployee(req, requestedEmployeeId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (!hasSensitiveReadAccess(req) && !employeeIdParam) {
      res.status(403).json({ error: "No employee profile is linked to this account" }); return;
    }
    const conditions = [];
    if (employeeIdParam) conditions.push(eq(benefitEnrollmentsTable.employeeId, employeeIdParam));
    const tenantId = getTenantAgencyId(req);
    if (hasSensitiveReadAccess(req) && tenantId != null) conditions.push(eq(employeesTable.agencyId, tenantId));

    const enrollments = await db
      .select({
        id: benefitEnrollmentsTable.id,
        employeeId: benefitEnrollmentsTable.employeeId,
        employeeName: employeesTable.name,
        benefitId: benefitEnrollmentsTable.benefitId,
        benefitName: benefitsTable.name,
        benefitType: benefitsTable.type,
        provider: benefitsTable.provider,
        status: benefitEnrollmentsTable.status,
        coverageDetails: benefitEnrollmentsTable.coverageDetails,
        beneficiaryName: benefitEnrollmentsTable.beneficiaryName,
        beneficiaryRelationship: benefitEnrollmentsTable.beneficiaryRelationship,
        effectiveDate: benefitEnrollmentsTable.effectiveDate,
        expiryDate: benefitEnrollmentsTable.expiryDate,
        employeeContribution: benefitEnrollmentsTable.employeeContribution,
        employerContribution: benefitEnrollmentsTable.employerContribution,
      })
      .from(benefitEnrollmentsTable)
      .leftJoin(benefitsTable, eq(benefitEnrollmentsTable.benefitId, benefitsTable.id))
      .leftJoin(employeesTable, eq(benefitEnrollmentsTable.employeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(benefitEnrollmentsTable.effectiveDate));

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch benefit enrollments" });
  }
});

// POST /api/benefits/enrollments - Enroll employee
router.post("/benefits/enrollments", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, benefitId, coverageDetails, coverageLevel, policyNumber, beneficiaryName, beneficiaryRelationship, effectiveDate, employeeContribution, employerContribution } = req.body;

    const requestedEmployeeId = employeeId ? Number.parseInt(String(employeeId), 10) : null;
    if (employeeId && !Number.isInteger(requestedEmployeeId)) { res.status(400).json({ error: "Invalid employee ID" }); return; }
    const targetEmployeeId = requestedEmployeeId ?? await currentEmployeeId(req);

    if (!benefitId) {
      res.status(400).json({ error: "Benefit ID is required" });
      return;
    }
    if (!targetEmployeeId) { res.status(403).json({ error: "No employee profile is linked to this account" }); return; }
    const allowed = hasSensitiveReadAccess(req)
      ? await canManageEmployee(req, targetEmployeeId)
      : (await currentEmployeeId(req)) === targetEmployeeId && await canReadEmployee(req, targetEmployeeId);
    if (!allowed) { res.status(403).json({ error: "Forbidden" }); return; }

    const [enrollment] = await db
      .insert(benefitEnrollmentsTable)
      .values({
        employeeId: targetEmployeeId,
        benefitId: parseInt(benefitId),
        coverageDetails: coverageDetails || coverageLevel || (policyNumber ? `Policy: ${policyNumber}` : null),
        beneficiaryName: beneficiaryName || null,
        beneficiaryRelationship: beneficiaryRelationship || null,
        effectiveDate: effectiveDate || new Date().toISOString().split("T")[0],
        employeeContribution: employeeContribution ? String(employeeContribution) : "0",
        employerContribution: employerContribution ? String(employerContribution) : "0",
        status: "active",
      })
      .returning();

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: "Failed to enroll employee in benefit" });
  }
});

export default router;
