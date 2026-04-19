import { db, auditLogTable } from "@workspace/db";
import { logger } from "./logger";

export type AuditActionType =
  | "user_create"
  | "role_change"
  | "status_change"
  | "email_change"
  | "password_reset"
  | "domain_violation"
  | "application_document_delete"
  | "contract_document_clear";

export type AuditOutcome = "success" | "rejected";

export interface WriteAuditLogParams {
  performedById?: number | null;
  performedByEmail?: string | null;
  targetUserId?: number | null;
  targetEmail?: string | null;
  actionType: AuditActionType;
  outcome: AuditOutcome;
  details?: Record<string, unknown> | null;
  agencyId?: number | null;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      performedById: params.performedById ?? null,
      performedByEmail: params.performedByEmail ?? null,
      targetUserId: params.targetUserId ?? null,
      targetEmail: params.targetEmail ?? null,
      actionType: params.actionType,
      outcome: params.outcome,
      details: params.details ?? null,
      agencyId: params.agencyId ?? null,
    });
  } catch (err) {
    // Audit log failures must never break the primary operation, but we log them for visibility
    logger.warn({ err, actionType: params.actionType }, "writeAuditLog: failed to persist audit entry");
  }
}
