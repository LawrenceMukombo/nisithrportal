import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, contractsTable, employeesTable } from "@workspace/db";
import {
  GetContractsQueryParams,
  CreateContractBody,
  GetContractParams,
  UpdateContractParams,
  UpdateContractBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";

const router: IRouter = Router();

async function getEmployeeAgencyId(employeeId: number): Promise<number | null> {
  const [emp] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, employeeId));
  return emp?.agencyId ?? null;
}

router.get("/contracts", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req, res): Promise<void> => {
  const query = GetContractsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  const conditions = [];

  if (agencyId != null) {
    conditions.push(inArray(contractsTable.employeeId,
      db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.agencyId, agencyId)),
    ));
  }
  if (query.data.employee_id != null) conditions.push(eq(contractsTable.employeeId, query.data.employee_id));
  if (query.data.status != null) conditions.push(eq(contractsTable.status, query.data.status));

  const allContracts = conditions.length > 0
    ? await db.select().from(contractsTable).where(and(...conditions)).orderBy(contractsTable.createdAt)
    : await db.select().from(contractsTable).orderBy(contractsTable.createdAt);

  res.json(allContracts);
});

router.post("/contracts", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const empAgencyId = await getEmployeeAgencyId(parsed.data.employeeId);
    if (!assertTenantAccess(res, empAgencyId, agencyId)) return;
  }
  const contract = await db.transaction(async (tx) => {
    const [created] = await tx.insert(contractsTable).values({
      employeeId: parsed.data.employeeId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? null,
      type: parsed.data.type ?? "fixed_term",
      status: "active",
      documentUrl: parsed.data.documentUrl ?? null,
    }).returning();
    await tx.update(employeesTable)
      .set({ contractId: created.id })
      .where(eq(employeesTable.id, parsed.data.employeeId));
    return created;
  });
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
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const empAgencyId = await getEmployeeAgencyId(contract.employeeId);
    if (!assertTenantAccess(res, empAgencyId, agencyId)) return;
  }
  res.json(contract);
});

router.patch("/contracts/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateContractParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid contract id" });
    return;
  }
  const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const empAgencyId = await getEmployeeAgencyId(existing.employeeId);
    if (!assertTenantAccess(res, empAgencyId, agencyId)) return;
  }
  const body = UpdateContractBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const contract = await db.transaction(async (tx) => {
    const [updated] = await tx.update(contractsTable)
      .set({
        endDate: body.data.endDate ?? undefined,
        type: body.data.type,
        status: body.data.status,
        documentUrl: body.data.documentUrl ?? undefined,
      })
      .where(eq(contractsTable.id, params.data.id))
      .returning();
    if (body.data.status != null && body.data.status !== existing.status) {
      if (body.data.status === "active") {
        await tx.update(employeesTable).set({ contractId: updated.id }).where(eq(employeesTable.id, existing.employeeId));
      } else {
        await tx.update(employeesTable).set({ contractId: null }).where(
          and(eq(employeesTable.id, existing.employeeId), eq(employeesTable.contractId, existing.id))
        );
      }
    }
    return updated;
  });
  res.json(contract);
});

export default router;
