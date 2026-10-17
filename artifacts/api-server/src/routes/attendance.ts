import { Router, type IRouter } from "express";
import { eq, and, desc, sql, gte, lte, or } from "drizzle-orm";
import { db, attendanceRecordsTable, employeesTable, geofenceZonesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { canManageEmployee, currentEmployeeId, hasSensitiveReadAccess } from "../lib/employee-access";
import { getTenantAgencyId } from "../middlewares/tenant";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /api/attendance - List attendance records
router.get("/attendance", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const dateParam = req.query.date as string | undefined;
    const startDateParam = req.query.start_date as string | undefined;
    const endDateParam = req.query.end_date as string | undefined;

    const conditions = [];
    if (employeeIdParam) conditions.push(eq(attendanceRecordsTable.employeeId, employeeIdParam));
    if (dateParam) conditions.push(eq(attendanceRecordsTable.date, dateParam));
    if (startDateParam) conditions.push(gte(attendanceRecordsTable.date, startDateParam));
    if (endDateParam) conditions.push(lte(attendanceRecordsTable.date, endDateParam));
    const ownEmployeeId = await currentEmployeeId(req);
    if (hasSensitiveReadAccess(req)) {
      const agencyId = getTenantAgencyId(req);
      if (agencyId != null) conditions.push(eq(employeesTable.agencyId, agencyId));
    } else {
      if (!ownEmployeeId || (employeeIdParam && employeeIdParam !== ownEmployeeId)) { res.status(403).json({ error: "Forbidden" }); return; }
      conditions.push(eq(attendanceRecordsTable.employeeId, ownEmployeeId));
    }

    const records = await db
      .select({
        id: attendanceRecordsTable.id,
        employeeId: attendanceRecordsTable.employeeId,
        employeeName: employeesTable.name,
        date: attendanceRecordsTable.date,
        clockIn: attendanceRecordsTable.clockIn,
        clockOut: attendanceRecordsTable.clockOut,
        status: attendanceRecordsTable.status,
        lateMinutes: attendanceRecordsTable.lateMinutes,
        earlyDepartureMinutes: attendanceRecordsTable.earlyDepartureMinutes,
        location: attendanceRecordsTable.location,
        source: attendanceRecordsTable.source,
        notes: attendanceRecordsTable.notes,
        createdAt: attendanceRecordsTable.createdAt,
      })
      .from(attendanceRecordsTable)
      .leftJoin(employeesTable, eq(attendanceRecordsTable.employeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendanceRecordsTable.date));

    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance records" });
  }
});

// POST /api/attendance/clock-in - Clock in for employee
router.post("/attendance/clock-in", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, location, notes } = req.body;
    const requestedEmployeeId = employeeId ? parseInt(employeeId) : null;
    const ownEmployeeId = await currentEmployeeId(req);
    const targetEmployeeId = requestedEmployeeId ?? ownEmployeeId;

    if (!targetEmployeeId) {
      res.status(403).json({ error: "No active employee profile is linked to this account. Daily attendance tracking is reserved for registered NISIT staff members." });
      return;
    }
    if (requestedEmployeeId && requestedEmployeeId !== ownEmployeeId && !await canManageEmployee(req, requestedEmployeeId)) {
      res.status(403).json({ error: "Forbidden: You do not have permission to clock in for this employee." });
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const existing = await db
      .select()
      .from(attendanceRecordsTable)
      .where(and(eq(attendanceRecordsTable.employeeId, targetEmployeeId), eq(attendanceRecordsTable.date, todayStr)))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "Already clocked in for today", record: existing[0] });
      return;
    }

    const now = new Date();
    const expectedHour = 8;
    const expectedMinute = 0;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    let lateMinutes = 0;
    if (currentHour > expectedHour || (currentHour === expectedHour && currentMinute > expectedMinute)) {
      lateMinutes = (currentHour - expectedHour) * 60 + (currentMinute - expectedMinute);
    }

    const [record] = await db
      .insert(attendanceRecordsTable)
      .values({
        employeeId: targetEmployeeId,
        date: todayStr,
        clockIn: now,
        status: lateMinutes > 15 ? "late" : "present",
        lateMinutes,
        location: location || "NISIT HQ Port Moresby",
        notes,
        source: "portal_clock_in",
      })
      .returning();

    // Update master employee live attendance status
    const liveStatus = lateMinutes > 15 ? "late" : "present";
    await db
      .update(employeesTable)
      .set({ liveAttendanceStatus: liveStatus, lastClockInAt: now, updatedAt: now })
      .where(eq(employeesTable.id, targetEmployeeId));

    res.status(201).json(record);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to clock in");
    res.status(500).json({ error: "Failed to clock in", message: error?.message });
  }
});

// POST /api/attendance/clock-out - Clock out for employee
router.post("/attendance/clock-out", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, notes } = req.body;
    const requestedEmployeeId = employeeId ? parseInt(employeeId) : null;
    const ownEmployeeId = await currentEmployeeId(req);
    const targetEmployeeId = requestedEmployeeId ?? ownEmployeeId;

    if (!targetEmployeeId) {
      res.status(403).json({ error: "No active employee profile is linked to this account. Daily attendance tracking is reserved for registered NISIT staff members." });
      return;
    }
    if (requestedEmployeeId && requestedEmployeeId !== ownEmployeeId && !await canManageEmployee(req, requestedEmployeeId)) {
      res.status(403).json({ error: "Forbidden: You do not have permission to clock out for this employee." });
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const existing = await db
      .select()
      .from(attendanceRecordsTable)
      .where(and(eq(attendanceRecordsTable.employeeId, targetEmployeeId), eq(attendanceRecordsTable.date, todayStr)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "No clock-in record found for today" });
      return;
    }

    const now = new Date();
    const updateValues: Record<string, any> = {
      clockOut: now,
      updatedAt: now,
    };
    if (notes) {
      const existingNotes = existing[0].notes || "";
      updateValues.notes = existingNotes ? `${existingNotes} | Out: ${notes}` : `Out: ${notes}`;
    }

    const [updated] = await db
      .update(attendanceRecordsTable)
      .set(updateValues)
      .where(eq(attendanceRecordsTable.id, existing[0].id))
      .returning();

    // Update master employee live attendance status
    await db
      .update(employeesTable)
      .set({ liveAttendanceStatus: "out_of_office", lastClockOutAt: now, updatedAt: now })
      .where(eq(employeesTable.id, targetEmployeeId));

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to clock out");
    res.status(500).json({ error: "Failed to clock out", message: error?.message });
  }
});

// POST /api/attendance/manual - Manual entry (HR/Admin)
router.post("/attendance/manual", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { employeeId, date, clockIn, clockOut, status, location, notes } = req.body;

    if (!employeeId || !date) {
      res.status(400).json({ error: "Employee ID and date are required" });
      return;
    }
    if (!await canManageEmployee(req, parseInt(employeeId))) { res.status(403).json({ error: "Forbidden: cannot create attendance for this employee" }); return; }

    const [record] = await db
      .insert(attendanceRecordsTable)
      .values({
        employeeId: parseInt(employeeId),
        date,
        clockIn: clockIn ? new Date(clockIn) : null,
        clockOut: clockOut ? new Date(clockOut) : null,
        status: status || "present",
        location: location || "NISIT HQ Port Moresby",
        source: "manual",
        notes,
      })
      .returning();

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to create manual attendance record" });
  }
});

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// GET /api/attendance/geofences - List authorized geofence zones
router.get("/attendance/geofences", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const zones = await db
      .select()
      .from(geofenceZonesTable)
      .where(eq(geofenceZonesTable.isActive, "true"));
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch geofence zones" });
  }
});

// POST /api/attendance/mobile-punch - Smart mobile GPS punch with geofence validation
router.post("/attendance/mobile-punch", authMiddleware, async (req, res): Promise<void> => {
  try {
    const ownEmployeeId = await currentEmployeeId(req);
    if (!ownEmployeeId) {
      res.status(403).json({ error: "No active employee profile linked to account." });
      return;
    }

    const { punchType, latitude, longitude, accuracyMeters, verificationMethod, photoBase64, notes } = req.body;
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lonNum)) {
      res.status(400).json({ error: "Valid GPS coordinates (latitude, longitude) are required." });
      return;
    }

    // Match against active geofence zones
    const zones = await db.select().from(geofenceZonesTable).where(eq(geofenceZonesTable.isActive, "true"));
    let matchedZone: any = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const zLat = parseFloat(zone.latitude);
      const zLon = parseFloat(zone.longitude);
      const dist = calculateDistanceMeters(latNum, lonNum, zLat, zLon);
      if (dist < minDistance) {
        minDistance = dist;
      }
      if (dist <= zone.radiusMeters) {
        matchedZone = zone;
        break;
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const locationName = matchedZone ? matchedZone.name : `Field Location (${minDistance}m from nearest base)`;

    if (punchType === "out") {
      const existing = await db
        .select()
        .from(attendanceRecordsTable)
        .where(and(eq(attendanceRecordsTable.employeeId, ownEmployeeId), eq(attendanceRecordsTable.date, todayStr)))
        .limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: "No clock-in record found for today to clock out from." });
        return;
      }

      // Calculate overtime if leaving after 16:30
      const hour = now.getHours();
      const min = now.getMinutes();
      let overtimeMinutes = 0;
      if (hour > 16 || (hour === 16 && min > 30)) {
        overtimeMinutes = (hour - 16) * 60 + (min - 30);
      }

      const updateValues: Record<string, any> = {
        clockOut: now,
        punchOutLatitude: latitude ? latitude.toString() : null,
        punchOutLongitude: longitude ? longitude.toString() : null,
        punchOutAccuracy: accuracyMeters ? accuracyMeters.toString() : null,
        overtimeMinutes,
        overtimeStatus: overtimeMinutes > 30 ? "pending_approval" : "none",
        updatedAt: now,
      };
      if (notes) {
        const existingNotes = existing[0].notes || "";
        updateValues.notes = existingNotes ? `${existingNotes} | Out: ${notes}` : `Out: ${notes}`;
      }

      const [updated] = await db
        .update(attendanceRecordsTable)
        .set(updateValues)
        .where(eq(attendanceRecordsTable.id, existing[0].id))
        .returning();

      // Update master employee record
      await db
        .update(employeesTable)
        .set({
          liveAttendanceStatus: "out_of_office",
          lastClockOutAt: now,
          updatedAt: now,
        })
        .where(eq(employeesTable.id, ownEmployeeId));

      res.json({
        success: true,
        punchType: "out",
        attendanceRecord: updated,
        matchedGeofence: matchedZone ? matchedZone.name : null,
        distanceFromZoneMeters: minDistance,
        masterStaffStatus: "out_of_office",
      });
      return;
    }

    // Punch IN
    const existing = await db
      .select()
      .from(attendanceRecordsTable)
      .where(and(eq(attendanceRecordsTable.employeeId, ownEmployeeId), eq(attendanceRecordsTable.date, todayStr)))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "Already clocked in for today", record: existing[0] });
      return;
    }

    const expectedHour = 8;
    const expectedMinute = 0;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    let lateMinutes = 0;
    if (currentHour > expectedHour || (currentHour === expectedHour && currentMinute > expectedMinute)) {
      lateMinutes = (currentHour - expectedHour) * 60 + (currentMinute - expectedMinute);
    }

    const [record] = await db
      .insert(attendanceRecordsTable)
      .values({
        employeeId: ownEmployeeId,
        date: todayStr,
        clockIn: now,
        status: lateMinutes > 15 ? "late" : "present",
        lateMinutes,
        location: locationName,
        source: "mobile_gps",
        geofenceZoneId: matchedZone ? matchedZone.id : null,
        punchInLatitude: latitude ? latitude.toString() : null,
        punchInLongitude: longitude ? longitude.toString() : null,
        punchInAccuracy: accuracyMeters ? accuracyMeters.toString() : null,
        verificationMethod: verificationMethod || (matchedZone ? "mobile_gps" : "field_duty"),
        selfPhotoUrl: photoBase64 ? "stored_selfie_proof" : null,
        notes: notes || "Mobile GPS Punch",
      })
      .returning();

    // Update master employee record live status
    const liveStatus = matchedZone ? (lateMinutes > 15 ? "late" : "present") : "in_field";
    await db
      .update(employeesTable)
      .set({
        liveAttendanceStatus: liveStatus,
        lastClockInAt: now,
        updatedAt: now,
      })
      .where(eq(employeesTable.id, ownEmployeeId));

    res.status(201).json({
      success: true,
      punchType: "in",
      attendanceRecord: record,
      matchedGeofence: matchedZone ? matchedZone.name : null,
      distanceFromZoneMeters: minDistance,
      isInsideGeofence: !!matchedZone,
      masterStaffStatus: liveStatus,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to process mobile punch");
    res.status(500).json({ error: "Failed to process mobile punch", message: error?.message });
  }
});

// GET /api/clocking/kiosk/token - Dynamic rotating TOTP token for office lobby kiosk
router.get("/clocking/kiosk/token", async (req, res): Promise<void> => {
  const kioskId = (req.query.kiosk_id as string) || "NISIT-HQ-KIOSK-01";
  const timestamp = Math.floor(Date.now() / 15000); // 15 second window
  const token = `NISIT_TOTP_${kioskId}_${timestamp}`;
  res.json({
    kioskId,
    token,
    expiresInSeconds: 15 - (Math.floor(Date.now() / 1000) % 15),
  });
});

// POST /api/clocking/kiosk/scan - Process staff scan at tablet kiosk
router.post("/clocking/kiosk/scan", authMiddleware, async (req, res): Promise<void> => {
  try {
    const ownEmployeeId = await currentEmployeeId(req);
    let targetEmployeeId = ownEmployeeId;
    let targetEmployeeName = "";

    if (req.body.employeeIdentifier || req.body.badgeNumber) {
      const identifier = String(req.body.employeeIdentifier || req.body.badgeNumber).trim();
      const rawNum = identifier.replace(/\D/g, "");
      const numId = rawNum ? parseInt(rawNum, 10) : parseInt(identifier, 10);
      const [matched] = await db
        .select({ id: employeesTable.id, name: employeesTable.name })
        .from(employeesTable)
        .where(
          or(
            sql`LOWER(TRIM(${employeesTable.employeeNumber})) = ${identifier.toLowerCase()}`,
            sql`LOWER(TRIM(${employeesTable.nationalId})) = ${identifier.toLowerCase()}`,
            isNaN(numId) ? sql`1=0` : eq(employeesTable.id, numId)
          )
        )
        .limit(1);

      if (matched) {
        targetEmployeeId = matched.id;
        targetEmployeeName = matched.name;
      } else {
        res.status(404).json({ error: `No registered employee matches badge/ID "${identifier}"` });
        return;
      }
    } else {
      if (!ownEmployeeId) {
        res.status(403).json({ error: "No employee profile linked to user" });
        return;
      }
      targetEmployeeId = ownEmployeeId;
      const [emp] = await db
        .select({ id: employeesTable.id, name: employeesTable.name })
        .from(employeesTable)
        .where(eq(employeesTable.id, ownEmployeeId))
        .limit(1);
      targetEmployeeName = emp?.name || `Employee #${ownEmployeeId}`;
    }

    if (!targetEmployeeId) {
      res.status(400).json({ error: "No target employee specified" });
      return;
    }

    const { token, kioskLocation } = req.body;
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Determine In or Out
    const existing = await db
      .select()
      .from(attendanceRecordsTable)
      .where(and(eq(attendanceRecordsTable.employeeId, targetEmployeeId), eq(attendanceRecordsTable.date, todayStr)))
      .limit(1);

    if (existing.length === 0) {
      // Clock IN
      const expectedHour = 8;
      const expectedMinute = 0;
      let lateMinutes = 0;
      if (now.getHours() > expectedHour || (now.getHours() === expectedHour && now.getMinutes() > expectedMinute)) {
        lateMinutes = (now.getHours() - expectedHour) * 60 + (now.getMinutes() - expectedMinute);
      }

      const [record] = await db
        .insert(attendanceRecordsTable)
        .values({
          employeeId: targetEmployeeId,
          date: todayStr,
          clockIn: now,
          status: lateMinutes > 15 ? "late" : "present",
          lateMinutes,
          location: kioskLocation || "NISIT HQ Main Lobby Kiosk",
          source: "qr_kiosk",
          verificationMethod: "qr_kiosk",
        })
        .returning();

      await db
        .update(employeesTable)
        .set({ liveAttendanceStatus: lateMinutes > 15 ? "late" : "present", lastClockInAt: now })
        .where(eq(employeesTable.id, targetEmployeeId));

      res.status(201).json({
        success: true,
        action: "clock_in",
        record,
        employeeId: targetEmployeeId,
        employeeName: targetEmployeeName,
        message: `Clock-In confirmed for ${targetEmployeeName}`
      });
    } else {
      // Clock OUT
      const [updated] = await db
        .update(attendanceRecordsTable)
        .set({ clockOut: now, updatedAt: now })
        .where(eq(attendanceRecordsTable.id, existing[0].id))
        .returning();

      await db
        .update(employeesTable)
        .set({ liveAttendanceStatus: "out_of_office", lastClockOutAt: now })
        .where(eq(employeesTable.id, targetEmployeeId));

      res.json({
        success: true,
        action: "clock_out",
        record: updated,
        employeeId: targetEmployeeId,
        employeeName: targetEmployeeName,
        message: `Clock-Out confirmed for ${targetEmployeeName}`
      });
    }
  } catch (error: any) {
    logger.error({ err: error }, "Failed to process kiosk scan");
    res.status(500).json({ error: "Failed to process kiosk scan", message: error?.message });
  }
});

// GET /api/attendance/live-presence - Real-time presence board for all staff
router.get("/attendance/live-presence", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const employees = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        employeeNumber: employeesTable.employeeNumber,
        departmentId: employeesTable.departmentId,
        division: employeesTable.division,
        liveAttendanceStatus: employeesTable.liveAttendanceStatus,
        lastClockInAt: employeesTable.lastClockInAt,
        lastClockOutAt: employeesTable.lastClockOutAt,
        punctualityScore: employeesTable.punctualityScore,
      })
      .from(employeesTable)
      .where(eq(employeesTable.status, "active"));

    const todayRecords = await db
      .select()
      .from(attendanceRecordsTable)
      .where(eq(attendanceRecordsTable.date, todayStr));

    const recordMap = new Map<number, any>();
    for (const r of todayRecords) {
      recordMap.set(r.employeeId, r);
    }

    const result = employees.map((emp) => {
      const today = recordMap.get(emp.id);
      return {
        ...emp,
        todayPunch: today ? {
          clockIn: today.clockIn,
          clockOut: today.clockOut,
          status: today.status,
          lateMinutes: today.lateMinutes,
          location: today.location,
          source: today.source,
        } : null,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch live presence board" });
  }
});

// GET /api/attendance/my-stats - Personal attendance metrics for logged-in staff
router.get("/attendance/my-stats", authMiddleware, async (req, res): Promise<void> => {
  try {
    const ownEmployeeId = await currentEmployeeId(req);
    if (!ownEmployeeId) {
      res.status(403).json({ error: "No employee profile linked to user" });
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const firstDayOfMonth = todayStr.substring(0, 7) + "-01";

    const records = await db
      .select()
      .from(attendanceRecordsTable)
      .where(
        and(
          eq(attendanceRecordsTable.employeeId, ownEmployeeId),
          gte(attendanceRecordsTable.date, firstDayOfMonth),
        ),
      );

    const totalDaysPresent = records.filter((r) => r.status === "present" || r.status === "late").length;
    const totalLateDays = records.filter((r) => r.status === "late").length;
    const totalLateMinutes = records.reduce((acc, r) => acc + (r.lateMinutes || 0), 0);
    const punctualityRate = totalDaysPresent > 0 ? Math.round(((totalDaysPresent - totalLateDays) / totalDaysPresent) * 100) : 100;

    res.json({
      employeeId: ownEmployeeId,
      month: todayStr.substring(0, 7),
      totalDaysPresent,
      totalLateDays,
      totalLateMinutes,
      punctualityRate,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch personal attendance stats" });
  }
});

export default router;
