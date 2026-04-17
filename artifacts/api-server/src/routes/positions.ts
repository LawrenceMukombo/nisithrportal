import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, positionsTable, departmentsTable } from "@workspace/db";
import {
  GetPositionsQueryParams,
  CreatePositionBody,
  GetPositionParams,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

async function getDeptAgencyId(departmentId: number | null | undefined): Promise<number | null> {
  if (!departmentId) return null;
  const [dept] = await db.select({ agencyId: departmentsTable.agencyId }).from(departmentsTable).where(eq(departmentsTable.id, departmentId));
  return dept?.agencyId ?? null;
}

router.get("/positions", authMiddleware, async (req, res): Promise<void> => {
  const query = GetPositionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const agencyId = getTenantAgencyId(req);

  if (agencyId != null) {
    const depts = await db.select({ id: departmentsTable.id })
      .from(departmentsTable).where(eq(departmentsTable.agencyId, agencyId));
    const deptIds = depts.map((d) => d.id);

    if (deptIds.length === 0) {
      res.json([]);
      return;
    }

    let positions = await db.select().from(positionsTable).orderBy(positionsTable.title);
    positions = positions.filter((p) => p.departmentId != null && deptIds.includes(p.departmentId));

    if (query.data.department_id != null) {
      positions = positions.filter((p) => p.departmentId === query.data.department_id);
    }

    res.json(positions);
    return;
  }

  const results = query.data.department_id != null
    ? await db.select().from(positionsTable).where(eq(positionsTable.departmentId, query.data.department_id)).orderBy(positionsTable.title)
    : await db.select().from(positionsTable).orderBy(positionsTable.title);
  res.json(results);
});

router.post("/positions", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreatePositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  if (agencyId != null && parsed.data.departmentId) {
    const deptAgencyId = await getDeptAgencyId(parsed.data.departmentId);
    if (deptAgencyId != null && deptAgencyId !== agencyId) {
      res.status(403).json({ error: "Forbidden: department belongs to a different agency" });
      return;
    }
  }

  const [position] = await db.insert(positionsTable).values({
    title: parsed.data.title,
    departmentId: parsed.data.departmentId ?? null,
    totalCount: parsed.data.totalCount ?? 1,
  }).returning();
  res.status(201).json(position);
});

router.get("/positions/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = GetPositionParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid position id" });
    return;
  }
  const [position] = await db.select().from(positionsTable).where(eq(positionsTable.id, params.data.id));
  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const deptAgencyId = await getDeptAgencyId(position.departmentId);
    if (deptAgencyId != null && deptAgencyId !== agencyId) {
      res.status(403).json({ error: "Forbidden: resource belongs to a different agency" });
      return;
    }
  }

  res.json(position);
});

export default router;
