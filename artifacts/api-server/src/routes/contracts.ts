import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, contractsTable } from "@workspace/db";
import {
  GetContractsQueryParams,
  CreateContractBody,
  GetContractParams,
  UpdateContractParams,
  UpdateContractBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/contracts", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const query = GetContractsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success) {
    if (query.data.employee_id != null) conditions.push(eq(contractsTable.employeeId, query.data.employee_id));
    if (query.data.status != null) conditions.push(eq(contractsTable.status, query.data.status));
  }
  const results = conditions.length > 0
    ? await db.select().from(contractsTable).where(and(...conditions)).orderBy(contractsTable.createdAt)
    : await db.select().from(contractsTable).orderBy(contractsTable.createdAt);
  res.json(results);
});

router.post("/contracts", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [contract] = await db.insert(contractsTable).values({
    employeeId: parsed.data.employeeId,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate ?? null,
    type: parsed.data.type ?? "fixed_term",
    status: "active",
    documentUrl: parsed.data.documentUrl ?? null,
  }).returning();
  res.status(201).json(contract);
});

router.get("/contracts/:id", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const params = GetContractParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid contract id" });
    return;
  }
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  res.json(contract);
});

router.patch("/contracts/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateContractParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid contract id" });
    return;
  }
  const body = UpdateContractBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [contract] = await db.update(contractsTable)
    .set({
      endDate: body.data.endDate ?? undefined,
      type: body.data.type,
      status: body.data.status,
      documentUrl: body.data.documentUrl ?? undefined,
    })
    .where(eq(contractsTable.id, params.data.id))
    .returning();
  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  res.json(contract);
});

export default router;
