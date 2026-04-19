import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte, or, ilike } from "drizzle-orm";
import { db, auditLogTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

router.get("/audit-log", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);

  const actionType = typeof req.query.actionType === "string" ? req.query.actionType : undefined;
  const outcome = typeof req.query.outcome === "string" ? req.query.outcome : undefined;
  const fromDateRaw = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
  const toDateRaw = typeof req.query.toDate === "string" ? req.query.toDate : undefined;
  const email = typeof req.query.email === "string" ? req.query.email.trim() : undefined;
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
  if (fromDateRaw) {
    const fromDate = new Date(fromDateRaw);
    if (!isNaN(fromDate.getTime())) {
      conditions.push(gte(auditLogTable.createdAt, fromDate));
    }
  }
  if (toDateRaw) {
    let toDate = new Date(toDateRaw);
    if (!isNaN(toDate.getTime())) {
      // If date-only (YYYY-MM-DD), include the entire day
      if (/^\d{4}-\d{2}-\d{2}$/.test(toDateRaw)) {
        toDate = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      conditions.push(lte(auditLogTable.createdAt, toDate));
    }
  }
  if (email) {
    const pattern = `%${email}%`;
    conditions.push(
      or(
        ilike(auditLogTable.performedByEmail, pattern),
        ilike(auditLogTable.targetEmail, pattern),
      )!,
    );
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
