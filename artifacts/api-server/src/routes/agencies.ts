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

export const DEFAULT_STALE_THRESHOLDS: Record<string, number> = {
  applied:    3,
  screening:  7,
  interview:  10,
  offer:      5,
  hired:      7,
  onboarding: 14,
};

const ThresholdsBody = z.record(z.string(), z.number().int().min(1).max(365));

const router: IRouter = Router();

router.get("/agencies", authMiddleware, async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, agencyId));
    res.json(agency ? [agency] : []);
    return;
  }
  const agencies = await db.select().from(agenciesTable).orderBy(agenciesTable.name);
  res.json(agencies);
});

router.post("/agencies", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateAgencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agency] = await db.insert(agenciesTable).values({
    name: parsed.data.name,
    type: parsed.data.type ?? "government",
  }).returning();
  res.status(201).json(agency);
});

router.get("/agencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = GetAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, params.data.id));
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null && agency.id !== agencyId) {
    res.status(403).json({ error: "Forbidden: resource belongs to a different agency" });
    return;
  }
  res.json(agency);
});

router.delete("/agencies/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null && params.data.id !== agencyId) {
    res.status(403).json({ error: "Forbidden: cannot delete another agency's record" });
    return;
  }
  const [agency] = await db.delete(agenciesTable).where(eq(agenciesTable.id, params.data.id)).returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.sendStatus(204);
});

router.put("/agencies/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null && params.data.id !== agencyId) {
    res.status(403).json({ error: "Forbidden: cannot update another agency's record" });
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
router.get("/agencies/settings/stale-thresholds", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  if (!agencyId) { res.status(403).json({ error: "Agency context required" }); return; }
  const [agency] = await db.select({ configuration: agenciesTable.configuration })
    .from(agenciesTable).where(eq(agenciesTable.id, agencyId));
  const saved = (agency?.configuration as { staleThresholds?: Record<string, number> } | null)?.staleThresholds ?? {};
  const thresholds = { ...DEFAULT_STALE_THRESHOLDS, ...saved };
  res.json(thresholds);
});

// ─── PUT /api/agencies/settings/stale-thresholds ──────────────────────────────
router.put("/agencies/settings/stale-thresholds", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
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

export default router;
