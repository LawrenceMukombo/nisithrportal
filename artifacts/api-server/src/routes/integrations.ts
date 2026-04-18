import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, integrationConfigsTable, integrationLogsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";
import { logger } from "../lib/logger";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CONNECTOR_CATALOG,
  getConnector,
  executeIntegration,
  executeIntegrationLegacy,
  loadIntegrationConfig,
  STATIC_INTEGRATION_CONFIGS,
} from "../lib/connectors";

const router: IRouter = Router();

const CreateIntegrationConfigSchema = z.object({
  integrationType: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  endpointUrl: z.string().url().optional().or(z.literal("")),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional().default("POST"),
  apiKeyRef: z.string().optional(),
  authType: z.enum(["bearer", "api_key", "header"]).optional().default("bearer"),
  authHeaderName: z.string().optional(),
  headers: z.record(z.string()).optional(),
  fieldMappings: z.record(z.string()).optional(),
  responseMapping: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});

const UpdateIntegrationConfigSchema = CreateIntegrationConfigSchema.partial();

// ─── Helper: check ownership ───────────────────────────────────────────────────
function canAccessConfig(userAgencyId: number | null, configAgencyId: number | null): boolean {
  if (userAgencyId === null) return false;
  return configAgencyId === null || configAgencyId === userAgencyId;
}

// ─── List connector catalog ────────────────────────────────────────────────────
router.get("/integration-catalog", authMiddleware, requireRole("admin", "hr_officer"), async (_req, res) => {
  res.json(CONNECTOR_CATALOG);
});

// ─── List static integration configs ──────────────────────────────────────────
router.get("/integration-static-configs", authMiddleware, requireRole("admin"), async (_req, res) => {
  const safeConfigs = STATIC_INTEGRATION_CONFIGS.map(c => ({
    type: c.type,
    name: c.name,
    description: c.description,
    method: c.method,
    authType: c.authType,
    authHeaderName: c.authHeaderName,
    headers: c.headers,
    mapping: c.mapping,
    responseMapping: c.responseMapping,
  }));
  res.json(safeConfigs);
});

// ─── CRUD for integration configs ─────────────────────────────────────────────

router.get("/integration-config", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const agencyId = getTenantAgencyId(req);
    const filters = agencyId
      ? [eq(integrationConfigsTable.agencyId, agencyId)]
      : [];

    const configs = await db
      .select()
      .from(integrationConfigsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(integrationConfigsTable.createdAt));

    res.json(configs);
  } catch (err) {
    logger.error(err, "Failed to list integration configs");
    res.status(500).json({ error: "Failed to list integration configs" });
  }
});

router.post("/integration-config", authMiddleware, requireRole("admin"), async (req, res) => {
  const parse = CreateIntegrationConfigSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  try {
    const agencyId = getTenantAgencyId(req);
    const [created] = await db.insert(integrationConfigsTable).values({
      agencyId: agencyId ?? null,
      integrationType: parse.data.integrationType,
      name: parse.data.name,
      description: parse.data.description,
      endpointUrl: parse.data.endpointUrl || null,
      method: parse.data.method ?? "POST",
      apiKeyRef: parse.data.apiKeyRef || null,
      authType: parse.data.authType ?? "bearer",
      authHeaderName: parse.data.authHeaderName || null,
      headers: parse.data.headers ?? {},
      fieldMappings: parse.data.fieldMappings ?? {},
      responseMapping: parse.data.responseMapping ?? {},
      enabled: parse.data.enabled ?? true,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    logger.error(err, "Failed to create integration config");
    res.status(500).json({ error: "Failed to create integration config" });
  }
});

router.get("/integration-config/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [cfg] = await db.select().from(integrationConfigsTable).where(eq(integrationConfigsTable.id, id));
    if (!cfg) { res.status(404).json({ error: "Not found" }); return; }
    if (!canAccessConfig(getTenantAgencyId(req), cfg.agencyId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json(cfg);
  } catch (err) {
    logger.error(err, "Failed to get integration config");
    res.status(500).json({ error: "Failed to get integration config" });
  }
});

router.put("/integration-config/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const parse = UpdateIntegrationConfigSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const id = parseInt(req.params["id"] as string);
    const [existing] = await db.select({ agencyId: integrationConfigsTable.agencyId }).from(integrationConfigsTable).where(eq(integrationConfigsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (!canAccessConfig(getTenantAgencyId(req), existing.agencyId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const [updated] = await db.update(integrationConfigsTable)
      .set({ ...parse.data, updatedAt: new Date() })
      .where(eq(integrationConfigsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    logger.error(err, "Failed to update integration config");
    res.status(500).json({ error: "Failed to update integration config" });
  }
});

router.delete("/integration-config/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [existing] = await db.select({ agencyId: integrationConfigsTable.agencyId }).from(integrationConfigsTable).where(eq(integrationConfigsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (!canAccessConfig(getTenantAgencyId(req), existing.agencyId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    await db.delete(integrationConfigsTable).where(eq(integrationConfigsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error(err, "Failed to delete integration config");
    res.status(500).json({ error: "Failed to delete integration config" });
  }
});

// ─── Dynamic integration executor: POST /integration/:type ────────────────────
// Loads config from DB (prefers agency-scoped config) then falls back to static.
// Supports all three auth patterns: bearer, api_key, header.

router.post("/integration/:type", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const type = req.params["type"] as string;
  const agencyId = getTenantAgencyId(req);

  const config = await loadIntegrationConfig(type, agencyId);
  if (!config) {
    res.status(404).json({ success: false, error: `Unknown integration type: ${type}` });
    return;
  }

  const inputData = (req.body ?? {}) as Record<string, unknown>;
  const result = await executeIntegration(config, inputData);

  // Persist execution log (include DB config ID when available for traceability)
  try {
    await db.insert(integrationLogsTable).values({
      integrationConfigId: config.dbConfigId ?? null,
      status: result.success ? "success" : "error",
      requestPayload: inputData,
      responsePayload: result.data ?? null,
      errorMessage: result.error ?? null,
      durationMs: result.durationMs,
      triggeredBy: String(req.user?.userId ?? "system"),
    });
  } catch (logErr) {
    logger.warn(logErr, "Failed to persist integration log");
  }

  res.json(result);
});

// ─── Execute integration (legacy path, uses DB config by ID) ──────────────────

router.post("/integration/:type/execute", authMiddleware, requireRole("admin", "hr_officer"), async (req, res) => {
  const connectorType = req.params["type"] as string;
  const connector = getConnector(connectorType);
  if (!connector) {
    res.status(400).json({ error: `Unknown integration type: ${connectorType}` });
    return;
  }

  const configId = req.body?.configId as number | undefined;
  if (!configId) {
    res.status(400).json({ error: "configId is required" });
    return;
  }

  const [cfg] = await db.select().from(integrationConfigsTable).where(eq(integrationConfigsTable.id, configId));
  if (!cfg) { res.status(404).json({ error: "Integration config not found" }); return; }
  if (!canAccessConfig(getTenantAgencyId(req), cfg.agencyId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!cfg.endpointUrl) {
    res.status(400).json({ error: "Endpoint URL not set on this config" }); return;
  }

  const payload = { ...(cfg.fieldMappings as Record<string, unknown> ?? {}), ...(req.body.payload ?? {}) };

  const result = await executeIntegrationLegacy({
    connectorType,
    endpointUrl: cfg.endpointUrl,
    apiKey: cfg.apiKeyRef ?? undefined,
    payload,
  });

  await db.insert(integrationLogsTable).values({
    integrationConfigId: configId,
    status: result.success ? "success" : "error",
    requestPayload: payload,
    responsePayload: result.data ?? null,
    errorMessage: result.error ?? null,
    durationMs: result.durationMs,
    triggeredBy: String(req.user?.userId ?? "system"),
  });

  res.json(result);
});

// ─── Get logs for an integration config ───────────────────────────────────────

router.get("/integration-config/:id/logs", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [cfg] = await db.select({ agencyId: integrationConfigsTable.agencyId }).from(integrationConfigsTable).where(eq(integrationConfigsTable.id, id));
    if (!cfg) { res.status(404).json({ error: "Not found" }); return; }
    if (!canAccessConfig(getTenantAgencyId(req), cfg.agencyId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const logs = await db.select().from(integrationLogsTable)
      .where(eq(integrationLogsTable.integrationConfigId, id))
      .orderBy(desc(integrationLogsTable.createdAt))
      .limit(50);
    res.json(logs);
  } catch (err) {
    logger.error(err, "Failed to get integration logs");
    res.status(500).json({ error: "Failed to get integration logs" });
  }
});

// ─── AI: Suggest field mappings ────────────────────────────────────────────────
// Accepts either:
//   (a) { internalFields: string[], externalFields: string[] }  — new flexible format
//   (b) { connectorType: string, externalSchema: string }       — legacy format (auto-resolved)
// Both forms can be combined: connectorType drives internalFields if not supplied explicitly.

const SuggestMappingSchema = z.object({
  internalFields: z.array(z.string()).optional(),
  externalFields: z.array(z.string()).optional(),
  connectorType: z.string().optional(),
  externalSchema: z.string().optional(),
}).refine(d => {
  const hasNew = (d.internalFields && d.internalFields.length > 0) ||
                 (d.externalFields && d.externalFields.length > 0);
  const hasLegacy = d.connectorType || d.externalSchema;
  return hasNew || hasLegacy;
}, { message: "Provide internalFields + externalFields, or connectorType + externalSchema" });

router.post("/integration/ai/suggest-mapping", authMiddleware, requireRole("admin"), async (req, res) => {
  const parse = SuggestMappingSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }

  const { internalFields, externalFields, connectorType, externalSchema } = parse.data;

  // Resolve internal fields: explicit array wins, then fall back to connector catalog
  let resolvedInternalFields: string[] = internalFields ?? [];
  let connectorLabel = "HR System";

  if (resolvedInternalFields.length === 0 && connectorType) {
    const connector = getConnector(connectorType);
    if (!connector) {
      res.status(400).json({ error: `Unknown connector type: ${connectorType}` });
      return;
    }
    resolvedInternalFields = connector.fields.map(f => `${f.key} (${f.type}): ${f.label}${f.description ? ` — ${f.description}` : ""}`);
    connectorLabel = connector.label;
  }

  // Resolve external fields: explicit array wins, then fall back to raw schema text
  let resolvedExternalDesc = "";
  if (externalFields && externalFields.length > 0) {
    resolvedExternalDesc = externalFields.join(", ");
  } else if (externalSchema) {
    resolvedExternalDesc = externalSchema;
  }

  if (!resolvedInternalFields.length || !resolvedExternalDesc) {
    res.status(400).json({ error: "Could not resolve internal or external fields from the provided inputs" });
    return;
  }

  const prompt = `You are a system integration specialist for a Papua New Guinea government HR system.

The HR system (${connectorLabel}) has these internal fields:
${resolvedInternalFields.map(f => `- ${f}`).join("\n")}

The external system's fields/schema provided are:
${resolvedExternalDesc}

Suggest the best field mappings from the external system fields to the HR system's internal fields.
Return a JSON object like:
{
  "mappings": {
    "<internal_key>": "<external_field_name>"
  },
  "notes": "Brief explanation of mapping decisions and any caveats."
}

Only include mappings where you are reasonably confident. Skip uncertain mappings.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = JSON.parse(content) as { mappings: Record<string, string>; notes: string };
    res.json(parsed);
  } catch (err) {
    logger.error(err, "AI suggest-mapping failed");
    res.status(500).json({ error: "AI mapping suggestion failed" });
  }
});

export default router;
