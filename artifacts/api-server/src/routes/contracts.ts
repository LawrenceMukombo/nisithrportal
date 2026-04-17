import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, contractsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/contracts", authMiddleware, async (req, res): Promise<void> => {
  const employeeId = req.query.employee_id ? parseInt(req.query.employee_id as string, 10) : undefined;
  const status = req.query.status as string | undefined;

  const conditions = [];
  if (employeeId) conditions.push(eq(contractsTable.employeeId, employeeId));
  if (status) conditions.push(eq(contractsTable.status, status));

  const results = conditions.length > 0
    ? await db.select().from(contractsTable).where(and(...conditions)).orderBy(contractsTable.createdAt)
    : await db.select().from(contractsTable).orderBy(contractsTable.createdAt);

  res.json(results);
});

router.post("/contracts", authMiddleware, async (req, res): Promise<void> => {
  const { employeeId, startDate, endDate, type, documentUrl } = req.body;
  if (!employeeId || !startDate) {
    res.status(400).json({ error: "employeeId and startDate are required" });
    return;
  }
  const [contract] = await db.insert(contractsTable).values({
    employeeId,
    startDate,
    endDate: endDate ?? null,
    type: type ?? "fixed_term",
    status: "active",
    documentUrl: documentUrl ?? null,
  }).returning();
  res.status(201).json(contract);
});

router.get("/contracts/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  res.json(contract);
});

router.patch("/contracts/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { endDate, type, status, documentUrl } = req.body;
  const [contract] = await db.update(contractsTable)
    .set({ endDate, type, status, documentUrl })
    .where(eq(contractsTable.id, id))
    .returning();
  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  res.json(contract);
});

export default router;
