import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, auditLogTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

router.get("/audit-log", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);

  const actionType = typeof req.query.actionType === "string" ? req.query.actionType : undefined;
  const outcome = typeof req.query.outcome === "string" ? req.query.outcome : undefined;
  const limit = Math.min(parseInt(typeof req.query.limit === "string" ? req.query.limit : "100") || 100, 500);
  const offset = parseInt(typeof req.query.offset === "string" ? req.query.offset : "0") || 0;

  const conditions = [];

  if (agencyId != null) {
    conditions.push(eq(auditLogTable.agencyId, agencyId));
  }
  if (actionType) {
    conditions.push(eq(auditLogTable.actionType, actionType));
  }
  if (outcome) {
    conditions.push(eq(auditLogTable.outcome, outcome));
  }

  const rows = await db
    .select()
    .from(auditLogTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

export default router;
