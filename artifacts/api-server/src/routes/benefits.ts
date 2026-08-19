import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, benefitsTable, benefitEnrollmentsTable, employeesTable } from "@workspace/db";
import { authMiddleware, optionalAuth, requireRole } from "../middlewares/auth";

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
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const conditions = [];
    if (employeeIdParam) conditions.push(eq(benefitEnrollmentsTable.employeeId, employeeIdParam));

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

    const targetEmployeeId = employeeId ? parseInt(employeeId) : (req as any).user?.userId || 1;

    if (!benefitId) {
      res.status(400).json({ error: "Benefit ID is required" });
      return;
    }

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
