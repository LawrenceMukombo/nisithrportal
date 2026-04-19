import { Router, type IRouter } from "express";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, integrationConfigsTable, integrationLogsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";
import { logger } from "../lib/logger";
import { openai } from "@workspace/integrations-openai-ai-server";
import { notifyAdmins } from "../lib/notificationService";
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

// ─── Helper: compute health and fire alert if transition occurred ──────────────
async function checkAndAlertHealthTransition(configId: number): Promise<void> {
  try {
    const [cfg] = await db
      .select({
        id: integrationConfigsTable.id,
        name: integrationConfigsTable.name,
        agencyId: integrationConfigsTable.agencyId,
        alertThreshold: integrationConfigsTable.alertThreshold,
        degradedThreshold: integrationConfigsTable.degradedThreshold,
        lastAlertedHealth: integrationConfigsTable.lastAlertedHealth,
      })
      .from(integrationConfigsTable)
      .where(eq(integrationConfigsTable.id, configId));

    if (!cfg) return;

    // Fetch the last 20 executions to compute recent health
    const recentLogs = await db
      .select({ status: integrationLogsTable.status, errorMessage: integrationLogsTable.errorMessage, createdAt: integrationLogsTable.createdAt })
      .from(integrationLogsTable)
      .where(eq(integrationLogsTable.integrationConfigId, configId))
      .orderBy(desc(integrationLogsTable.createdAt))
      .limit(20);

    if (recentLogs.length === 0) return;

    const total = recentLogs.length;
    const successes = recentLogs.filter(l => l.status === "success").length;
    const ratePercent = (successes / total) * 100;

    let currentHealth: "healthy" | "degraded" | "failing";
    const failingThreshold = cfg.alertThreshold ?? 50;
    const degradedThreshold = cfg.degradedThreshold ?? 80;

    if (ratePercent < failingThreshold) {
      currentHealth = "failing";
    } else if (ratePercent < degradedThreshold) {
      currentHealth = "degraded";
    } else {
      currentHealth = "healthy";
    }

    const previousHealth = cfg.lastAlertedHealth as "healthy" | "degraded" | "failing" | null;

    // Only alert when transitioning from a better state or first-time failure/degradation
    const shouldAlert =
      currentHealth !== "healthy" &&
      currentHealth !== previousHealth &&
      (previousHealth === null || previousHealth === "healthy" ||
        (previousHealth === "degraded" && currentHealth === "failing"));

    if (shouldAlert) {
      const lastError = recentLogs.find(l => l.status === "error");
      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
      const statusLabel = currentHealth === "failing" ? "Failing" : "Degraded";
      const message = [
        `Integration alert: "${cfg.name}" is now ${statusLabel}.`,
        `Success rate: ${Math.round(ratePercent)}% (last ${total} executions).`,
        lastError?.errorMessage ? `Last error: ${lastError.errorMessage.slice(0, 120)}` : null,
        `Time: ${timestamp}`,
      ].filter(Boolean).join(" ");

      await notifyAdmins(cfg.agencyId, "integration_alert", message);
      logger.warn({ configId, configName: cfg.name, currentHealth, previousHealth }, "Integration health alert fired");
    }

    // Always update lastAlertedHealth if health changed
    if (currentHealth !== previousHealth) {
      await db
        .update(integrationConfigsTable)
        .set({ lastAlertedHealth: currentHealth, updatedAt: new Date() })
        .where(eq(integrationConfigsTable.id, configId));
    }
  } catch (err) {
    logger.warn(err, "checkAndAlertHealthTransition failed");
  }
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

// ─── PATCH alert thresholds for a config ──────────────────────────────────────

const AlertThresholdsSchema = z.object({
  alertThreshold: z.number().int().min(0).max(100),
  degradedThreshold: z.number().int().min(0).max(100),
});

router.patch("/integration-config/:id/alert-thresholds", authMiddleware, requireRole("admin"), async (req, res) => {
  const parse = AlertThresholdsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  if (parse.data.alertThreshold >= parse.data.degradedThreshold) {
    res.status(400).json({ error: "alertThreshold must be strictly less than degradedThreshold" });
    return;
  }
  try {
    const id = parseInt(req.params["id"] as string);
    const [existing] = await db.select({ agencyId: integrationConfigsTable.agencyId }).from(integrationConfigsTable).where(eq(integrationConfigsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (!canAccessConfig(getTenantAgencyId(req), existing.agencyId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const [updated] = await db.update(integrationConfigsTable)
      .set({
        alertThreshold: parse.data.alertThreshold,
        degradedThreshold: parse.data.degradedThreshold,
        updatedAt: new Date(),
      })
      .where(eq(integrationConfigsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    logger.error(err, "Failed to update alert thresholds");
    res.status(500).json({ error: "Failed to update alert thresholds" });
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

    // Fire health-transition alert if the integration has a DB config
    if (config.dbConfigId != null) {
      void checkAndAlertHealthTransition(config.dbConfigId);
    }
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

  void checkAndAlertHealthTransition(configId);

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

// ─── Export logs for an integration config as CSV ─────────────────────────────

router.get("/integration-config/:id/logs/export", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string);
    const [cfg] = await db
      .select({ agencyId: integrationConfigsTable.agencyId, name: integrationConfigsTable.name })
      .from(integrationConfigsTable)
      .where(eq(integrationConfigsTable.id, id));
    if (!cfg) { res.status(404).json({ error: "Not found" }); return; }
    if (!canAccessConfig(getTenantAgencyId(req), cfg.agencyId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const logs = await db
      .select()
      .from(integrationLogsTable)
      .where(eq(integrationLogsTable.integrationConfigId, id))
      .orderBy(desc(integrationLogsTable.createdAt))
      .limit(1000);

    const headers = ["id", "integration_config_id", "timestamp", "status", "duration_ms", "triggered_by", "request_payload", "response_payload", "error_message"];
    const rows = logs.map(l => [
      String(l.id),
      String(l.integrationConfigId ?? ""),
      l.createdAt?.toISOString() ?? "",
      l.status,
      l.durationMs != null ? String(l.durationMs) : "",
      l.triggeredBy ?? "",
      l.requestPayload ? JSON.stringify(l.requestPayload) : "",
      l.responsePayload ? JSON.stringify(l.responsePayload) : "",
      l.errorMessage ?? "",
    ]);

    const escape = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;

    const csv = [headers, ...rows]
      .map(row => row.map(escape).join(","))
      .join("\r\n");

    const safeName = (cfg.name ?? `integration-${id}`).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `integration-logs-${safeName}-${date}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    logger.error(err, "Failed to export integration logs");
    res.status(500).json({ error: "Failed to export integration logs" });
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

// ─── GET /integration-stats ────────────────────────────────────────────────────

router.get("/integration-stats", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const agencyId = getTenantAgencyId(req);

    // 1. Fetch all configs for this tenant
    const configs = await db
      .select({ id: integrationConfigsTable.id, name: integrationConfigsTable.name, enabled: integrationConfigsTable.enabled })
      .from(integrationConfigsTable)
      .where(agencyId ? eq(integrationConfigsTable.agencyId, agencyId) : undefined);

    const configIds = configs.map(c => c.id);
    const configMap = Object.fromEntries(configs.map(c => [c.id, c]));

    const now = new Date();
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (configIds.length === 0) {
      res.json({
        totalConfigs: 0, activeConfigs: 0, executions7d: 0, successRate7d: 0, avgDurationMs: 0,
        perConfig: [], recentFailures: [],
      });
      return;
    }

    // Build filter for config IDs using sql IN clause
    const configIdIn = sql`${integrationLogsTable.integrationConfigId} IN (${sql.join(configIds.map(id => sql`${id}`), sql`, `)})`;

    // 2. Logs in last 7 days
    const logs7d = await db
      .select({
        integrationConfigId: integrationLogsTable.integrationConfigId,
        status: integrationLogsTable.status,
        durationMs: integrationLogsTable.durationMs,
      })
      .from(integrationLogsTable)
      .where(and(configIdIn, gte(integrationLogsTable.createdAt, since7d)));

    const executions7d = logs7d.length;
    const successes7d = logs7d.filter(l => l.status === "success").length;
    const successRate7d = executions7d > 0 ? Math.round((successes7d / executions7d) * 100) : 0;
    const totalDuration = logs7d.reduce((sum, l) => sum + (l.durationMs ?? 0), 0);
    const avgDurationMs = executions7d > 0 ? Math.round(totalDuration / executions7d) : 0;

    // 3. Logs in last 24h (for per-config health)
    const logs24h = await db
      .select({
        integrationConfigId: integrationLogsTable.integrationConfigId,
        status: integrationLogsTable.status,
        createdAt: integrationLogsTable.createdAt,
      })
      .from(integrationLogsTable)
      .where(and(configIdIn, gte(integrationLogsTable.createdAt, since24h)))
      .orderBy(desc(integrationLogsTable.createdAt));

    // Group 24h logs per config
    const perConfigLogs: Record<number, typeof logs24h> = {};
    for (const log of logs24h) {
      const cid = log.integrationConfigId!;
      if (!perConfigLogs[cid]) perConfigLogs[cid] = [];
      perConfigLogs[cid].push(log);
    }

    const perConfig = configs.map(cfg => {
      const cfgLogs = perConfigLogs[cfg.id] ?? [];
      const total = cfgLogs.length;
      const success = cfgLogs.filter(l => l.status === "success").length;
      const rate = total > 0 ? (success / total) * 100 : null;
      const lastLog = cfgLogs[0] ?? null;

      let health: "healthy" | "degraded" | "failing" | "unknown";
      if (rate === null) health = "unknown";
      else if (rate >= 80) health = "healthy";
      else if (rate >= 50) health = "degraded";
      else health = "failing";

      return {
        configId: cfg.id,
        configName: cfg.name,
        executions24h: total,
        successRate24h: rate !== null ? Math.round(rate) : null,
        lastStatus: lastLog?.status ?? null,
        lastExecutionAt: lastLog?.createdAt?.toISOString() ?? null,
        health,
      };
    });

    // 4. Recent 5 failures across all configs
    const recentFailures = await db
      .select({
        logId: integrationLogsTable.id,
        configId: integrationLogsTable.integrationConfigId,
        errorMessage: integrationLogsTable.errorMessage,
        createdAt: integrationLogsTable.createdAt,
      })
      .from(integrationLogsTable)
      .where(and(configIdIn, eq(integrationLogsTable.status, "error")))
      .orderBy(desc(integrationLogsTable.createdAt))
      .limit(5);

    const recentFailuresWithName = recentFailures.map(f => ({
      logId: f.logId,
      configId: f.configId,
      configName: f.configId ? (configMap[f.configId]?.name ?? `Config #${f.configId}`) : "Unknown",
      errorMessage: f.errorMessage,
      createdAt: f.createdAt?.toISOString() ?? null,
    }));

    res.json({
      totalConfigs: configs.length,
      activeConfigs: configs.filter(c => c.enabled).length,
      executions7d,
      successRate7d,
      avgDurationMs,
      perConfig,
      recentFailures: recentFailuresWithName,
    });
  } catch (err) {
    logger.error(err, "Failed to get integration stats");
    res.status(500).json({ error: "Failed to get integration stats" });
  }
});

export default router;
