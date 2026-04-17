import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, departmentsTable } from "@workspace/db";
import {
  CreateDepartmentBody,
  GetDepartmentParams,
  UpdateDepartmentParams,
  UpdateDepartmentBody,
  GetDepartmentsQueryParams,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";

const router: IRouter = Router();

router.get("/departments", authMiddleware, async (req, res): Promise<void> => {
  const query = GetDepartmentsQueryParams.safeParse(req.query);
  const conditions = [];

  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    conditions.push(eq(departmentsTable.agencyId, agencyId));
  } else if (query.success && query.data.agency_id != null) {
    conditions.push(eq(departmentsTable.agencyId, query.data.agency_id));
  }

  const results = conditions.length > 0
    ? await db.select().from(departmentsTable).where(and(...conditions)).orderBy(departmentsTable.name)
    : await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  res.json(results);
});

router.post("/departments", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const agencyId = getTenantAgencyId(req) ?? parsed.data.agencyId ?? null;
  const [dept] = await db.insert(departmentsTable).values({ name: parsed.data.name, agencyId }).returning();
  res.status(201).json(dept);
});

router.get("/departments/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = GetDepartmentParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid department id" });
    return;
  }
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, params.data.id));
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  if (!assertTenantAccess(res, dept.agencyId, getTenantAgencyId(req))) return;
  res.json(dept);
});

router.put("/departments/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateDepartmentParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid department id" });
    return;
  }
  const [existing] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  if (!assertTenantAccess(res, existing.agencyId, getTenantAgencyId(req))) return;
  const body = UpdateDepartmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [dept] = await db.update(departmentsTable)
    .set({ name: body.data.name })
    .where(eq(departmentsTable.id, params.data.id))
    .returning();
  res.json(dept);
});

router.delete("/departments/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (id < 0) {
    res.status(400).json({ error: "Invalid department id" });
    return;
  }
  const [existing] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  if (!assertTenantAccess(res, existing.agencyId, getTenantAgencyId(req))) return;
  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  res.sendStatus(204);
});

export default router;
