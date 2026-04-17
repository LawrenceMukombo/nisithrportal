import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, employeesTable } from "@workspace/db";
import {
  GetEmployeesQueryParams,
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/employees", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const query = GetEmployeesQueryParams.safeParse(req.query);
  const conditions = [];

  if (query.success) {
    const agencyId = query.data.agency_id ?? req.user?.agencyId ?? undefined;
    if (agencyId != null) conditions.push(eq(employeesTable.agencyId, agencyId));
    if (query.data.department_id != null) conditions.push(eq(employeesTable.departmentId, query.data.department_id));
    if (query.data.status != null) conditions.push(eq(employeesTable.status, query.data.status));
  } else if (req.user?.agencyId != null) {
    conditions.push(eq(employeesTable.agencyId, req.user.agencyId));
  }

  const results = conditions.length > 0
    ? await db.select().from(employeesTable).where(and(...conditions)).orderBy(employeesTable.name)
    : await db.select().from(employeesTable).orderBy(employeesTable.name);
  res.json(results);
});

router.post("/employees", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [employee] = await db.insert(employeesTable).values({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    positionId: parsed.data.positionId ?? null,
    departmentId: parsed.data.departmentId ?? null,
    agencyId: parsed.data.agencyId ?? req.user?.agencyId ?? null,
    status: parsed.data.status ?? "active",
    startDate: parsed.data.startDate ?? null,
  }).returning();
  res.status(201).json(employee);
});

router.get("/employees/:id", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid employee id" });
    return;
  }
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(employee);
});

router.patch("/employees/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid employee id" });
    return;
  }
  const body = UpdateEmployeeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [employee] = await db.update(employeesTable)
    .set({
      name: body.data.name,
      email: body.data.email ?? undefined,
      phone: body.data.phone ?? undefined,
      positionId: body.data.positionId ?? undefined,
      departmentId: body.data.departmentId ?? undefined,
      contractId: body.data.contractId ?? undefined,
      status: body.data.status,
      startDate: body.data.startDate ?? undefined,
    })
    .where(eq(employeesTable.id, params.data.id))
    .returning();
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(employee);
});

export default router;
