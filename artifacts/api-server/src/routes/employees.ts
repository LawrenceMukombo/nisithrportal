import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, employeesTable, departmentsTable, positionsTable } from "@workspace/db";
import {
  GetEmployeesQueryParams,
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";

const router: IRouter = Router();

router.get("/employees", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const query = GetEmployeesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const conditions = [];

  const tenantAgencyId = getTenantAgencyId(req);
  if (tenantAgencyId != null) {
    conditions.push(eq(employeesTable.agencyId, tenantAgencyId));
  } else if (query.data.agency_id != null) {
    conditions.push(eq(employeesTable.agencyId, query.data.agency_id));
  }

  if (query.data.department_id != null) conditions.push(eq(employeesTable.departmentId, query.data.department_id));
  if (query.data.status != null) conditions.push(eq(employeesTable.status, query.data.status));

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
  const agencyId = getTenantAgencyId(req) ?? parsed.data.agencyId ?? null;
  if (agencyId == null) {
    res.status(403).json({ error: "Forbidden: no agency context — cannot create employee" });
    return;
  }
  if (parsed.data.departmentId != null) {
    const dept = await db.select({ agencyId: departmentsTable.agencyId }).from(departmentsTable).where(eq(departmentsTable.id, parsed.data.departmentId)).then((r) => r[0]);
    if (!assertTenantAccess(res, dept?.agencyId ?? null, agencyId)) return;
  }
  if (parsed.data.positionId != null) {
    const pos = await db.select({ departmentId: positionsTable.departmentId }).from(positionsTable).where(eq(positionsTable.id, parsed.data.positionId)).then((r) => r[0]);
    if (pos?.departmentId != null) {
      const posDept = await db.select({ agencyId: departmentsTable.agencyId }).from(departmentsTable).where(eq(departmentsTable.id, pos.departmentId)).then((r) => r[0]);
      if (!assertTenantAccess(res, posDept?.agencyId ?? null, agencyId)) return;
    }
  }
  const [employee] = await db.insert(employeesTable).values({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    positionId: parsed.data.positionId ?? null,
    departmentId: parsed.data.departmentId ?? null,
    agencyId,
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
  if (!assertTenantAccess(res, employee.agencyId, getTenantAgencyId(req))) return;
  res.json(employee);
});

router.patch("/employees/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid employee id" });
    return;
  }
  const [existing] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  if (!assertTenantAccess(res, existing.agencyId, getTenantAgencyId(req))) return;
  const body = UpdateEmployeeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.departmentId != null) {
    const dept = await db.select({ agencyId: departmentsTable.agencyId })
      .from(departmentsTable).where(eq(departmentsTable.id, body.data.departmentId)).then((r) => r[0]);
    if (!dept || dept.agencyId !== existing.agencyId) {
      res.status(403).json({ error: "Forbidden: department does not belong to this agency" });
      return;
    }
  }
  if (body.data.positionId != null) {
    const pos = await db
      .select({ agencyId: departmentsTable.agencyId })
      .from(positionsTable)
      .innerJoin(departmentsTable, eq(positionsTable.departmentId, departmentsTable.id))
      .where(eq(positionsTable.id, body.data.positionId))
      .then((r) => r[0]);
    if (!pos || pos.agencyId !== existing.agencyId) {
      res.status(403).json({ error: "Forbidden: position does not belong to this agency" });
      return;
    }
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
  res.json(employee);
});

export default router;
