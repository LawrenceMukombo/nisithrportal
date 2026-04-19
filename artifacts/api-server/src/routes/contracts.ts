import { Router, type IRouter } from "express";
import { eq, and, inArray, lte, gte, sql, desc } from "drizzle-orm";
import multer from "multer";
import { db, contractsTable, employeesTable, notificationsTable, auditLogTable } from "@workspace/db";
import {
  GetContractsQueryParams,
  CreateContractBody,
  GetContractParams,
  UpdateContractParams,
  UpdateContractBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { notifyHrOfficers } from "../lib/notificationService";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { setObjectAclPolicy } from "../lib/objectAcl";
import { writeAuditLog } from "../lib/audit";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

async function getEmployeeAgencyId(employeeId: number): Promise<number | null> {
  const [emp] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, employeeId));
  return emp?.agencyId ?? null;
}

/**
 * Apply tenant ACL to a contract document URL if it references an internal GCS object.
 * This ensures the document is retrievable via GET /storage/objects/* by the owning agency.
 * Non-fatal: logs a warning if ACL cannot be applied (e.g. file not yet uploaded).
 */
async function applyContractDocumentAcl(documentUrl: string | null | undefined, agencyId: number): Promise<void> {
  if (!documentUrl) return;
  // Only process internal storage object URLs
  const match = documentUrl.match(/\/storage\/objects\/(.+)$/);
  if (!match) return;
  const objectPath = `/objects/${match[1]}`;
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    await setObjectAclPolicy(objectFile, { owner: String(agencyId), visibility: "private" });
  } catch (err) {
    if (!(err instanceof ObjectNotFoundError)) {
      console.warn(`[contracts] Failed to apply ACL to document ${documentUrl}:`, err);
    }
  }
}

/**
 * Check for contracts expiring within 30 days and notify HR officers.
 * Skips contracts that already have a recent (last 24h) expiry notification.
 */
export async function triggerContractExpiryNotifications(agencyId: number | null = null): Promise<void> {
  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const nowStr = now.toISOString().slice(0, 10);
    const in30DaysStr = in30Days.toISOString().slice(0, 10);

    const conditions = [
      eq(contractsTable.status, "active"),
      lte(contractsTable.endDate, in30DaysStr),
      gte(contractsTable.endDate, nowStr),
    ];

    const expiringContracts = await db
      .select({
        id: contractsTable.id,
        employeeId: contractsTable.employeeId,
        endDate: contractsTable.endDate,
      })
      .from(contractsTable)
      .where(and(...conditions));

    for (const contract of expiringContracts) {
      // Check if already notified in last 24 hours
      const existingNotif = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.type, "contract_expiry"),
            gte(notificationsTable.createdAt, yesterday),
            sql`${notificationsTable.message} LIKE ${'%Contract #' + contract.id + '%'}`,
          )
        )
        .limit(1);

      if (existingNotif.length > 0) continue;

      const empAgencyId = await getEmployeeAgencyId(contract.employeeId);
      if (empAgencyId == null) continue;
      if (agencyId != null && empAgencyId !== agencyId) continue;

      const daysLeft = Math.ceil((new Date(contract.endDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      await notifyHrOfficers(
        empAgencyId,
        "contract_expiry",
        `Contract #${contract.id} for Employee #${contract.employeeId} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
      );
    }
  } catch (err) {
    console.error("[contracts] Contract expiry notification check failed:", err);
  }
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

  // Apply tenant ACL to contract document if an internal storage URL was provided
  const contractAgencyId = agencyId ?? (await getEmployeeAgencyId(parsed.data.employeeId));
  if (contractAgencyId != null) {
    await applyContractDocumentAcl(parsed.data.documentUrl, contractAgencyId);
  }

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
        // Distinguish absent (undefined → leave alone) from explicit null (clear the field).
        documentUrl: body.data.documentUrl === undefined ? undefined : body.data.documentUrl,
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

  // Apply tenant ACL if a new internal document URL was provided on update
  if (body.data.documentUrl) {
    const updateAgencyId = agencyId ?? (await getEmployeeAgencyId(existing.employeeId));
    if (updateAgencyId != null) {
      await applyContractDocumentAcl(body.data.documentUrl, updateAgencyId);
    }
  }

  // Audit removal/replacement of an existing signed contract document so HR can
  // investigate "who cleared my signed contract?" disputes. We log when a previous
  // documentUrl existed and the caller either explicitly cleared it (null) or replaced it.
  if (
    body.data.documentUrl !== undefined &&
    existing.documentUrl != null &&
    body.data.documentUrl !== existing.documentUrl
  ) {
    const auditAgencyId = agencyId ?? (await getEmployeeAgencyId(existing.employeeId));
    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      actionType: "contract_document_clear",
      outcome: "success",
      details: {
        contractId: existing.id,
        employeeId: existing.employeeId,
        previousUrl: existing.documentUrl,
        newUrl: body.data.documentUrl,
        action: body.data.documentUrl === null ? "cleared" : "replaced",
        performedByRole: req.user?.roleName ?? null,
      },
      agencyId: auditAgencyId ?? null,
    });
  }

  res.json(contract);
});

// POST /contracts/:id/upload-signed — upload a physically signed contract PDF and store it against the contract
const signedContractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = new Set([
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png",
    ]);
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Allowed: PDF, DOC, DOCX, JPG, PNG"));
  },
});

router.post("/contracts/:id/upload-signed", authMiddleware, requireRole("admin", "hr_officer"), (req, res): void => {
  signedContractUpload.single("file")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE" ? "File too large (max 15 MB)" : (err as Error).message });
      return;
    }
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const contractId = parseIntParam(req.params.id);
    if (!contractId) { res.status(400).json({ error: "Invalid contract id" }); return; }

    const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
    if (!existing) { res.status(404).json({ error: "Contract not found" }); return; }

    const agencyId = getTenantAgencyId(req);
    const empAgencyId = await getEmployeeAgencyId(existing.employeeId);
    if (!assertTenantAccess(res, empAgencyId, agencyId)) return;

    const resolvedAgencyId = agencyId ?? empAgencyId;

    const svc = new ObjectStorageService();
    let fileUrl: string;
    try {
      const uploadURL = await svc.getObjectEntityUploadURL();
      const objectPath = svc.normalizeObjectEntityPath(uploadURL);
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": req.file.mimetype },
        body: new Uint8Array(req.file.buffer),
      });
      if (!uploadRes.ok) { res.status(500).json({ error: "Failed to store file" }); return; }
      if (resolvedAgencyId != null) {
        const objectFile = await svc.getObjectEntityFile(objectPath);
        await setObjectAclPolicy(objectFile, { owner: String(resolvedAgencyId), visibility: "private" });
      }
      fileUrl = `/api/storage${objectPath}`;
    } catch (uploadErr) {
      req.log.error({ err: uploadErr }, "Signed contract upload to storage failed");
      res.status(500).json({ error: "Failed to upload file to storage" });
      return;
    }

    const previousUrl = existing.documentUrl;

    const [updated] = await db
      .update(contractsTable)
      .set({ documentUrl: fileUrl })
      .where(eq(contractsTable.id, contractId))
      .returning();

    // If a previous signed document existed, audit the replacement so HR has a
    // record of who overwrote the original and when.
    if (previousUrl != null && previousUrl !== fileUrl) {
      await writeAuditLog({
        performedById: req.user?.userId ?? null,
        performedByEmail: req.user?.email ?? null,
        actionType: "contract_document_clear",
        outcome: "success",
        details: {
          contractId: existing.id,
          employeeId: existing.employeeId,
          previousUrl,
          newUrl: fileUrl,
          action: "replaced",
          via: "upload-signed",
          performedByRole: req.user?.roleName ?? null,
        },
        agencyId: resolvedAgencyId ?? null,
      });
    }

    res.status(200).json(updated);
  });
});

// GET /contracts/:id/document-deletions — list audit entries where the signed
// contract document was cleared or replaced, so HR can see inline who did what.
router.get(
  "/contracts/:id/document-deletions",
  authMiddleware,
  requireRole("admin", "hr_officer", "executive"),
  async (req, res): Promise<void> => {
    const contractId = parseIntParam(req.params.id);
    if (!contractId) { res.status(400).json({ error: "Invalid contract id" }); return; }

    const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
    if (!existing) { res.status(404).json({ error: "Contract not found" }); return; }

    const agencyId = getTenantAgencyId(req);
    if (agencyId != null) {
      const empAgencyId = await getEmployeeAgencyId(existing.employeeId);
      if (!assertTenantAccess(res, empAgencyId, agencyId)) return;
    }

    const rows = await db
      .select({
        id: auditLogTable.id,
        performedByEmail: auditLogTable.performedByEmail,
        performedById: auditLogTable.performedById,
        createdAt: auditLogTable.createdAt,
        details: auditLogTable.details,
      })
      .from(auditLogTable)
      .where(and(
        eq(auditLogTable.actionType, "contract_document_clear"),
        sql`(${auditLogTable.details}->>'contractId') ~ '^-?[0-9]+$'`,
        sql`(${auditLogTable.details}->>'contractId')::int = ${contractId}`,
      ))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(200);

    res.json(rows);
  },
);

export default router;
