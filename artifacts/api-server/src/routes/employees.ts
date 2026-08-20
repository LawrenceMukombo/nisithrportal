import { Router, type IRouter } from "express";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { db, employeesTable, departmentsTable, positionsTable, employeePositionHistoryTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { writeAuditLog } from "../lib/audit";
import { canReadEmployee } from "../lib/employee-access";

const router: IRouter = Router();

function isEmployableDateOfBirth(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return true;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const today = new Date();
  const minimumEmploymentDate = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
  return parsed <= minimumEmploymentDate;
}

// GET /api/employees/me - Self-service master record for logged in user
router.get("/employees/me", authMiddleware, async (req, res): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, employeeId: usersTable.employeeId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    let emp = null;
    if (user.employeeId) {
      [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, user.employeeId));
    }
    if (!emp && user.email) {
      [emp] = await db.select().from(employeesTable).where(eq(employeesTable.email, user.email));
    }

    if (!emp) {
      res.status(404).json({ error: "No employee master record linked to your account" });
      return;
    }

    res.json(emp);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// GET /api/employees - List employees with advanced filters & search
router.get("/employees", authMiddleware, requireRole("admin", "hr_officer", "executive", "hiring_manager"), async (req, res): Promise<void> => {
  try {
    const { department_id, position_id, status, grade_level, employment_type, q } = req.query as Record<string, string | undefined>;
    const conditions = [];

    const tenantAgencyId = getTenantAgencyId(req);
    if (tenantAgencyId != null) {
      conditions.push(eq(employeesTable.agencyId, tenantAgencyId));
    }

    if (department_id) conditions.push(eq(employeesTable.departmentId, parseInt(department_id, 10)));
    if (position_id) conditions.push(eq(employeesTable.positionId, parseInt(position_id, 10)));
    if (status && status !== "all") conditions.push(eq(employeesTable.status, status));
    if (grade_level) conditions.push(eq(employeesTable.gradeLevel, grade_level));
    if (employment_type) conditions.push(eq(employeesTable.employmentType, employment_type));

    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(employeesTable.name, searchTerm),
          ilike(employeesTable.employeeNumber, searchTerm),
          ilike(employeesTable.email, searchTerm),
          ilike(employeesTable.nationalId, searchTerm),
          ilike(employeesTable.phone, searchTerm)
        )
      );
    }

    const selectFields = {
      id: employeesTable.id,
      employeeNumber: employeesTable.employeeNumber,
      name: employeesTable.name,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      middleName: employeesTable.middleName,
      email: employeesTable.email,
      phone: employeesTable.phone,
      dateOfBirth: employeesTable.dateOfBirth,
      gender: employeesTable.gender,
      maritalStatus: employeesTable.maritalStatus,
      nationalId: employeesTable.nationalId,
      passportNumber: employeesTable.passportNumber,
      photoUrl: employeesTable.photoUrl,
      residentialAddress: employeesTable.residentialAddress,
      postalAddress: employeesTable.postalAddress,
      city: employeesTable.city,
      province: employeesTable.province,
      emergencyContactName: employeesTable.emergencyContactName,
      emergencyContactPhone: employeesTable.emergencyContactPhone,
      emergencyContactRelationship: employeesTable.emergencyContactRelationship,
      emergencyContactAddress: employeesTable.emergencyContactAddress,
      positionId: employeesTable.positionId,
      position: positionsTable.title,
      positionTitle: positionsTable.title,
      departmentId: employeesTable.departmentId,
      department: departmentsTable.name,
      departmentName: departmentsTable.name,
      agencyId: employeesTable.agencyId,
      supervisorId: employeesTable.supervisorId,
      gradeLevel: employeesTable.gradeLevel,
      division: employeesTable.division,
      unit: employeesTable.unit,
      employmentType: employeesTable.employmentType,
      contractId: employeesTable.contractId,
      status: employeesTable.status,
      startDate: employeesTable.startDate,
      probationStartDate: employeesTable.probationStartDate,
      probationEndDate: employeesTable.probationEndDate,
      confirmationDate: employeesTable.confirmationDate,
      separationDate: employeesTable.separationDate,
      separationReason: employeesTable.separationReason,
      createdAt: employeesTable.createdAt,
      updatedAt: employeesTable.updatedAt,
    };

    const results = conditions.length > 0
      ? await db
          .select(selectFields)
          .from(employeesTable)
          .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
          .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
          .where(and(...conditions))
          .orderBy(employeesTable.name)
      : await db
          .select(selectFields)
          .from(employeesTable)
          .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
          .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
          .orderBy(employeesTable.name);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to list employees" });
  }
});

// POST /api/employees - Create employee master record
router.post("/employees", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const agencyId = getTenantAgencyId(req) ?? req.body.agencyId ?? 1;
    const {
      name, firstName, lastName, middleName, email, phone,
      dateOfBirth, gender, maritalStatus, nationalId, passportNumber, photoUrl,
      residentialAddress, postalAddress, city, province,
      emergencyContactName, emergencyContactPhone, emergencyContactRelationship, emergencyContactAddress,
      positionId, departmentId, supervisorId, gradeLevel, division, unit, employmentType,
      status, startDate, probationStartDate, probationEndDate, confirmationDate
    } = req.body;

    if (!isEmployableDateOfBirth(dateOfBirth)) {
      res.status(400).json({ error: "Date of birth must be a valid date for an employee aged 18 or older" });
      return;
    }

    if (!name && (!firstName || !lastName)) {
      res.status(400).json({ error: "Employee name is required" });
      return;
    }

    const fullName = name || [firstName, middleName, lastName].filter(Boolean).join(" ");

    // Duplicate detection check
    if (email) {
      const [existingByEmail] = await db
        .select({ id: employeesTable.id })
        .from(employeesTable)
        .where(eq(employeesTable.email, email.toLowerCase().trim()));
      if (existingByEmail) {
        res.status(409).json({ error: `An employee with email "${email}" already exists (ID #${existingByEmail.id}).` });
        return;
      }
    }

    if (nationalId) {
      const [existingByNid] = await db
        .select({ id: employeesTable.id })
        .from(employeesTable)
        .where(eq(employeesTable.nationalId, nationalId.trim()));
      if (existingByNid) {
        res.status(409).json({ error: `An employee with National ID "${nationalId}" already exists (ID #${existingByNid.id}).` });
        return;
      }
    }

    // Auto-generate employee number if not explicitly passed
    let empNumber = req.body.employeeNumber;
    if (!empNumber) {
      const [maxRec] = await db
        .select({ maxId: sql<number>`COALESCE(MAX(id), 0)` })
        .from(employeesTable);
      const nextNum = (maxRec?.maxId || 0) + 1;
      empNumber = `NISIT-EMP-${String(10000 + nextNum)}`;
    }

    const [employee] = await db.insert(employeesTable).values({
      employeeNumber: empNumber,
      name: fullName,
      firstName: firstName || null,
      lastName: lastName || null,
      middleName: middleName || null,
      email: email ? email.toLowerCase().trim() : null,
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      maritalStatus: maritalStatus || null,
      nationalId: nationalId || null,
      passportNumber: passportNumber || null,
      photoUrl: photoUrl || null,
      residentialAddress: residentialAddress || null,
      postalAddress: postalAddress || null,
      city: city || "Port Moresby",
      province: province || "National Capital District",
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      emergencyContactRelationship: emergencyContactRelationship || null,
      emergencyContactAddress: emergencyContactAddress || null,
      positionId: positionId ? parseInt(positionId, 10) : null,
      departmentId: departmentId ? parseInt(departmentId, 10) : null,
      supervisorId: supervisorId ? parseInt(supervisorId, 10) : null,
      gradeLevel: gradeLevel || "Grade 10",
      division: division || null,
      unit: unit || null,
      employmentType: employmentType || "permanent",
      agencyId,
      status: status || "active",
      startDate: startDate || new Date().toISOString().split("T")[0],
      probationStartDate: probationStartDate || null,
      probationEndDate: probationEndDate || null,
      confirmationDate: confirmationDate || null,
    }).returning();

    // Record initial appointment in position history
    await db.insert(employeePositionHistoryTable).values({
      employeeId: employee.id,
      positionId: employee.positionId,
      departmentId: employee.departmentId,
      gradeLevel: employee.gradeLevel,
      startDate: employee.startDate || new Date().toISOString().split("T")[0],
      changeType: "appointment",
      notes: "Initial appointment to NISIT personnel directory",
      changedByUserId: req.user?.userId || null,
    });

    // Write audit log
    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: null,
      targetEmail: employee.email,
      actionType: "employee_create",
      outcome: "success",
      details: { employeeId: employee.id, employeeNumber: employee.employeeNumber, departmentId: employee.departmentId, positionId: employee.positionId },
      agencyId,
    });

    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: "Failed to create employee record" });
  }
});

// GET /api/employees/:id - Fetch single employee master record
router.get("/employees/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    if (!await canReadEmployee(req, id)) {
      res.status(403).json({ error: "Forbidden: no access to this employee record" });
      return;
    }

    // Lookup supervisor info if assigned
    let supervisor = null;
    if (employee.supervisorId) {
      [supervisor] = await db
        .select({ id: employeesTable.id, name: employeesTable.name, employeeNumber: employeesTable.employeeNumber, email: employeesTable.email })
        .from(employeesTable)
        .where(eq(employeesTable.id, employee.supervisorId));
    }

    res.json({ ...employee, supervisor });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch employee record" });
  }
});

// GET /api/employees/:id/history - Fetch position / promotion history
router.get("/employees/:id/history", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }
    if (!await canReadEmployee(req, id)) {
      res.status(403).json({ error: "Forbidden: no access to this employee history" });
      return;
    }

    const history = await db
      .select({
        id: employeePositionHistoryTable.id,
        employeeId: employeePositionHistoryTable.employeeId,
        positionId: employeePositionHistoryTable.positionId,
        positionTitle: positionsTable.title,
        departmentId: employeePositionHistoryTable.departmentId,
        departmentName: departmentsTable.name,
        gradeLevel: employeePositionHistoryTable.gradeLevel,
        startDate: employeePositionHistoryTable.startDate,
        endDate: employeePositionHistoryTable.endDate,
        changeType: employeePositionHistoryTable.changeType,
        notes: employeePositionHistoryTable.notes,
        createdAt: employeePositionHistoryTable.createdAt,
      })
      .from(employeePositionHistoryTable)
      .leftJoin(positionsTable, eq(employeePositionHistoryTable.positionId, positionsTable.id))
      .leftJoin(departmentsTable, eq(employeePositionHistoryTable.departmentId, departmentsTable.id))
      .where(eq(employeePositionHistoryTable.employeeId, id))
      .orderBy(desc(employeePositionHistoryTable.startDate));

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch employee history" });
  }
});

// PATCH /api/employees/:id - Update employee master record
router.patch("/employees/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const [existing] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const {
      name, firstName, lastName, middleName, email, phone,
      dateOfBirth, gender, maritalStatus, nationalId, passportNumber, photoUrl,
      residentialAddress, postalAddress, city, province,
      emergencyContactName, emergencyContactPhone, emergencyContactRelationship, emergencyContactAddress,
      positionId, departmentId, supervisorId, gradeLevel, division, unit, employmentType,
      status, startDate, probationStartDate, probationEndDate, confirmationDate, separationDate, separationReason
    } = req.body;

    if (!isEmployableDateOfBirth(dateOfBirth)) {
      res.status(400).json({ error: "Date of birth must be a valid date for an employee aged 18 or older" });
      return;
    }

    const isPositionOrDeptChanged =
      (positionId && parseInt(positionId, 10) !== existing.positionId) ||
      (departmentId && parseInt(departmentId, 10) !== existing.departmentId) ||
      (gradeLevel && gradeLevel !== existing.gradeLevel);

    const [updated] = await db.update(employeesTable)
      .set({
        name: name !== undefined ? name : existing.name,
        firstName: firstName !== undefined ? firstName : existing.firstName,
        lastName: lastName !== undefined ? lastName : existing.lastName,
        middleName: middleName !== undefined ? middleName : existing.middleName,
        email: email !== undefined ? email : existing.email,
        phone: phone !== undefined ? phone : existing.phone,
        dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth || null) : existing.dateOfBirth,
        gender: gender !== undefined ? gender : existing.gender,
        maritalStatus: maritalStatus !== undefined ? maritalStatus : existing.maritalStatus,
        nationalId: nationalId !== undefined ? nationalId : existing.nationalId,
        passportNumber: passportNumber !== undefined ? passportNumber : existing.passportNumber,
        photoUrl: photoUrl !== undefined ? photoUrl : existing.photoUrl,
        residentialAddress: residentialAddress !== undefined ? residentialAddress : existing.residentialAddress,
        postalAddress: postalAddress !== undefined ? postalAddress : existing.postalAddress,
        city: city !== undefined ? city : existing.city,
        province: province !== undefined ? province : existing.province,
        emergencyContactName: emergencyContactName !== undefined ? emergencyContactName : existing.emergencyContactName,
        emergencyContactPhone: emergencyContactPhone !== undefined ? emergencyContactPhone : existing.emergencyContactPhone,
        emergencyContactRelationship: emergencyContactRelationship !== undefined ? emergencyContactRelationship : existing.emergencyContactRelationship,
        emergencyContactAddress: emergencyContactAddress !== undefined ? emergencyContactAddress : existing.emergencyContactAddress,
        positionId: positionId !== undefined ? (positionId ? parseInt(positionId, 10) : null) : existing.positionId,
        departmentId: departmentId !== undefined ? (departmentId ? parseInt(departmentId, 10) : null) : existing.departmentId,
        supervisorId: supervisorId !== undefined ? (supervisorId ? parseInt(supervisorId, 10) : null) : existing.supervisorId,
        gradeLevel: gradeLevel !== undefined ? gradeLevel : existing.gradeLevel,
        division: division !== undefined ? division : existing.division,
        unit: unit !== undefined ? unit : existing.unit,
        employmentType: employmentType !== undefined ? employmentType : existing.employmentType,
        status: status !== undefined ? status : existing.status,
        startDate: startDate !== undefined ? startDate : existing.startDate,
        probationStartDate: probationStartDate !== undefined ? probationStartDate : existing.probationStartDate,
        probationEndDate: probationEndDate !== undefined ? probationEndDate : existing.probationEndDate,
        confirmationDate: confirmationDate !== undefined ? confirmationDate : existing.confirmationDate,
        separationDate: separationDate !== undefined ? separationDate : existing.separationDate,
        separationReason: separationReason !== undefined ? separationReason : existing.separationReason,
        updatedAt: new Date(),
      })
      .where(eq(employeesTable.id, id))
      .returning();

    // Record career transition history if position/department/grade changed
    if (isPositionOrDeptChanged) {
      await db.insert(employeePositionHistoryTable).values({
        employeeId: id,
        positionId: updated.positionId,
        departmentId: updated.departmentId,
        gradeLevel: updated.gradeLevel,
        startDate: new Date().toISOString().split("T")[0],
        changeType: "promotion",
        notes: `Updated to ${updated.gradeLevel || "Standard Grade"} in department #${updated.departmentId}`,
        changedByUserId: req.user?.userId || null,
      });

      await writeAuditLog({
        performedById: req.user?.userId ?? null,
        performedByEmail: req.user?.email ?? null,
        targetUserId: null,
        targetEmail: updated.email,
        actionType: "employee_position_change",
        outcome: "success",
        details: { employeeId: id, oldPosition: existing.positionId, newPosition: updated.positionId, oldGrade: existing.gradeLevel, newGrade: updated.gradeLevel },
        agencyId: existing.agencyId || 1,
      });
    } else {
      await writeAuditLog({
        performedById: req.user?.userId ?? null,
        performedByEmail: req.user?.email ?? null,
        targetUserId: null,
        targetEmail: updated.email,
        actionType: "employee_update",
        outcome: "success",
        details: { employeeId: id, updatedFields: Object.keys(req.body) },
        agencyId: existing.agencyId || 1,
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update employee record" });
  }
});

export default router;
