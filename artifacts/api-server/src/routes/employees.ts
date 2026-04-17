import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, employeesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/employees", authMiddleware, async (req, res): Promise<void> => {
  const agencyId = req.query.agency_id ? parseInt(req.query.agency_id as string, 10) : undefined;
  const departmentId = req.query.department_id ? parseInt(req.query.department_id as string, 10) : undefined;
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (agencyId) conditions.push(eq(employeesTable.agencyId, agencyId));
  if (departmentId) conditions.push(eq(employeesTable.departmentId, departmentId));
  if (status) conditions.push(eq(employeesTable.status, status));

  const results = conditions.length > 0
    ? await db.select().from(employeesTable).where(and(...conditions)).orderBy(employeesTable.name)
    : await db.select().from(employeesTable).orderBy(employeesTable.name);

  res.json(results);
});

router.post("/employees", authMiddleware, async (req, res): Promise<void> => {
  const { name, email, phone, positionId, departmentId, agencyId, status, startDate } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [employee] = await db.insert(employeesTable).values({
    name,
    email: email ?? null,
    phone: phone ?? null,
    positionId: positionId ?? null,
    departmentId: departmentId ?? null,
    agencyId: agencyId ?? req.user?.agencyId ?? null,
    status: status ?? "active",
    startDate: startDate ?? null,
  }).returning();
  res.status(201).json(employee);
});

router.get("/employees/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(employee);
});

router.patch("/employees/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, email, phone, positionId, departmentId, contractId, status, startDate } = req.body;
  const [employee] = await db.update(employeesTable)
    .set({ name, email, phone, positionId, departmentId, contractId, status, startDate })
    .where(eq(employeesTable.id, id))
    .returning();
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(employee);
});

export default router;
