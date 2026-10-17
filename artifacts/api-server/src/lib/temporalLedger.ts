import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

export interface TemporalRecordInput {
  entityType: string; // "employee", "salary_profile", "contract", "position", "department", "payroll_item", "leave_balance"
  entityId: number;
  entityReference?: string;
  entityName: string;
  eventType: string; // "initial_hire", "salary_increment", "promotion", "allowance_configured", "contract_renewed", "department_transferred", "payroll_disbursed", "leave_allocated", "status_changed"
  eventTitle: string;
  changeSummary: string;
  validFrom?: Date | string;
  validTo?: Date | string | null;
  actorUserId?: number | null;
  actorName?: string;
  actorRole?: string;
  agencyId?: number | null;
  previousState?: any;
  snapshotState: any;
  diff?: any;
  metadata?: any;
}

export function computeSha256Checksum(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function computeFieldDiff(oldObj: any, newObj: any): Record<string, { from: any; to: any }> {
  if (!oldObj || typeof oldObj !== "object") return {};
  if (!newObj || typeof newObj !== "object") return {};

  const diff: Record<string, { from: any; to: any }> = {};
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (["updatedAt", "createdAt", "updated_at", "created_at"].includes(key)) continue;
    const vOld = oldObj[key];
    const vNew = newObj[key];

    const sOld = JSON.stringify(vOld);
    const sNew = JSON.stringify(vNew);

    if (sOld !== sNew) {
      diff[key] = { from: vOld ?? null, to: vNew ?? null };
    }
  }

  return diff;
}

export async function recordTemporalSnapshot(input: TemporalRecordInput): Promise<any> {
  try {
    const validFromDate = input.validFrom ? new Date(input.validFrom) : new Date();
    const validFromIso = validFromDate.toISOString();

    // 1. Close any currently open snapshot for this entity that precedes validFrom
    await db.execute(sql`
      UPDATE temporal_transaction_snapshots
      SET valid_to = ${validFromIso}::timestamptz
      WHERE entity_type = ${input.entityType}
        AND entity_id = ${input.entityId}
        AND valid_to IS NULL
        AND valid_from < ${validFromIso}::timestamptz;
    `);

    // 2. Generate deterministic transaction number
    const year = validFromDate.getFullYear();
    const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const txnNumber = `TXN-${year}-${input.entityType.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

    // 3. Compute diff if not provided
    const resolvedDiff = input.diff || (input.previousState ? computeFieldDiff(input.previousState, input.snapshotState) : {});

    // 4. Compute cryptographic tamper-evident checksum
    const rawForHash = `${txnNumber}|${input.entityType}|${input.entityId}|${validFromIso}|${JSON.stringify(input.snapshotState)}`;
    const checksum = computeSha256Checksum(rawForHash);

    // 5. Insert immutable snapshot
    const result = await db.execute(sql`
      INSERT INTO temporal_transaction_snapshots (
        transaction_number,
        entity_type,
        entity_id,
        entity_reference,
        entity_name,
        event_type,
        event_title,
        change_summary,
        valid_from,
        valid_to,
        recorded_at,
        actor_user_id,
        actor_name,
        actor_role,
        agency_id,
        previous_state,
        snapshot_state,
        diff,
        metadata,
        checksum,
        is_locked
      ) VALUES (
        ${txnNumber},
        ${input.entityType},
        ${input.entityId},
        ${input.entityReference || null},
        ${input.entityName},
        ${input.eventType},
        ${input.eventTitle},
        ${input.changeSummary},
        ${validFromIso}::timestamptz,
        ${input.validTo ? new Date(input.validTo).toISOString() : null}::timestamptz,
        NOW(),
        ${input.actorUserId || null},
        ${input.actorName || "NISIT Authority"},
        ${input.actorRole || "hr_officer"},
        ${input.agencyId || 1},
        ${input.previousState ? JSON.stringify(input.previousState) : null}::jsonb,
        ${JSON.stringify(input.snapshotState)}::jsonb,
        ${JSON.stringify(resolvedDiff)}::jsonb,
        ${JSON.stringify(input.metadata || {})}::jsonb,
        ${checksum},
        TRUE
      )
      RETURNING *;
    `);

    return result.rows[0];
  } catch (err: any) {
    logger.error({ err }, "Failed to record temporal transaction snapshot");
    throw err;
  }
}

export async function getEntityAsOf(
  entityType: string,
  entityId: number,
  asOfTimestamp: Date | string
): Promise<{
  found: boolean;
  asOfTimestamp: string;
  snapshot: any | null;
  message?: string;
}> {
  const dateObj = new Date(asOfTimestamp);
  const isoStr = dateObj.toISOString();

  const res = await db.execute(sql`
    SELECT *
    FROM temporal_transaction_snapshots
    WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND valid_from <= ${isoStr}::timestamptz
      AND (valid_to IS NULL OR valid_to > ${isoStr}::timestamptz)
    ORDER BY valid_from DESC, recorded_at DESC
    LIMIT 1;
  `);

  if (res.rows.length === 0) {
    // Check if any record existed after this date to give a helpful message
    const futureRes = await db.execute(sql`
      SELECT valid_from FROM temporal_transaction_snapshots
      WHERE entity_type = ${entityType} AND entity_id = ${entityId}
      ORDER BY valid_from ASC LIMIT 1;
    `);
    const earliest = (futureRes.rows[0] as any)?.valid_from;

    return {
      found: false,
      asOfTimestamp: isoStr,
      snapshot: null,
      message: earliest
        ? `No active record existed on ${dateObj.toLocaleDateString("en-PG")}. Earliest historical record commenced on ${new Date(earliest).toLocaleDateString("en-PG")}.`
        : "No historical records found for this entity.",
    };
  }

  const row = res.rows[0] as any;
  return {
    found: true,
    asOfTimestamp: isoStr,
    snapshot: {
      id: row.id,
      transactionNumber: row.transaction_number,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityReference: row.entity_reference,
      entityName: row.entity_name,
      eventType: row.event_type,
      eventTitle: row.event_title,
      changeSummary: row.change_summary,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      recordedAt: row.recorded_at,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      state: row.snapshot_state,
      checksum: row.checksum,
      metadata: row.metadata,
    },
  };
}

export async function compareEntityAtTimes(
  entityType: string,
  entityId: number,
  timestampA: Date | string,
  timestampB: Date | string
): Promise<{
  entityType: string;
  entityId: number;
  dateA: string;
  dateB: string;
  stateA: any | null;
  stateB: any | null;
  delta: Record<string, { from: any; to: any }>;
  summary: string[];
}> {
  const resA = await getEntityAsOf(entityType, entityId, timestampA);
  const resB = await getEntityAsOf(entityType, entityId, timestampB);

  const stateA = resA.snapshot?.state || null;
  const stateB = resB.snapshot?.state || null;

  const delta = computeFieldDiff(stateA || {}, stateB || {});
  const summary: string[] = [];

  if (!stateA && stateB) {
    summary.push(`Entity was newly instituted / appointed on ${new Date(resB.snapshot.validFrom).toLocaleDateString("en-PG")}.`);
  } else if (stateA && !stateB) {
    summary.push(`Entity was separated / closed prior to ${new Date(timestampB).toLocaleDateString("en-PG")}.`);
  } else {
    for (const [key, change] of Object.entries(delta)) {
      if (key === "annualBaseSalary" || key === "annual_base_salary") {
        summary.push(`Annual base compensation altered from K${Number(change.from || 0).toLocaleString()} to K${Number(change.to || 0).toLocaleString()}`);
      } else if (key === "gradeLevel" || key === "grade_level") {
        summary.push(`Classification re-graded from ${change.from || "Unassigned"} to ${change.to}`);
      } else if (key === "departmentName" || key === "department_name") {
        summary.push(`Transferred directorate from ${change.from || "None"} to ${change.to}`);
      } else if (key === "positionTitle" || key === "position_title") {
        summary.push(`Designated role title updated from "${change.from}" to "${change.to}"`);
      } else if (key.toLowerCase().includes("allowance")) {
        summary.push(`Allowance parameter [${key}] revised from ${change.from} to ${change.to}`);
      }
    }
  }

  return {
    entityType,
    entityId,
    dateA: new Date(timestampA).toISOString(),
    dateB: new Date(timestampB).toISOString(),
    stateA,
    stateB,
    delta,
    summary,
  };
}
