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
    // If no agency depts found, fallback to all depts
    const activeDepts = depts.length > 0 ? depts : await db.select().from(departmentsTable).orderBy(departmentsTable.name);

    const positions = await db.select().from(positionsTable).orderBy(positionsTable.title);
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

        return {
          id: p.id,
          title: p.title,
          code: p.positionCode || `POS-${String(p.id).padStart(3, "0")}`,
          gradeLevel: p.gradeLevel || "Grade 10",
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

export default router;

