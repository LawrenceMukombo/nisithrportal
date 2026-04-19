import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, agenciesTable } from "@workspace/db";
import {
  CreateAgencyBody,
  GetAgencyParams,
  UpdateAgencyParams,
  UpdateAgencyBody,
  DeleteAgencyParams,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { NISIT_AGENCY_ID } from "../lib/single-tenant";

export const DEFAULT_STALE_THRESHOLDS: Record<string, number> = {
  applied:    3,
  screening:  7,
  interview:  10,
  offer:      5,
  hired:      7,
  onboarding: 14,
};

const ThresholdsBody = z.record(z.string(), z.number().int().min(1).max(365));

const BulkTransitionsBody = z.array(z.object({
  from: z.string().min(1),
  to: z.string().min(1),
}));

const router: IRouter = Router();

// Single-tenant mode: only the NISIT agency is exposed regardless of caller scope.
router.get("/agencies", authMiddleware, async (_req, res): Promise<void> => {
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, NISIT_AGENCY_ID));
  res.json(agency ? [agency] : []);
});

router.post("/agencies", authMiddleware, requireRole("admin"), async (_req, res): Promise<void> => {
  res.status(403).json({ error: "Agency creation is disabled — this deployment is locked to PNG NISIT." });
});

router.get("/agencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = GetAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  if (params.data.id !== NISIT_AGENCY_ID) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, NISIT_AGENCY_ID));
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json(agency);
});

router.delete("/agencies/:id", authMiddleware, requireRole("admin"), async (_req, res): Promise<void> => {
  res.status(403).json({ error: "Agency deletion is disabled — this deployment is locked to PNG NISIT." });
});

router.put("/agencies/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  if (params.data.id !== NISIT_AGENCY_ID) {
    res.status(403).json({ error: "Forbidden: only the PNG NISIT agency record may be updated." });
    return;
  }
  const body = UpdateAgencyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [agency] = await db.update(agenciesTable)
    .set({ name: body.data.name, type: body.data.type })
    .where(eq(agenciesTable.id, params.data.id))
    .returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json(agency);
});

// ─── GET /api/agencies/settings/stale-thresholds ──────────────────────────────
router.get("/agencies/settings/stale-thresholds", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  if (!agencyId) { res.status(403).json({ error: "Agency context required" }); return; }
  const [agency] = await db.select({ configuration: agenciesTable.configuration })
    .from(agenciesTable).where(eq(agenciesTable.id, agencyId));
  const saved = (agency?.configuration as { staleThresholds?: Record<string, number> } | null)?.staleThresholds ?? {};
  const thresholds = { ...DEFAULT_STALE_THRESHOLDS, ...saved };
  res.json(thresholds);
});

// ─── PUT /api/agencies/settings/stale-thresholds ──────────────────────────────
router.put("/agencies/settings/stale-thresholds", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  if (!agencyId) { res.status(403).json({ error: "Agency context required" }); return; }
  const parsed = ThresholdsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [agency] = await db.select({ configuration: agenciesTable.configuration })
    .from(agenciesTable).where(eq(agenciesTable.id, agencyId));
  const existing = (agency?.configuration as Record<string, unknown> | null) ?? {};
  const updated = { ...existing, staleThresholds: parsed.data };
  await db.update(agenciesTable)
    .set({ configuration: updated, updatedAt: new Date() })
    .where(eq(agenciesTable.id, agencyId));
  res.json({ ...DEFAULT_STALE_THRESHOLDS, ...parsed.data });
});

// ─── GET /api/agencies/settings/bulk-transitions ──────────────────────────────
// Returns the agency's configured allow-list of (from -> to) bulk status
// transitions. Empty array means "use server defaults".
router.get("/agencies/settings/bulk-transitions", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  if (!agencyId) { res.status(403).json({ error: "Agency context required" }); return; }
  const [agency] = await db.select({ configuration: agenciesTable.configuration })
    .from(agenciesTable).where(eq(agenciesTable.id, agencyId));
  const saved = (agency?.configuration as { allowedBulkTransitions?: { from: string; to: string }[] } | null)?.allowedBulkTransitions ?? [];
  res.json(saved);
});

// ─── PUT /api/agencies/settings/bulk-transitions ──────────────────────────────
// Saves the agency's allow-list. Admin-only — controls how strict the bulk
// workflow guard is across the whole agency. Pass [] to clear and revert to
// server defaults.
router.put("/agencies/settings/bulk-transitions", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  if (!agencyId) { res.status(403).json({ error: "Agency context required" }); return; }
  const parsed = BulkTransitionsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [agency] = await db.select({ configuration: agenciesTable.configuration })
    .from(agenciesTable).where(eq(agenciesTable.id, agencyId));
  const existing = (agency?.configuration as Record<string, unknown> | null) ?? {};
  const updated = { ...existing, allowedBulkTransitions: parsed.data };
  await db.update(agenciesTable)
    .set({ configuration: updated, updatedAt: new Date() })
    .where(eq(agenciesTable.id, agencyId));
  res.json(parsed.data);
});

export default router;
