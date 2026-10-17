import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, departmentsTable, positionsTable, employeesTable, agenciesTable } from "@workspace/db";
import { authMiddleware, requireRole, optionalAuth } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();

// GET /api/org-chart - Generate full organizational hierarchy tree
router.get("/org-chart", optionalAuth, async (req, res): Promise<void> => {
  try {
    const agencies = await db.select().from(agenciesTable).limit(1);
    const agency = agencies[0] || { id: 1, name: "National Institute of Standards & Industrial Technology (NISIT)", configuration: null };

    const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.agencyId, agency.id)).orderBy(departmentsTable.name);
    // If no agency depts found, fallback to all depts (exclude legacy non-statutory mock departments)
    const activeDepts = (depts.length > 0 ? depts : await db.select().from(departmentsTable).orderBy(departmentsTable.name)).filter((d) => d.code !== "DIV-ADM");

    const positions = await db.select().from(positionsTable).where(eq(positionsTable.status, "active")).orderBy(positionsTable.title);
    const employees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active")).orderBy(employeesTable.name);

    // Group employees by department and map filled vs vacant positions
    const deptsWithStaff = activeDepts.map((d) => {
      const deptEmployees = employees.filter((e) => e.departmentId === d.id);
      const deptPositions = positions.filter((p) => p.departmentId === d.id);
      
      const lead = deptEmployees[0] || null;

      const positionsWithIncumbents = deptPositions.map((p) => {
        // Find all active employees holding this position
        const assignedEmps = deptEmployees.filter((e) => e.positionId === p.id);
        const filledCount = assignedEmps.length;
        const totalCount = p.totalCount || 1;
        const vacantCount = Math.max(0, totalCount - filledCount);

        const parentPos = positions.find((parent) => parent.id === p.parentPositionId);

        return {
          id: p.id,
          title: p.title,
          code: p.positionCode || `POS-${String(p.id).padStart(3, "0")}`,
          positionCode: p.positionCode || `POS-${String(p.id).padStart(3, "0")}`,
          departmentId: p.departmentId,
          gradeLevel: p.gradeLevel || "Grade 10",
          parentPositionId: p.parentPositionId ?? null,
          parentPositionCode: parentPos?.positionCode ?? null,
          parentPositionTitle: parentPos?.title ?? p.reportsToTitle ?? null,
          reportsToTitle: p.reportsToTitle ?? parentPos?.title ?? null,
          jobDescription: p.jobDescription,
          filledCount,
          totalCount,
          vacantCount,
          isVacant: vacantCount > 0,
          incumbents: assignedEmps.map((e) => ({
            id: e.id,
            employeeNumber: e.employeeNumber || `EMP-${e.id}`,
            name: e.name,
            email: e.email,
            phone: e.phone,
            gradeLevel: e.gradeLevel || "Grade 10",
            status: e.status,
            photoUrl: e.photoUrl,
            startDate: e.startDate,
          })),
        };
      });

      return {
        id: d.id,
        name: d.name,
        code: d.code || `DIV-${d.id}`,
        headcount: deptEmployees.length,
        positionsCount: deptPositions.length,
        lead: lead ? { id: lead.id, name: lead.name, email: lead.email } : null,
        members: deptEmployees.map((e) => {
          const empPos = positions.find((p) => p.id === e.positionId);
          return {
            id: e.id,
            employeeNumber: e.employeeNumber || `EMP-${e.id}`,
            name: e.name,
            title: empPos?.title || "Officer",
            gradeLevel: e.gradeLevel || "Grade 10",
            email: e.email,
            phone: e.phone,
            startDate: e.startDate,
          };
        }),
        positions: positionsWithIncumbents,
      };
    });

    const totalHeadcount = employees.length;
    const totalApprovedPositions = deptsWithStaff.reduce(
      (sum, d) => sum + d.positions.reduce((psum, p) => psum + p.totalCount, 0),
      0
    );
    const totalFilledPositions = deptsWithStaff.reduce(
      (sum, d) => sum + d.positions.reduce((psum, p) => psum + p.filledCount, 0),
      0
    );
    const totalVacancies = Math.max(0, totalApprovedPositions - totalFilledPositions);

    const config = (agency.configuration as Record<string, any> | null) ?? {};
    const directorGeneral = config.directorGeneral || {
      title: "Director General & Chief Executive Officer",
      name: "Dr. Jerry Tetaga",
      email: "dg@nisit.gov.pg",
      gradeLevel: "Grade 20",
      employeeId: null,
    };

    res.json({
      agency: {
        id: agency.id || 1,
        name: agency.name || "National Institute of Standards & Industrial Technology (NISIT)",
        totalHeadcount,
        totalDepartments: activeDepts.length,
        totalPositions: totalApprovedPositions,
        totalFilledPositions,
        totalVacancies,
      },
      directorGeneral,
      executiveOffice: {
        title: "Office of the Director General",
        headcount: deptsWithStaff.find((d) => d.name.toLowerCase().includes("admin"))?.headcount || 4,
      },
      departments: deptsWithStaff,
      allActiveStaff: employees.map((e) => ({
        id: e.id,
        name: e.name,
        employeeNumber: e.employeeNumber || `EMP-${e.id}`,
        gradeLevel: e.gradeLevel || "Grade 10",
        email: e.email,
        phone: e.phone,
        departmentId: e.departmentId,
        positionId: e.positionId,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to build organizational chart" });
  }
});

// PUT /api/org-chart/executive - Update Director General / CEO details
router.put("/org-chart/executive", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { name, title, email, gradeLevel, employeeId } = req.body;
    if (!name || !title) {
      res.status(400).json({ error: "Name and title are required for the executive position" });
      return;
    }

    const [agency] = await db.select().from(agenciesTable).limit(1);
    if (!agency) {
      res.status(404).json({ error: "Agency record not found" });
      return;
    }

    const existingConfig = (agency.configuration as Record<string, any> | null) ?? {};
    const updatedDirectorGeneral = {
      name: String(name).trim(),
      title: String(title).trim(),
      email: email ? String(email).trim() : "dg@nisit.gov.pg",
      gradeLevel: gradeLevel ? String(gradeLevel).trim() : "Grade 20",
      employeeId: employeeId ? Number(employeeId) : null,
    };

    const updatedConfig = {
      ...existingConfig,
      directorGeneral: updatedDirectorGeneral,
    };

    await db.update(agenciesTable)
      .set({ configuration: updatedConfig, updatedAt: new Date() })
      .where(eq(agenciesTable.id, agency.id));

    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: employeeId ? Number(employeeId) : null,
      targetEmail: updatedDirectorGeneral.email,
      actionType: "employee_update",
      outcome: "success",
      details: { directorGeneral: updatedDirectorGeneral },
      agencyId: agency.id,
    });

    res.json({ success: true, directorGeneral: updatedDirectorGeneral });
  } catch (error) {
    res.status(500).json({ error: "Failed to update executive position" });
  }
});

// PUT /api/org-chart/structure - Persist drag and drop reassignments and structure updates
router.put("/org-chart/structure", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { departments } = req.body as {
      departments?: Array<{
        id: number;
        name: string;
        code?: string;
        positions?: Array<{ id: number; title: string; gradeLevel?: string; totalCount?: number }>;
        members?: Array<{ id: number; name: string }>;
      }>;
    };

    if (!Array.isArray(departments)) {
      res.status(400).json({ error: "Invalid structure data: departments array required" });
      return;
    }

    const [agency] = await db.select().from(agenciesTable).limit(1);
    const agencyId = agency?.id || 1;

    for (const dept of departments) {
      let targetDeptId = dept.id;

      // Check if department is newly created (e.g. timestamp ID > 1000000000)
      if (targetDeptId > 1000000000) {
        const [createdDept] = await db.insert(departmentsTable).values({
          name: dept.name,
          code: dept.code || `DIV-${dept.name.slice(0, 3).toUpperCase()}`,
          agencyId,
        }).returning();
        targetDeptId = createdDept.id;
      }

      // Reassign or create positions for this department
      if (Array.isArray(dept.positions)) {
        for (const pos of dept.positions) {
          if (pos.id > 1000000000) {
            // Newly created position
            await db.insert(positionsTable).values({
              title: pos.title,
              departmentId: targetDeptId,
              gradeLevel: pos.gradeLevel || "Grade 10",
              totalCount: pos.totalCount || 1,
            });
          } else {
            // Existing position moved to this department
            await db.update(positionsTable)
              .set({ departmentId: targetDeptId, updatedAt: new Date() })
              .where(eq(positionsTable.id, pos.id));
          }
        }
      }

      // Reassign staff members for this department
      if (Array.isArray(dept.members)) {
        for (const member of dept.members) {
          await db.update(employeesTable)
            .set({ departmentId: targetDeptId, updatedAt: new Date() })
            .where(eq(employeesTable.id, member.id));
        }
      }
    }

    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: null,
      targetEmail: null,
      actionType: "employee_position_change",
      outcome: "success",
      details: { departmentCount: departments.length },
      agencyId,
    });

    res.json({ success: true, message: "Hierarchy structure saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save organizational structure" });
  }
});

// POST /api/org-chart/positions - Create new establishment position
router.post("/org-chart/positions", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { title, positionCode, departmentId, gradeLevel, totalCount, reportsToTitle, parentPositionId, jobDescription } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({ error: "Position title is required" });
      return;
    }

    const deptId = departmentId ? Number(departmentId) : null;
    const count = Math.max(1, Number(totalCount) || 1);
    const code = positionCode?.trim() || `NISIT-POS-${Math.floor(100 + Math.random() * 900)}`;

    let resolvedParentId: number | null = parentPositionId ? Number(parentPositionId) : null;
    let resolvedReportsToTitle: string | null = reportsToTitle?.trim() || null;

    if (resolvedParentId && !resolvedReportsToTitle) {
      const [parent] = await db.select().from(positionsTable).where(eq(positionsTable.id, resolvedParentId));
      if (parent) resolvedReportsToTitle = parent.title;
    } else if (!resolvedParentId && resolvedReportsToTitle && resolvedReportsToTitle.toLowerCase() !== "nisit council") {
      const [parent] = await db.select().from(positionsTable).where(eq(positionsTable.title, resolvedReportsToTitle));
      if (parent) resolvedParentId = parent.id;
    }

    const [created] = await db.insert(positionsTable).values({
      title: title.trim(),
      positionCode: code,
      departmentId: deptId,
      gradeLevel: gradeLevel || "Grade 10",
      parentPositionId: resolvedParentId,
      totalCount: count,
      filledCount: 0,
      reportsToTitle: resolvedReportsToTitle,
      jobDescription: jobDescription?.trim() || null,
      status: "active",
    }).returning();

    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: null,
      targetEmail: null,
      actionType: "position_create",
      outcome: "success",
      details: { positionId: created.id, title: created.title, departmentId: created.departmentId, parentPositionId: created.parentPositionId },
      agencyId: req.user?.agencyId || 1,
    });

    res.status(201).json({ success: true, position: created });
  } catch (error) {
    res.status(500).json({ error: "Failed to create position" });
  }
});

// PUT /api/org-chart/positions/:id - Update existing position details & establishment ceiling
router.put("/org-chart/positions/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const posId = Number(req.params.id);
    if (!posId || isNaN(posId)) {
      res.status(400).json({ error: "Invalid position ID" });
      return;
    }

    const { title, positionCode, departmentId, gradeLevel, totalCount, reportsToTitle, parentPositionId, jobDescription } = req.body;
    const [existing] = await db.select().from(positionsTable).where(eq(positionsTable.id, posId));
    if (!existing) {
      res.status(404).json({ error: "Position not found" });
      return;
    }

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (title && title.trim()) updateFields.title = title.trim();
    if (positionCode !== undefined) updateFields.positionCode = positionCode?.trim() || null;
    if (departmentId !== undefined) updateFields.departmentId = departmentId ? Number(departmentId) : null;
    if (gradeLevel) updateFields.gradeLevel = gradeLevel;
    if (totalCount !== undefined) updateFields.totalCount = Math.max(1, Number(totalCount) || 1);
    if (jobDescription !== undefined) updateFields.jobDescription = jobDescription?.trim() || null;

    if (parentPositionId !== undefined) {
      updateFields.parentPositionId = parentPositionId ? Number(parentPositionId) : null;
      if (updateFields.parentPositionId) {
        const [parent] = await db.select().from(positionsTable).where(eq(positionsTable.id, updateFields.parentPositionId));
        if (parent) updateFields.reportsToTitle = parent.title;
      } else {
        updateFields.reportsToTitle = "NISIT Council";
      }
    } else if (reportsToTitle !== undefined) {
      updateFields.reportsToTitle = reportsToTitle?.trim() || null;
      if (updateFields.reportsToTitle && updateFields.reportsToTitle.toLowerCase() !== "nisit council") {
        const [parent] = await db.select().from(positionsTable).where(eq(positionsTable.title, updateFields.reportsToTitle));
        if (parent) updateFields.parentPositionId = parent.id;
      } else if (updateFields.reportsToTitle?.toLowerCase() === "nisit council") {
        updateFields.parentPositionId = null;
      }
    }

    const [updated] = await db.update(positionsTable)
      .set(updateFields)
      .where(eq(positionsTable.id, posId))
      .returning();

    // Optionally keep assigned employees' grade levels updated
    if (gradeLevel) {
      await db.update(employeesTable)
        .set({ gradeLevel, updatedAt: new Date() })
        .where(eq(employeesTable.positionId, posId));
    }

    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: null,
      targetEmail: null,
      actionType: "position_update",
      outcome: "success",
      details: { positionId: posId, changes: updateFields },
      agencyId: req.user?.agencyId || 1,
    });

    res.json({ success: true, position: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update position" });
  }
});

// DELETE /api/org-chart/positions/:id - Delete an empty establishment position
router.delete("/org-chart/positions/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const posId = Number(req.params.id);
    if (!posId || isNaN(posId)) {
      res.status(400).json({ error: "Invalid position ID" });
      return;
    }

    const assignedEmployees = await db.select().from(employeesTable).where(eq(employeesTable.positionId, posId));
    if (assignedEmployees.length > 0) {
      res.status(400).json({
        error: `Cannot delete position with ${assignedEmployees.length} active incumbent(s). Please reassign officers before deleting.`,
      });
      return;
    }

    await db.delete(positionsTable).where(eq(positionsTable.id, posId));

    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: null,
      targetEmail: null,
      actionType: "position_delete",
      outcome: "success",
      details: { positionId: posId },
      agencyId: req.user?.agencyId || 1,
    });

    res.json({ success: true, message: "Position deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete position" });
  }
});

// POST /api/org-chart/departments - Create a new organizational division/department
router.post("/org-chart/departments", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { name, code } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Department name is required" });
      return;
    }

    const [agency] = await db.select().from(agenciesTable).limit(1);
    const agencyId = agency?.id || 1;

    const deptCode = code?.trim() || `DIV-${name.trim().slice(0, 3).toUpperCase()}`;

    const [created] = await db.insert(departmentsTable).values({
      name: name.trim(),
      code: deptCode,
      agencyId,
    }).returning();

    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: null,
      targetEmail: null,
      actionType: "department_create",
      outcome: "success",
      details: { departmentId: created.id, name: created.name },
      agencyId,
    });

    res.status(201).json({ success: true, department: created });
  } catch (error) {
    res.status(500).json({ error: "Failed to create department" });
  }
});

export default router;

