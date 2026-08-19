import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, departmentsTable, positionsTable, employeesTable, agenciesTable } from "@workspace/db";
import { optionalAuth } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/org-chart - Generate full organizational hierarchy tree
router.get("/org-chart", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const agencies = await db.select().from(agenciesTable).limit(1);
    const agency = agencies[0] || { name: "National Institute of Standards & Industrial Technology (NISIT)" };

    const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
    const positions = await db.select().from(positionsTable).orderBy(positionsTable.title);
    const employees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active")).orderBy(employeesTable.name);

    // Group employees by department and map filled vs vacant positions
    const deptsWithStaff = depts.map((d) => {
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

    res.json({
      agency: {
        id: agency.id || 1,
        name: agency.name || "National Institute of Standards & Industrial Technology (NISIT)",
        totalHeadcount,
        totalDepartments: depts.length,
        totalPositions: totalApprovedPositions,
        totalFilledPositions,
        totalVacancies,
      },
      directorGeneral: {
        title: "Director General & Chief Executive Officer",
        name: "Dr. Jerry Tetaga",
        email: "dg@nisit.gov.pg",
      },
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

export default router;
