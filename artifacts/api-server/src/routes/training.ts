import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, trainingCoursesTable, trainingEnrollmentsTable, employeesTable } from "@workspace/db";
import { authMiddleware, optionalAuth, requireRole } from "../middlewares/auth";
import { canManageEmployee, canReadEmployee, currentEmployeeId, hasSensitiveReadAccess } from "../lib/employee-access";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

// GET /api/training/courses - List training catalogue
router.get("/training/courses", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const courses = await db.select().from(trainingCoursesTable).where(eq(trainingCoursesTable.active, true)).orderBy(trainingCoursesTable.title);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch training courses" });
  }
});

// POST /api/training/courses - Create training course (HR/Admin)
router.post("/training/courses", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { title, category, provider, durationHours, description, validityMonths, isMandatory } = req.body;

    if (!title || !category || !provider) {
      res.status(400).json({ error: "Title, category, and provider are required" });
      return;
    }

    const [course] = await db
      .insert(trainingCoursesTable)
      .values({
        title,
        category,
        provider,
        durationHours: durationHours ? parseInt(durationHours) : 8,
        description,
        validityMonths: validityMonths ? parseInt(validityMonths) : 24,
        isMandatory: !!isMandatory,
        active: true,
      })
      .returning();

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: "Failed to create training course" });
  }
});

// GET /api/training/enrollments - List enrollments
router.get("/training/enrollments", authMiddleware, async (req, res): Promise<void> => {
  try {
    const requestedEmployeeId = req.query.employee_id ? Number.parseInt(req.query.employee_id as string, 10) : undefined;
    if (requestedEmployeeId !== undefined && !Number.isInteger(requestedEmployeeId)) { res.status(400).json({ error: "Invalid employee ID" }); return; }
    const ownEmployeeId = await currentEmployeeId(req);
    const employeeIdParam = requestedEmployeeId ?? (hasSensitiveReadAccess(req) ? undefined : ownEmployeeId ?? undefined);
    if (requestedEmployeeId !== undefined && !await canReadEmployee(req, requestedEmployeeId)) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!hasSensitiveReadAccess(req) && !employeeIdParam) { res.status(403).json({ error: "No employee profile is linked to this account" }); return; }
    const courseIdParam = req.query.course_id ? parseInt(req.query.course_id as string) : undefined;

    const conditions = [];
    if (employeeIdParam) conditions.push(eq(trainingEnrollmentsTable.employeeId, employeeIdParam));
    const tenantId = getTenantAgencyId(req);
    if (hasSensitiveReadAccess(req) && tenantId != null) conditions.push(eq(employeesTable.agencyId, tenantId));
    if (courseIdParam) conditions.push(eq(trainingEnrollmentsTable.courseId, courseIdParam));

    const enrollments = await db
      .select({
        id: trainingEnrollmentsTable.id,
        employeeId: trainingEnrollmentsTable.employeeId,
        employeeName: employeesTable.name,
        courseId: trainingEnrollmentsTable.courseId,
        courseTitle: trainingCoursesTable.title,
        courseCategory: trainingCoursesTable.category,
        courseProvider: trainingCoursesTable.provider,
        status: trainingEnrollmentsTable.status,
        enrolledAt: trainingEnrollmentsTable.enrolledAt,
        completedAt: trainingEnrollmentsTable.completedAt,
        score: trainingEnrollmentsTable.score,
        certificateNumber: trainingEnrollmentsTable.certificateNumber,
        certificateUrl: trainingEnrollmentsTable.certificateUrl,
        expiryDate: trainingEnrollmentsTable.expiryDate,
        notes: trainingEnrollmentsTable.notes,
      })
      .from(trainingEnrollmentsTable)
      .leftJoin(trainingCoursesTable, eq(trainingEnrollmentsTable.courseId, trainingCoursesTable.id))
      .leftJoin(employeesTable, eq(trainingEnrollmentsTable.employeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trainingEnrollmentsTable.enrolledAt));

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch training enrollments" });
  }
});

// POST /api/training/enroll and /api/training/enrollments - Enroll employee
router.post(["/training/enroll", "/training/enrollments"], authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, courseId, notes } = req.body;

    if (!courseId) {
      res.status(400).json({ error: "Course ID is required" });
      return;
    }

    let targetEmployeeId: number | null = null;
    if (employeeId) {
      targetEmployeeId = parseInt(String(employeeId), 10);
    } else {
      targetEmployeeId = await currentEmployeeId(req);
    }
    if (!targetEmployeeId || !Number.isInteger(targetEmployeeId)) { res.status(403).json({ error: "No employee profile is linked to this account" }); return; }
    const allowed = hasSensitiveReadAccess(req)
      ? await canManageEmployee(req, targetEmployeeId)
      : (await currentEmployeeId(req)) === targetEmployeeId && await canReadEmployee(req, targetEmployeeId);
    if (!allowed) { res.status(403).json({ error: "Forbidden" }); return; }

    const [enrollment] = await db
      .insert(trainingEnrollmentsTable)
      .values({
        employeeId: targetEmployeeId,
        courseId: parseInt(String(courseId), 10),
        status: "enrolled",
        notes,
      })
      .returning();

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: "Failed to enroll in training" });
  }
});

// PATCH /api/training/enrollments/:id - Complete or update enrollment
router.patch("/training/enrollments/:id", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const enrollmentId = parseInt(req.params.id as string);
    const { status, score, certificateNumber, certificateUrl, expiryDate, notes } = req.body;

    const [existing] = await db.select({ employeeId: trainingEnrollmentsTable.employeeId }).from(trainingEnrollmentsTable).where(eq(trainingEnrollmentsTable.id, enrollmentId));
    if (!existing) { res.status(404).json({ error: "Enrollment not found" }); return; }
    if (!await canManageEmployee(req, existing.employeeId)) { res.status(403).json({ error: "Forbidden" }); return; }
    const [updated] = await db
      .update(trainingEnrollmentsTable)
      .set({
        status: status || undefined,
        score: score !== undefined ? String(score) : undefined,
        certificateNumber: certificateNumber || undefined,
        certificateUrl: certificateUrl || undefined,
        expiryDate: expiryDate || undefined,
        completedAt: status === "completed" ? new Date() : undefined,
        notes: notes !== undefined ? notes : undefined,
        updatedAt: new Date(),
      })
      .where(eq(trainingEnrollmentsTable.id, enrollmentId))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update training enrollment" });
  }
});

export default router;
