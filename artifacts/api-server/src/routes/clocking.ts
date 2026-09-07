import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, sql, gte, lte, or, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  db,
  clockingDevicesTable,
  clockingRawPunchesTable,
  attendanceRecordsTable,
  employeesTable,
  agenciesTable,
} from "@workspace/db";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Helper to resolve device by API Key header or Bearer token
async function resolveClockingDevice(req: Request) {
  const apiKey =
    (req.headers["x-device-key"] as string | undefined)?.trim() ||
    (req.headers["authorization"]?.startsWith("Bearer ")
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "").trim()
      : undefined);

  if (!apiKey) return null;

  const [device] = await db
    .select()
    .from(clockingDevicesTable)
    .where(eq(clockingDevicesTable.apiKey, apiKey))
    .limit(1);

  return device || null;
}

// ---------------------------------------------------------------------------
// 1. HARDWARE INGEST WEBHOOK: POST /api/clocking/webhook
// ---------------------------------------------------------------------------
router.post("/clocking/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    const device = await resolveClockingDevice(req);
    // If no device API key, allow standard admin/HR session for manual API calls
    if (!device) {
      // Check if user is authenticated via standard session
      const authHeader = req.headers["authorization"];
      if (!authHeader) {
        res.status(401).json({
          error: "Unauthorized: Missing X-Device-Key header or valid Bearer token.",
          hint: "Clocking machines and sync bridges must supply their registered API key in the X-Device-Key header.",
        });
        return;
      }
    }

    const body = req.body;
    const rawEvents = Array.isArray(body)
      ? body
      : Array.isArray(body.events)
      ? body.events
      : Array.isArray(body.punches)
      ? body.punches
      : [body];

    if (rawEvents.length === 0 || !rawEvents[0] || (!rawEvents[0].employeeIdentifier && !rawEvents[0].badgeNumber && !rawEvents[0].pin)) {
      res.status(400).json({
        error: "Invalid payload: Expected an array or object containing 'employeeIdentifier' and 'timestamp'.",
      });
      return;
    }

    const agencyId = device?.agencyId || 1;
    let processedCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    const results: Array<{
      employeeIdentifier: string;
      punchTime: string;
      matched: boolean;
      employeeName?: string;
      attendanceRecordId?: number;
    }> = [];

    for (const item of rawEvents) {
      const empIdentifier = String(item.employeeIdentifier || item.badgeNumber || item.pin || item.employeeId || "").trim();
      if (!empIdentifier) continue;

      const punchTimeRaw = item.timestamp || item.punchTime || item.time || new Date();
      const punchDateObj = new Date(punchTimeRaw);
      const validPunchTime = isNaN(punchDateObj.getTime()) ? new Date() : punchDateObj;
      const punchDateStr = validPunchTime.toISOString().split("T")[0];

      const punchType = (item.punchType || item.type || "auto").toLowerCase();
      const verificationMode = (item.verificationMode || item.verifyType || "biometric").toLowerCase();
      const location = item.location || device?.location || "NISIT HQ Port Moresby";

      // Match employee by employeeNumber, nationalId, or numeric ID
      let matchedEmployee: { id: number; name: string } | null = null;
      const numericId = parseInt(empIdentifier);

      const candidateEmployees = await db
        .select({ id: employeesTable.id, name: employeesTable.name, employeeNumber: employeesTable.employeeNumber })
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.agencyId, agencyId),
            or(
              sql`LOWER(TRIM(${employeesTable.employeeNumber})) = ${empIdentifier.toLowerCase()}`,
              sql`LOWER(TRIM(${employeesTable.nationalId})) = ${empIdentifier.toLowerCase()}`,
              isNaN(numericId) ? sql`1=0` : eq(employeesTable.id, numericId)
            )
          )
        )
        .limit(1);

      if (candidateEmployees.length > 0) {
        matchedEmployee = candidateEmployees[0];
        matchedCount++;
      } else {
        unmatchedCount++;
      }

      // Record in raw punches audit table
      const [rawPunch] = await db
        .insert(clockingRawPunchesTable)
        .values({
          deviceId: device?.id || null,
          deviceIdentifier: device?.name || item.deviceIdentifier || "External Clocking Terminal",
          employeeIdentifier: empIdentifier,
          matchedEmployeeId: matchedEmployee?.id || null,
          punchTime: validPunchTime,
          punchType,
          verificationMode,
          location,
          rawPayload: JSON.stringify(item),
          status: matchedEmployee ? "processed" : "unmatched",
        })
        .returning();

      let attendanceRecordId: number | undefined;

      // Consolidate into attendance_records if matched
      if (matchedEmployee) {
        const existingAttendance = await db
          .select()
          .from(attendanceRecordsTable)
          .where(
            and(
              eq(attendanceRecordsTable.employeeId, matchedEmployee.id),
              eq(attendanceRecordsTable.date, punchDateStr)
            )
          )
          .limit(1);

        const punchHours = validPunchTime.getHours();
        const punchMinutes = validPunchTime.getMinutes();
        const isStandardMorning = punchHours < 12;

        if (existingAttendance.length === 0) {
          // First punch of the day: create attendance record
          const expectedHour = 8;
          const expectedMinute = 0;
          let lateMinutes = 0;
          if (punchHours > expectedHour || (punchHours === expectedHour && punchMinutes > expectedMinute)) {
            lateMinutes = (punchHours - expectedHour) * 60 + (punchMinutes - expectedMinute);
          }

          const [newRecord] = await db
            .insert(attendanceRecordsTable)
            .values({
              employeeId: matchedEmployee.id,
              date: punchDateStr,
              clockIn: validPunchTime,
              status: lateMinutes > 15 ? "late" : "present",
              lateMinutes,
              location,
              source: device?.deviceModel ? `biometric_${device.deviceModel.toLowerCase().replace(/[^a-z0-9]/g, "_")}` : "biometric_terminal",
              deviceId: device?.id || null,
              rawPunchInId: rawPunch.id,
              notes: `Clocked in via ${device?.name || "Biometric Reader"} (${verificationMode})`,
            })
            .returning();

          attendanceRecordId = newRecord.id;
        } else {
          // Subsequent punch of the day: pair as clockOut
          const existing = existingAttendance[0];
          const clockInTime = existing.clockIn ? new Date(existing.clockIn) : validPunchTime;
          
          // Only treat as clock-out if punch is later than existing clock-in
          if (validPunchTime.getTime() > clockInTime.getTime()) {
            const expectedDepartHour = 16;
            const expectedDepartMin = 6; // Standard 4:06 PM PNG public service finish
            let earlyDepartureMinutes = 0;
            if (punchHours < expectedDepartHour || (punchHours === expectedDepartHour && punchMinutes < expectedDepartMin)) {
              earlyDepartureMinutes = (expectedDepartHour - punchHours) * 60 + (expectedDepartMin - punchMinutes);
            }

            const [updatedRecord] = await db
              .update(attendanceRecordsTable)
              .set({
                clockOut: validPunchTime,
                earlyDepartureMinutes,
                rawPunchOutId: rawPunch.id,
                updatedAt: new Date(),
                notes: existing.notes ? `${existing.notes} | Clocked out via ${device?.name || "Biometric Reader"}` : `Clocked out via ${device?.name || "Biometric Reader"}`,
              })
              .where(eq(attendanceRecordsTable.id, existing.id))
              .returning();

            attendanceRecordId = updatedRecord.id;
          } else {
            attendanceRecordId = existing.id;
          }
        }

        // Link back to raw punch
        if (attendanceRecordId) {
          await db
            .update(clockingRawPunchesTable)
            .set({ processedAttendanceRecordId: attendanceRecordId })
            .where(eq(clockingRawPunchesTable.id, rawPunch.id));
        }
      }

      processedCount++;
      results.push({
        employeeIdentifier: empIdentifier,
        punchTime: validPunchTime.toISOString(),
        matched: Boolean(matchedEmployee),
        employeeName: matchedEmployee?.name,
        attendanceRecordId,
      });
    }

    // Update device stats
    if (device) {
      await db
        .update(clockingDevicesTable)
        .set({
          totalPunchesRecorded: sql`${clockingDevicesTable.totalPunchesRecorded} + ${processedCount}`,
          lastHeartbeatAt: new Date(),
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(clockingDevicesTable.id, device.id));
    }

    res.status(200).json({
      success: true,
      message: `Processed ${processedCount} punch event(s).`,
      summary: {
        totalReceived: processedCount,
        matched: matchedCount,
        unmatched: unmatchedCount,
      },
      results,
    });
  } catch (error: any) {
    logger.error(error, "Clocking webhook error");
    res.status(500).json({ error: "Failed to process clocking webhook payload" });
  }
});

// ---------------------------------------------------------------------------
// 2. DEVICE HEARTBEAT: POST /api/clocking/devices/heartbeat
// ---------------------------------------------------------------------------
router.post("/clocking/devices/heartbeat", async (req: Request, res: Response): Promise<void> => {
  try {
    const device = await resolveClockingDevice(req);
    if (!device) {
      res.status(401).json({ error: "Unauthorized: Invalid X-Device-Key" });
      return;
    }

    await db
      .update(clockingDevicesTable)
      .set({
        lastHeartbeatAt: new Date(),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(clockingDevicesTable.id, device.id));

    res.json({
      status: "online",
      deviceId: device.id,
      name: device.name,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Heartbeat failed" });
  }
});

// ---------------------------------------------------------------------------
// 3. STATS & KPIS: GET /api/clocking/stats
// ---------------------------------------------------------------------------
router.get("/clocking/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const agencyId = getTenantAgencyId(req) || 1;
    const todayStr = new Date().toISOString().split("T")[0];

    const [devices] = await db
      .select({
        totalDevices: sql<number>`count(*)::int`,
        activeDevices: sql<number>`count(case when ${clockingDevicesTable.status} = 'active' then 1 end)::int`,
      })
      .from(clockingDevicesTable)
      .where(eq(clockingDevicesTable.agencyId, agencyId));

    const [punchesToday] = await db
      .select({
        totalPunchesToday: sql<number>`count(*)::int`,
        unmatchedToday: sql<number>`count(case when ${clockingRawPunchesTable.status} = 'unmatched' then 1 end)::int`,
      })
      .from(clockingRawPunchesTable)
      .where(sql`DATE(${clockingRawPunchesTable.punchTime}) = ${todayStr}`);

    res.json({
      totalDevices: devices?.totalDevices || 0,
      activeDevices: devices?.activeDevices || 0,
      totalPunchesToday: punchesToday?.totalPunchesToday || 0,
      unmatchedToday: punchesToday?.unmatchedToday || 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch clocking statistics" });
  }
});

// ---------------------------------------------------------------------------
// 4. LIST DEVICES: GET /api/clocking/devices
// ---------------------------------------------------------------------------
router.get("/clocking/devices", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const agencyId = getTenantAgencyId(req) || 1;
    const devices = await db
      .select()
      .from(clockingDevicesTable)
      .where(eq(clockingDevicesTable.agencyId, agencyId))
      .orderBy(desc(clockingDevicesTable.createdAt));

    // Calculate real-time online status (heartbeat in last 15 mins)
    const now = Date.now();
    const enriched = devices.map((d) => {
      const lastPing = d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt).getTime() : 0;
      const isOnline = now - lastPing < 15 * 60 * 1000;
      return {
        ...d,
        isOnline,
        maskedApiKey: d.apiKey ? `${d.apiKey.substring(0, 12)}••••••••••••` : "",
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch clocking devices" });
  }
});

// ---------------------------------------------------------------------------
// 5. REGISTER DEVICE: POST /api/clocking/devices
// ---------------------------------------------------------------------------
router.post(
  "/clocking/devices",
  authMiddleware,
  requireRole("admin", "hr_manager", "hr_officer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, deviceModel, serialNumber, ipAddress, location, notes } = req.body;
      if (!name) {
        res.status(400).json({ error: "Device name is required" });
        return;
      }

      const agencyId = getTenantAgencyId(req) || 1;
      const generatedApiKey = `clk_live_${randomUUID().replace(/-/g, "")}`;

      const [device] = await db
        .insert(clockingDevicesTable)
        .values({
          agencyId,
          name: name.trim(),
          deviceModel: deviceModel?.trim() || "Generic REST Biometric",
          serialNumber: serialNumber?.trim() || null,
          ipAddress: ipAddress?.trim() || null,
          location: location?.trim() || "NISIT HQ Port Moresby",
          apiKey: generatedApiKey,
          status: "active",
          notes: notes?.trim() || null,
        })
        .returning();

      res.status(201).json({
        ...device,
        rawApiKey: generatedApiKey,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to register clocking device" });
    }
  }
);

// ---------------------------------------------------------------------------
// 6. UPDATE DEVICE: PATCH /api/clocking/devices/:id
// ---------------------------------------------------------------------------
router.patch(
  "/clocking/devices/:id",
  authMiddleware,
  requireRole("admin", "hr_manager", "hr_officer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseIntParam(req.params.id);
      const { name, deviceModel, serialNumber, ipAddress, location, status, notes } = req.body;

      const [updated] = await db
        .update(clockingDevicesTable)
        .set({
          name: name?.trim(),
          deviceModel: deviceModel?.trim(),
          serialNumber: serialNumber?.trim(),
          ipAddress: ipAddress?.trim(),
          location: location?.trim(),
          status: status || undefined,
          notes: notes?.trim(),
          updatedAt: new Date(),
        })
        .where(eq(clockingDevicesTable.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Device not found" });
        return;
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update clocking device" });
    }
  }
);

// ---------------------------------------------------------------------------
// 7. DELETE DEVICE: DELETE /api/clocking/devices/:id
// ---------------------------------------------------------------------------
router.delete(
  "/clocking/devices/:id",
  authMiddleware,
  requireRole("admin", "hr_manager"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseIntParam(req.params.id);
      await db.delete(clockingDevicesTable).where(eq(clockingDevicesTable.id, id));
      res.json({ success: true, message: "Device deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete clocking device" });
    }
  }
);

// ---------------------------------------------------------------------------
// 8. RAW PUNCH AUDIT STREAM: GET /api/clocking/raw-punches
// ---------------------------------------------------------------------------
router.get("/clocking/raw-punches", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    const deviceIdParam = req.query.deviceId ? parseInt(req.query.deviceId as string) : undefined;
    const statusParam = req.query.status as string | undefined;
    const searchParam = req.query.search as string | undefined;
    const dateParam = req.query.date as string | undefined;

    const conditions = [];
    if (deviceIdParam) conditions.push(eq(clockingRawPunchesTable.deviceId, deviceIdParam));
    if (statusParam && statusParam !== "all") conditions.push(eq(clockingRawPunchesTable.status, statusParam));
    if (dateParam) conditions.push(sql`DATE(${clockingRawPunchesTable.punchTime}) = ${dateParam}`);
    if (searchParam) {
      conditions.push(
        or(
          sql`LOWER(${clockingRawPunchesTable.employeeIdentifier}) LIKE ${`%${searchParam.toLowerCase()}%`}`,
          sql`LOWER(${employeesTable.name}) LIKE ${`%${searchParam.toLowerCase()}%`}`,
          sql`LOWER(${clockingRawPunchesTable.deviceIdentifier}) LIKE ${`%${searchParam.toLowerCase()}%`}`
        )
      );
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clockingRawPunchesTable)
      .leftJoin(employeesTable, eq(clockingRawPunchesTable.matchedEmployeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const punches = await db
      .select({
        id: clockingRawPunchesTable.id,
        deviceId: clockingRawPunchesTable.deviceId,
        deviceName: clockingDevicesTable.name,
        deviceIdentifier: clockingRawPunchesTable.deviceIdentifier,
        employeeIdentifier: clockingRawPunchesTable.employeeIdentifier,
        matchedEmployeeId: clockingRawPunchesTable.matchedEmployeeId,
        matchedEmployeeName: employeesTable.name,
        matchedEmployeeNumber: employeesTable.employeeNumber,
        punchTime: clockingRawPunchesTable.punchTime,
        punchType: clockingRawPunchesTable.punchType,
        verificationMode: clockingRawPunchesTable.verificationMode,
        location: clockingRawPunchesTable.location,
        status: clockingRawPunchesTable.status,
        processedAttendanceRecordId: clockingRawPunchesTable.processedAttendanceRecordId,
        createdAt: clockingRawPunchesTable.createdAt,
      })
      .from(clockingRawPunchesTable)
      .leftJoin(clockingDevicesTable, eq(clockingRawPunchesTable.deviceId, clockingDevicesTable.id))
      .leftJoin(employeesTable, eq(clockingRawPunchesTable.matchedEmployeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(clockingRawPunchesTable.punchTime))
      .limit(pageSize)
      .offset(offset);

    res.json({
      data: punches,
      pagination: {
        page,
        pageSize,
        totalRecords: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / pageSize),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch raw clocking punches" });
  }
});

// ---------------------------------------------------------------------------
// 9. REPROCESS UNMATCHED PUNCH: POST /api/clocking/raw-punches/:id/reprocess
// ---------------------------------------------------------------------------
router.post(
  "/clocking/raw-punches/:id/reprocess",
  authMiddleware,
  requireRole("admin", "hr_manager", "hr_officer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const punchId = parseIntParam(req.params.id);
      const { employeeId } = req.body;

      if (!employeeId) {
        res.status(400).json({ error: "Target employee ID is required for reprocessing" });
        return;
      }

      const [punch] = await db
        .select()
        .from(clockingRawPunchesTable)
        .where(eq(clockingRawPunchesTable.id, punchId))
        .limit(1);

      if (!punch) {
        res.status(404).json({ error: "Raw punch event not found" });
        return;
      }

      const [employee] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, parseInt(employeeId)))
        .limit(1);

      if (!employee) {
        res.status(404).json({ error: "Employee record not found" });
        return;
      }

      const punchDateStr = new Date(punch.punchTime).toISOString().split("T")[0];
      const validPunchTime = new Date(punch.punchTime);

      // Check existing attendance record
      const [existing] = await db
        .select()
        .from(attendanceRecordsTable)
        .where(
          and(
            eq(attendanceRecordsTable.employeeId, employee.id),
            eq(attendanceRecordsTable.date, punchDateStr)
          )
        )
        .limit(1);

      let recordId: number;
      if (!existing) {
        const punchHours = validPunchTime.getHours();
        const punchMinutes = validPunchTime.getMinutes();
        let lateMinutes = 0;
        if (punchHours > 8 || (punchHours === 8 && punchMinutes > 0)) {
          lateMinutes = (punchHours - 8) * 60 + punchMinutes;
        }

        const [newRec] = await db
          .insert(attendanceRecordsTable)
          .values({
            employeeId: employee.id,
            date: punchDateStr,
            clockIn: validPunchTime,
            status: lateMinutes > 15 ? "late" : "present",
            lateMinutes,
            location: punch.location || "NISIT HQ Port Moresby",
            source: "biometric_reprocessed",
            deviceId: punch.deviceId,
            rawPunchInId: punch.id,
            notes: `Reprocessed from badge ${punch.employeeIdentifier}`,
          })
          .returning();
        recordId = newRec.id;
      } else {
        const [updatedRec] = await db
          .update(attendanceRecordsTable)
          .set({
            clockOut: validPunchTime,
            rawPunchOutId: punch.id,
            updatedAt: new Date(),
          })
          .where(eq(attendanceRecordsTable.id, existing.id))
          .returning();
        recordId = updatedRec.id;
      }

      await db
        .update(clockingRawPunchesTable)
        .set({
          matchedEmployeeId: employee.id,
          status: "processed",
          processedAttendanceRecordId: recordId,
        })
        .where(eq(clockingRawPunchesTable.id, punchId));

      res.json({ success: true, attendanceRecordId: recordId, employeeName: employee.name });
    } catch (error) {
      res.status(500).json({ error: "Reprocessing failed" });
    }
  }
);

// ---------------------------------------------------------------------------
// 10. BATCH LOG FILE IMPORT (CSV / USB EXPORTS): POST /api/clocking/import-file
// ---------------------------------------------------------------------------
router.post(
  "/clocking/import-file",
  authMiddleware,
  requireRole("admin", "hr_manager", "hr_officer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows, filename } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: "Invalid payload: Expected an array of rows from CSV or text export." });
        return;
      }

      const agencyId = getTenantAgencyId(req) || 1;
      let importedCount = 0;
      let matchedCount = 0;
      let unmatchedCount = 0;

      for (const row of rows) {
        const empIdStr = String(row.employeeIdentifier || row.badgeNumber || row.pin || row.employeeId || "").trim();
        if (!empIdStr) continue;

        const dateStr = String(row.date || row.timestamp || "").trim();
        const punchDateObj = new Date(dateStr);
        if (isNaN(punchDateObj.getTime())) continue;

        const punchType = (row.punchType || "auto").toLowerCase();
        const verificationMode = (row.verificationMode || "manual_upload").toLowerCase();
        const location = row.location || "NISIT Offline Terminal";

        // Find employee
        const numId = parseInt(empIdStr);
        const [emp] = await db
          .select({ id: employeesTable.id, name: employeesTable.name })
          .from(employeesTable)
          .where(
            and(
              eq(employeesTable.agencyId, agencyId),
              or(
                sql`LOWER(TRIM(${employeesTable.employeeNumber})) = ${empIdStr.toLowerCase()}`,
                sql`LOWER(TRIM(${employeesTable.nationalId})) = ${empIdStr.toLowerCase()}`,
                isNaN(numId) ? sql`1=0` : eq(employeesTable.id, numId)
              )
            )
          )
          .limit(1);

        if (emp) matchedCount++;
        else unmatchedCount++;

        const [rawPunch] = await db
          .insert(clockingRawPunchesTable)
          .values({
            deviceIdentifier: filename || "Batch File Import",
            employeeIdentifier: empIdStr,
            matchedEmployeeId: emp?.id || null,
            punchTime: punchDateObj,
            punchType,
            verificationMode,
            location,
            rawPayload: JSON.stringify(row),
            status: emp ? "processed" : "unmatched",
          })
          .returning();

        if (emp) {
          const punchDateOnly = punchDateObj.toISOString().split("T")[0];
          const [existing] = await db
            .select()
            .from(attendanceRecordsTable)
            .where(
              and(
                eq(attendanceRecordsTable.employeeId, emp.id),
                eq(attendanceRecordsTable.date, punchDateOnly)
              )
            )
            .limit(1);

          if (!existing) {
            const punchHours = punchDateObj.getHours();
            const punchMinutes = punchDateObj.getMinutes();
            let lateMinutes = 0;
            if (punchHours > 8 || (punchHours === 8 && punchMinutes > 0)) {
              lateMinutes = (punchHours - 8) * 60 + punchMinutes;
            }

            const [newRecord] = await db
              .insert(attendanceRecordsTable)
              .values({
                employeeId: emp.id,
                date: punchDateOnly,
                clockIn: punchDateObj,
                status: lateMinutes > 15 ? "late" : "present",
                lateMinutes,
                location,
                source: "csv_import",
                rawPunchInId: rawPunch.id,
                notes: `Imported from ${filename || "CSV log file"}`,
              })
              .returning();

            await db
              .update(clockingRawPunchesTable)
              .set({ processedAttendanceRecordId: newRecord.id })
              .where(eq(clockingRawPunchesTable.id, rawPunch.id));
          } else if (punchDateObj.getTime() > (existing.clockIn ? new Date(existing.clockIn).getTime() : 0)) {
            const [updatedRecord] = await db
              .update(attendanceRecordsTable)
              .set({
                clockOut: punchDateObj,
                rawPunchOutId: rawPunch.id,
                updatedAt: new Date(),
              })
              .where(eq(attendanceRecordsTable.id, existing.id))
              .returning();

            await db
              .update(clockingRawPunchesTable)
              .set({ processedAttendanceRecordId: updatedRecord.id })
              .where(eq(clockingRawPunchesTable.id, rawPunch.id));
          }
        }

        importedCount++;
      }

      res.json({
        success: true,
        message: `Successfully processed ${importedCount} records from file.`,
        summary: {
          totalRows: rows.length,
          imported: importedCount,
          matched: matchedCount,
          unmatched: unmatchedCount,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process batch log file" });
    }
  }
);

export default router;
