import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, departmentsTable } from "@workspace/db";
import {
  CreateDepartmentBody,
  GetDepartmentParams,
  UpdateDepartmentParams,
  UpdateDepartmentBody,
  GetDepartmentsQueryParams,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/departments", authMiddleware, async (req, res): Promise<void> => {
  const query = GetDepartmentsQueryParams.safeParse(req.query);
  const agencyId = query.success ? (query.data.agency_id ?? req.user?.agencyId ?? undefined) : (req.user?.agencyId ?? undefined);

  const results = agencyId
    ? await db.select().from(departmentsTable).where(eq(departmentsTable.agencyId, agencyId)).orderBy(departmentsTable.name)
    : await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  res.json(results);
});

router.post("/departments", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const agencyId = parsed.data.agencyId ?? req.user?.agencyId ?? null;
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
  res.json(dept);
});

router.put("/departments/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateDepartmentParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid department id" });
    return;
  }
  const body = UpdateDepartmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [dept] = await db.update(departmentsTable)
    .set({ name: body.data.name, agencyId: body.data.agencyId })
    .where(eq(departmentsTable.id, params.data.id))
    .returning();
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.json(dept);
});

export default router;
