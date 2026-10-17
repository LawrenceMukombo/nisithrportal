import { Router, type IRouter, type Request, type Response } from "express";
import { sql, desc, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { currentEmployeeId, canReadEmployee } from "../lib/employee-access";
import { logger } from "../lib/logger";
import {
  recordTemporalSnapshot,
  getEntityAsOf,
  compareEntityAtTimes,
  computeSha256Checksum,
} from "../lib/temporalLedger";

const router: IRouter = Router();

// ==========================================
// 1. GET CHRONOLOGICAL TRANSACTION LEDGER / TIMELINE
// ==========================================
router.get("/temporal/timeline", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawEntityType = req.query.entityType ? String(req.query.entityType) : null;
    const rawEntityId = req.query.entityId ? parseInt(String(req.query.entityId), 10) : null;
    const eventType = req.query.eventType ? String(req.query.eventType) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const fromDate = req.query.fromDate ? String(req.query.fromDate) : null;
    const toDate = req.query.toDate ? String(req.query.toDate) : null;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(String(req.query.pageSize || "25"), 10)));
    const offset = (page - 1) * pageSize;

    // RBAC: If querying a specific employee, ensure user has access
    if (rawEntityType === "employee" && rawEntityId) {
      const allowed = await canReadEmployee(req, rawEntityId);
      if (!allowed) {
        res.status(403).json({ success: false, message: "Forbidden: Cannot access this officer's history" });
        return;
      }
    } else if (!["admin", "hr_officer", "hr_manager", "executive"].includes(req.user?.roleName || "")) {
      // Non-privileged users default to their own employee ID
      const selfEmpId = await currentEmployeeId(req);
      if (!selfEmpId) {
        res.status(400).json({ success: false, message: "No employee profile linked to current user" });
        return;
      }
      // Force filter to self
      const rows = (await db.execute(sql`
        SELECT 
          id,
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
          actor_name,
          actor_role,
          diff,
          checksum,
          metadata
        FROM temporal_transaction_snapshots
        WHERE entity_type IN ('employee', 'salary_profile', 'contract', 'payroll_item')
          AND entity_id = ${selfEmpId}
        ORDER BY valid_from DESC, recorded_at DESC
        LIMIT ${pageSize} OFFSET ${offset};
      `)).rows;

      const totalRes = await db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM temporal_transaction_snapshots
        WHERE entity_type IN ('employee', 'salary_profile', 'contract', 'payroll_item')
          AND entity_id = ${selfEmpId};
      `);
      const total = (totalRes.rows[0] as any)?.count || 0;

      res.json({
        success: true,
        data: rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
      return;
    }

    // Privileged query with dynamic filters
    let baseQuery = `
      SELECT 
        id,
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
        actor_name,
        actor_role,
        diff,
        checksum,
        metadata
      FROM temporal_transaction_snapshots
      WHERE 1=1
    `;
    const params: any[] = [];

    if (rawEntityType) {
      params.push(rawEntityType);
      baseQuery += ` AND entity_type = $${params.length}`;
    }
    if (rawEntityId) {
      params.push(rawEntityId);
      baseQuery += ` AND entity_id = $${params.length}`;
    }
    if (eventType) {
      params.push(eventType);
      baseQuery += ` AND event_type = $${params.length}`;
    }
    if (fromDate) {
      params.push(fromDate);
      baseQuery += ` AND valid_from >= $${params.length}::timestamptz`;
    }
    if (toDate) {
      params.push(toDate);
      baseQuery += ` AND valid_from <= $${params.length}::timestamptz`;
    }
    if (search) {
      params.push(`%${search}%`);
      baseQuery += ` AND (entity_name ILIKE $${params.length} OR event_title ILIKE $${params.length} OR change_summary ILIKE $${params.length} OR transaction_number ILIKE $${params.length})`;
    }

    const countQuery = `SELECT COUNT(*)::int as count FROM (${baseQuery}) sub`;
    const countRes = await db.execute(sql.raw(countQuery));
    const total = (countRes.rows[0] as any)?.count || 0;

    baseQuery += ` ORDER BY valid_from DESC, recorded_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const result = await db.execute(sql.raw(baseQuery));

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch temporal timeline");
    res.status(500).json({ success: false, message: "Failed to load timeline", error: err.message });
  }
});

// ==========================================
// 2. GET POINT-IN-TIME ENTITY STATE ("AS-OF" TIME TRAVEL)
// ==========================================
router.get("/temporal/as-of", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const entityType = String(req.query.entityType || "employee");
    let entityId = req.query.entityId ? parseInt(String(req.query.entityId), 10) : 0;
    const asOfTimestamp = req.query.timestamp ? String(req.query.timestamp) : new Date().toISOString();

    if (!entityId) {
      const selfEmpId = await currentEmployeeId(req);
      if (!selfEmpId) {
        res.status(400).json({ success: false, message: "No employee profile linked to current user" });
        return;
      }
      entityId = selfEmpId;
    }

    // RBAC check
    if (entityType === "employee") {
      const allowed = await canReadEmployee(req, entityId);
      if (!allowed) {
        res.status(403).json({ success: false, message: "Forbidden: Cannot access this officer's historical state" });
        return;
      }
    }

    const stateResult = await getEntityAsOf(entityType, entityId, asOfTimestamp);

    res.json({
      success: true,
      data: stateResult,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to reconstruct entity as-of point in time");
    res.status(500).json({ success: false, message: "Point-in-time query failed", error: err.message });
  }
});

// ==========================================
// 3. COMPARE ENTITY STATE BETWEEN TWO POINTS IN TIME ("TIME DIFF")
// ==========================================
router.get("/temporal/compare", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const entityType = String(req.query.entityType || "employee");
    let entityId = req.query.entityId ? parseInt(String(req.query.entityId), 10) : 0;
    const timestampA = req.query.timestampA ? String(req.query.timestampA) : null;
    const timestampB = req.query.timestampB ? String(req.query.timestampB) : new Date().toISOString();

    if (!timestampA) {
      res.status(400).json({ success: false, message: "timestampA is required for comparative analysis" });
      return;
    }

    if (!entityId) {
      const selfEmpId = await currentEmployeeId(req);
      if (!selfEmpId) {
        res.status(400).json({ success: false, message: "No employee profile linked to current user" });
        return;
      }
      entityId = selfEmpId;
    }

    // RBAC check
    if (entityType === "employee") {
      const allowed = await canReadEmployee(req, entityId);
      if (!allowed) {
        res.status(403).json({ success: false, message: "Forbidden: Cannot access this officer's history" });
        return;
      }
    }

    const comparison = await compareEntityAtTimes(entityType, entityId, timestampA, timestampB);

    res.json({
      success: true,
      data: comparison,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to execute temporal comparison");
    res.status(500).json({ success: false, message: "Temporal comparison failed", error: err.message });
  }
});

// ==========================================
// 4. GET ALL DISCRETE HISTORICAL EPOCHS / VERSIONS OF AN ENTITY
// ==========================================
router.get("/temporal/entity-versions", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const entityType = String(req.query.entityType || "employee");
    let entityId = req.query.entityId ? parseInt(String(req.query.entityId), 10) : 0;

    if (!entityId) {
      const selfEmpId = await currentEmployeeId(req);
      if (!selfEmpId) {
        res.status(400).json({ success: false, message: "No employee profile linked to current user" });
        return;
      }
      entityId = selfEmpId;
    }

    // RBAC check
    if (entityType === "employee") {
      const allowed = await canReadEmployee(req, entityId);
      if (!allowed) {
        res.status(403).json({ success: false, message: "Forbidden: Cannot access this officer's history" });
        return;
      }
    }

    const versions = (await db.execute(sql`
      SELECT 
        id,
        transaction_number,
        event_type,
        event_title,
        change_summary,
        valid_from,
        valid_to,
        recorded_at,
        actor_name,
        actor_role,
        diff,
        checksum,
        snapshot_state
      FROM temporal_transaction_snapshots
      WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}
      ORDER BY valid_from ASC;
    `)).rows;

    res.json({
      success: true,
      data: {
        entityType,
        entityId,
        totalVersions: versions.length,
        versions,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch entity versions");
    res.status(500).json({ success: false, message: "Failed to fetch entity versions", error: err.message });
  }
});

// ==========================================
// 5. GET ORGANIZATIONAL WORKFORCE AS-OF DATE IN HISTORY
// ==========================================
router.get("/temporal/organization-as-of", authMiddleware, requireRole("admin", "hr_officer", "hr_manager", "executive"), async (req: Request, res: Response): Promise<void> => {
  try {
    const timestampStr = req.query.timestamp ? String(req.query.timestamp) : new Date().toISOString();
    const isoDate = new Date(timestampStr).toISOString();

    // Fetch active snapshots as of that date
    const rows = (await db.execute(sql`
      SELECT 
        entity_id,
        entity_name,
        entity_reference,
        snapshot_state,
        valid_from,
        valid_to
      FROM temporal_transaction_snapshots
      WHERE entity_type = 'employee'
        AND valid_from <= ${isoDate}::timestamptz
        AND (valid_to IS NULL OR valid_to > ${isoDate}::timestamptz)
      ORDER BY entity_name ASC;
    `)).rows as any[];

    // Aggregate statistics as of that date
    let totalHeadcount = rows.length;
    let totalAnnualBase = 0;
    const departmentDistribution: Record<string, number> = {};
    const gradeDistribution: Record<string, number> = {};

    for (const r of rows) {
      const state = r.snapshot_state || {};
      const dept = state.departmentName || state.department_name || "Unassigned";
      const grade = state.gradeLevel || state.grade_level || "Unassigned";
      const salary = Number(state.annualBaseSalary || state.annual_base_salary) || 0;

      departmentDistribution[dept] = (departmentDistribution[dept] || 0) + 1;
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
      totalAnnualBase += salary;
    }

    res.json({
      success: true,
      data: {
        asOfTimestamp: isoDate,
        totalHeadcount,
        totalAnnualPayrollRunRate: totalAnnualBase,
        fortnightlyPayrollRunRate: Math.round((totalAnnualBase / 26) * 100) / 100,
        departmentDistribution,
        gradeDistribution,
        officers: rows.map((r) => ({
          employeeId: r.entity_id,
          name: r.entity_name,
          employeeNumber: r.entity_reference,
          positionTitle: r.snapshot_state?.positionTitle,
          departmentName: r.snapshot_state?.departmentName,
          gradeLevel: r.snapshot_state?.gradeLevel,
          annualBaseSalary: r.snapshot_state?.annualBaseSalary,
          validFrom: r.valid_from,
        })),
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to reconstruct organization as-of date");
    res.status(500).json({ success: false, message: "Organization point-in-time query failed", error: err.message });
  }
});

// ==========================================
// 6. RECORD NEW AUTHORIZED TRANSACTION (IMMUTABLE SNAPSHOT)
// ==========================================
router.post("/temporal/record", authMiddleware, requireRole("admin", "hr_officer", "hr_manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      entityType,
      entityId,
      entityReference,
      entityName,
      eventType,
      eventTitle,
      changeSummary,
      validFrom,
      previousState,
      snapshotState,
      diff,
      metadata,
    } = req.body;

    if (!entityType || !entityId || !entityName || !eventType || !eventTitle || !snapshotState) {
      res.status(400).json({ success: false, message: "Missing required snapshot parameters" });
      return;
    }

    const recorded = await recordTemporalSnapshot({
      entityType,
      entityId: Number(entityId),
      entityReference,
      entityName,
      eventType,
      eventTitle,
      changeSummary: changeSummary || eventTitle,
      validFrom: validFrom || new Date(),
      actorUserId: req.user?.userId,
      actorName: req.user?.email || "HR Authority",
      actorRole: req.user?.roleName || "hr_officer",
      agencyId: req.user?.agencyId || 1,
      previousState,
      snapshotState,
      diff,
      metadata,
    });

    res.json({
      success: true,
      data: recorded,
      message: "Immutable historical transaction recorded into temporal ledger",
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to record manual temporal transaction");
    res.status(500).json({ success: false, message: "Failed to record transaction", error: err.message });
  }
});

// ==========================================
// 7. CERTIFIED STATEMENT OF RECORD AS-AT (LEGAL & STATUTORY AUDIT)
// ==========================================
router.get("/temporal/certificate", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const entityType = String(req.query.entityType || "employee");
    let entityId = req.query.entityId ? parseInt(String(req.query.entityId), 10) : 0;
    const asOfTimestamp = req.query.timestamp ? String(req.query.timestamp) : new Date().toISOString();

    if (!entityId) {
      const selfEmpId = await currentEmployeeId(req);
      if (!selfEmpId) {
        res.status(400).json({ success: false, message: "No employee profile linked to current user" });
        return;
      }
      entityId = selfEmpId;
    }

    // RBAC
    if (entityType === "employee") {
      const allowed = await canReadEmployee(req, entityId);
      if (!allowed) {
        res.status(403).json({ success: false, message: "Forbidden" });
        return;
      }
    }

    const stateResult = await getEntityAsOf(entityType, entityId, asOfTimestamp);

    if (!stateResult.found || !stateResult.snapshot) {
      res.status(404).json({ success: false, message: stateResult.message || "Record not found as of specified date" });
      return;
    }

    const snap = stateResult.snapshot;
    const certNumber = `NISIT-CERT-${snap.transactionNumber}-${Date.now().toString(36).toUpperCase()}`;

    res.json({
      success: true,
      data: {
        certificateNumber: certNumber,
        certifiedAsOf: asOfTimestamp,
        certifiedAt: new Date().toISOString(),
        issuingAuthority: "PNG National Institute of Standards & Industrial Technology (NISIT)",
        statutoryActs: "Papua New Guinea Public Services Management Act 1995, Salaries and Wages Tax Act 1959, National Institute of Standards & Industrial Technology Act",
        entity: {
          type: snap.entityType,
          id: snap.entityId,
          reference: snap.entityReference,
          name: snap.entityName,
        },
        stateAsOf: snap.state,
        transactionHistory: {
          transactionNumber: snap.transactionNumber,
          eventType: snap.eventType,
          eventTitle: snap.eventTitle,
          changeSummary: snap.changeSummary,
          validFrom: snap.validFrom,
          validTo: snap.validTo,
          recordedAt: snap.recordedAt,
          actor: snap.actorName,
        },
        verificationHash: snap.checksum,
        verificationUrl: `https://hr.nisit.gov.pg/verify/record?cert=${certNumber}&hash=${snap.checksum}`,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to generate certified statement of record");
    res.status(500).json({ success: false, message: "Certificate generation failed", error: err.message });
  }
});

export default router;
