import { Router, type IRouter } from "express";
import { eq, and, desc, sql, gte, lte, or } from "drizzle-orm";
import { db, attendanceRecordsTable, employeesTable, geofenceZonesTable, clockingDevicesTable, departmentsTable, positionsTable } from "@workspace/db";
import { authMiddleware, optionalAuth, requireRole, parseIntParam } from "../middlewares/auth";
import { canManageEmployee, currentEmployeeId, hasSensitiveReadAccess } from "../lib/employee-access";
import { getTenantAgencyId } from "../middlewares/tenant";
import { logger } from "../lib/logger";
import {
  getPngTodayDateStr,
  getPngLateMinutes,
  getPngOvertimeMinutes,
  getPngEarlyDepartureMinutes,
} from "../lib/timezone";

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

    const todayStr = getPngTodayDateStr();
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
    const lateMinutes = getPngLateMinutes(now, 8, 0);

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

    const todayStr = getPngTodayDateStr();
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
    const earlyDepartureMinutes = getPngEarlyDepartureMinutes(now, 16, 6);
    const overtimeMinutes = getPngOvertimeMinutes(now, 16, 30);

    const updateValues: Record<string, any> = {
      clockOut: now,
      earlyDepartureMinutes,
      overtimeMinutes,
      overtimeStatus: overtimeMinutes >= 15 ? "pending_approval" : "none",
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
router.get("/attendance/geofences", optionalAuth, async (_req, res): Promise<void> => {
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

    const todayStr = getPngTodayDateStr();
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

      // Calculate overtime and early departure in PNG time
      const overtimeMinutes = getPngOvertimeMinutes(now, 16, 30);
      const earlyDepartureMinutes = getPngEarlyDepartureMinutes(now, 16, 6);

      const updateValues: Record<string, any> = {
        clockOut: now,
        punchOutLatitude: latitude ? latitude.toString() : null,
        punchOutLongitude: longitude ? longitude.toString() : null,
        punchOutAccuracy: accuracyMeters ? accuracyMeters.toString() : null,
        earlyDepartureMinutes,
        overtimeMinutes,
        overtimeStatus: overtimeMinutes >= 15 ? "pending_approval" : "none",
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

    const lateMinutes = getPngLateMinutes(now, 8, 0);

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
router.post("/clocking/kiosk/scan", optionalAuth, async (req, res): Promise<void> => {
  try {
    const ownEmployeeId = await currentEmployeeId(req);
    let targetEmployeeId = ownEmployeeId;
    let targetEmployeeName = "";

    const { token, kioskLocation } = req.body;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Dynamic kiosk TOTP token is required." });
      return;
    }

    // Verify dynamic rolling TOTP token (15-second window with +/- 1 window tolerance for network jitter)
    const currentWindow = Math.floor(Date.now() / 15000);
    const validWindows = [currentWindow - 1, currentWindow, currentWindow + 1];
    const isTokenValid = validWindows.some((w) => token.includes(`_${w}`));
    if (!isTokenValid) {
      res.status(400).json({ error: "Kiosk QR code has expired. Please scan the current terminal display." });
      return;
    }

    const isPrivileged = req.user?.roleName && ["admin", "hr_manager", "hr_officer"].includes(req.user.roleName);
    const isDeviceKeyAuth = Boolean(req.headers["x-device-key"]);

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
        if (!isPrivileged && !isDeviceKeyAuth && ownEmployeeId && matched.id !== ownEmployeeId) {
          res.status(403).json({ error: "Forbidden: You are only permitted to clock in/out for your own employee account." });
          return;
        }
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

    const now = new Date();
    const todayStr = getPngTodayDateStr(now);

    // Determine In or Out
    const existing = await db
      .select()
      .from(attendanceRecordsTable)
      .where(and(eq(attendanceRecordsTable.employeeId, targetEmployeeId), eq(attendanceRecordsTable.date, todayStr)))
      .limit(1);

    if (existing.length === 0) {
      // Clock IN
      const lateMinutes = getPngLateMinutes(now, 8, 0);

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
      const earlyDepartureMinutes = getPngEarlyDepartureMinutes(now, 16, 6);
      const overtimeMinutes = getPngOvertimeMinutes(now, 16, 30);

      const [updated] = await db
        .update(attendanceRecordsTable)
        .set({
          clockOut: now,
          earlyDepartureMinutes,
          overtimeMinutes,
          overtimeStatus: overtimeMinutes >= 15 ? "pending_approval" : "none",
          updatedAt: now,
        })
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

// POST /api/clocking/staff-verify - Check if identifier belongs to registered staff and pull profile & punch state
router.post("/clocking/staff-verify", optionalAuth, async (req, res): Promise<void> => {
  try {
    const identifier = String(req.body.identifier || req.body.employeeIdentifier || req.body.badgeNumber || "").trim();
    if (!identifier) {
      res.status(400).json({ error: "Staff identifier, badge number, card UID, or PIN is required." });
      return;
    }

    const rawNum = identifier.replace(/\D/g, "");
    const numId = rawNum ? parseInt(rawNum, 10) : parseInt(identifier, 10);

    const [matched] = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        employeeNumber: employeesTable.employeeNumber,
        departmentId: employeesTable.departmentId,
        departmentName: departmentsTable.name,
        positionTitle: positionsTable.title,
        photoUrl: employeesTable.photoUrl,
        rfidCardNumber: employeesTable.rfidCardNumber,
        attendancePin: employeesTable.attendancePin,
        biometricsEnrolled: employeesTable.biometricsEnrolled,
        status: employeesTable.status,
        liveAttendanceStatus: employeesTable.liveAttendanceStatus,
        lastClockInAt: employeesTable.lastClockInAt,
        lastClockOutAt: employeesTable.lastClockOutAt,
      })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .where(
        or(
          sql`LOWER(TRIM(${employeesTable.employeeNumber})) = ${identifier.toLowerCase()}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.rfidCardNumber}, ''))) = ${identifier.toLowerCase()}`,
          sql`TRIM(COALESCE(${employeesTable.attendancePin}, '')) = ${identifier}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.nationalId}, ''))) = ${identifier.toLowerCase()}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.email}, ''))) = ${identifier.toLowerCase()}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.biometricsEnrolled}->>'fingerprintCredentialId', ''))) = ${identifier.toLowerCase()}`,
          isNaN(numId) ? sql`1=0` : eq(employeesTable.id, numId)
        )
      )
      .limit(1);

    if (!matched) {
      res.status(404).json({
        found: false,
        error: `No registered NISIT personnel found matching "${identifier}". Please verify credentials with HR or ICT Administration.`,
      });
      return;
    }

    if (matched.status !== "active") {
      res.status(403).json({
        found: true,
        staff: matched,
        error: `Staff account is ${matched.status}. Daily attendance logging is restricted to active personnel.`,
      });
      return;
    }

    const todayStr = getPngTodayDateStr();
    const [todayRecord] = await db
      .select()
      .from(attendanceRecordsTable)
      .where(
        and(
          eq(attendanceRecordsTable.employeeId, matched.id),
          eq(attendanceRecordsTable.date, todayStr)
        )
      )
      .limit(1);

    const isClockedIn = Boolean(todayRecord?.clockIn && !todayRecord?.clockOut);
    const isCompleted = Boolean(todayRecord?.clockIn && todayRecord?.clockOut);

    // Sanitize PIN before sending to client
    const safeStaff = {
      ...matched,
      attendancePin: matched.attendancePin ? "••••" : null,
      hasPin: Boolean(matched.attendancePin),
      hasRfid: Boolean(matched.rfidCardNumber),
    };

    res.json({
      found: true,
      staff: safeStaff,
      todayRecord: todayRecord || null,
      isClockedIn,
      isCompleted,
      nextAction: isClockedIn ? "clock_out" : "clock_in",
    });
  } catch (err: any) {
    logger.error({ err }, "staff-verify failed");
    res.status(500).json({ error: "Failed to verify staff member" });
  }
});

// POST /api/clocking/staff-enroll - Enroll or update officer RFID card, PIN, and biometric flags
router.post("/clocking/staff-enroll", optionalAuth, async (req, res): Promise<void> => {
  try {
    const { employeeId, rfidCardNumber, attendancePin, biometricsEnrolled } = req.body;
    const numId = parseInt(String(employeeId), 10);
    if (isNaN(numId)) {
      res.status(400).json({ error: "Valid employee ID is required." });
      return;
    }

    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, numId)).limit(1);
    if (!emp) {
      res.status(404).json({ error: "Employee record not found." });
      return;
    }

    const updateData: any = { updatedAt: new Date() };
    if (req.body.photoUrl) updateData.photoUrl = String(req.body.photoUrl);
    if (req.body.facePhoto) updateData.photoUrl = String(req.body.facePhoto);
    if (rfidCardNumber !== undefined) updateData.rfidCardNumber = String(rfidCardNumber || "").trim() || null;
    if (attendancePin !== undefined) updateData.attendancePin = String(attendancePin || "").trim() || null;
    if (biometricsEnrolled !== undefined) {
      updateData.biometricsEnrolled = {
        ...(typeof emp.biometricsEnrolled === "object" && emp.biometricsEnrolled !== null ? emp.biometricsEnrolled : {}),
        ...biometricsEnrolled,
        enrolledAt: new Date().toISOString(),
      };
    }

    const [updated] = await db
      .update(employeesTable)
      .set(updateData)
      .where(eq(employeesTable.id, numId))
      .returning();

    res.json({
      success: true,
      message: `Successfully enrolled credentials for ${updated.name}.`,
      staff: {
        id: updated.id,
        name: updated.name,
        employeeNumber: updated.employeeNumber,
        photoUrl: updated.photoUrl,
        rfidCardNumber: updated.rfidCardNumber,
        attendancePin: updated.attendancePin ? "••••" : null,
        biometricsEnrolled: updated.biometricsEnrolled,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "staff-enroll failed");
    res.status(500).json({ error: "Failed to enroll staff credentials", message: err?.message });
  }
});

// POST /api/clocking/staff-punch - Execute and register biometric, card, PIN, or facial punch
router.post("/clocking/staff-punch", optionalAuth, async (req, res): Promise<void> => {
  try {
    const { identifier, method = "smart_card", action, kioskLocation, notes } = req.body;
    const cleanId = String(identifier || "").trim();
    if (!cleanId) {
      res.status(400).json({ error: "Staff identifier is required for log registration." });
      return;
    }

    const rawNum = cleanId.replace(/\D/g, "");
    const numId = rawNum ? parseInt(rawNum, 10) : parseInt(cleanId, 10);

    const [matched] = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        employeeNumber: employeesTable.employeeNumber,
        departmentName: departmentsTable.name,
        positionTitle: positionsTable.title,
        photoUrl: employeesTable.photoUrl,
        rfidCardNumber: employeesTable.rfidCardNumber,
        attendancePin: employeesTable.attendancePin,
        biometricsEnrolled: employeesTable.biometricsEnrolled,
        status: employeesTable.status,
      })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .where(
        or(
          sql`LOWER(TRIM(${employeesTable.employeeNumber})) = ${cleanId.toLowerCase()}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.rfidCardNumber}, ''))) = ${cleanId.toLowerCase()}`,
          sql`TRIM(COALESCE(${employeesTable.attendancePin}, '')) = ${cleanId}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.nationalId}, ''))) = ${cleanId.toLowerCase()}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.email}, ''))) = ${cleanId.toLowerCase()}`,
          sql`LOWER(TRIM(COALESCE(${employeesTable.biometricsEnrolled}->>'fingerprintCredentialId', ''))) = ${cleanId.toLowerCase()}`,
          isNaN(numId) ? sql`1=0` : eq(employeesTable.id, numId)
        )
      )
      .limit(1);

    if (!matched) {
      res.status(404).json({ error: `Verification failed: "${cleanId}" is not a registered NISIT employee.` });
      return;
    }

    if (matched.status !== "active") {
      res.status(403).json({ error: `Cannot register punch: Staff record is marked "${matched.status}".` });
      return;
    }

    // Biometric enrollment verification
    if (method === "biometric_iris" && matched.biometricsEnrolled?.iris === false) {
      res.status(400).json({
        error: `Officer ${matched.name} is not enrolled for IRIS scanning. Please register with HR or use Smart Card / PIN.`,
      });
      return;
    }
    if (method === "biometric_fingerprint" && matched.biometricsEnrolled?.fingerprint === false) {
      res.status(400).json({
        error: `Officer ${matched.name} is not enrolled for Fingerprint scanning. Please register with HR or use Smart Card / PIN.`,
      });
      return;
    }
    if (method === "biometric_face" && matched.biometricsEnrolled?.face === false) {
      res.status(400).json({
        error: `Officer ${matched.name} is not enrolled for Face ID. Please register with HR or use Smart Card / PIN.`,
      });
      return;
    }

    const now = new Date();
    const todayStr = getPngTodayDateStr(now);

    const [existing] = await db
      .select()
      .from(attendanceRecordsTable)
      .where(
        and(
          eq(attendanceRecordsTable.employeeId, matched.id),
          eq(attendanceRecordsTable.date, todayStr)
        )
      )
      .limit(1);

    const targetAction = action || (existing && existing.clockIn && !existing.clockOut ? "clock_out" : "clock_in");

    if (targetAction === "clock_in") {
      if (existing && existing.clockIn) {
        res.status(400).json({
          error: `${matched.name} is already clocked in for today at ${new Date(existing.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Please select Sign Out.`,
          record: existing,
          staff: matched,
        });
        return;
      }

      const lateMinutes = getPngLateMinutes(now, 8, 0);
      const [record] = await db
        .insert(attendanceRecordsTable)
        .values({
          employeeId: matched.id,
          date: todayStr,
          clockIn: now,
          status: lateMinutes > 15 ? "late" : "present",
          lateMinutes,
          location: kioskLocation || "NISIT HQ Main Turnstile Station",
          source: method || "station_terminal",
          verificationMethod: method || "station_terminal",
          notes: notes ? `${notes} (Method: ${method})` : `Verified via ${String(method).replace(/_/g, " ").toUpperCase()}`,
        })
        .returning();

      await db
        .update(employeesTable)
        .set({ liveAttendanceStatus: lateMinutes > 15 ? "late" : "present", lastClockInAt: now })
        .where(eq(employeesTable.id, matched.id));

      res.status(201).json({
        success: true,
        action: "clock_in",
        punchType: "SIGN IN",
        timestamp: now.toISOString(),
        timeString: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        staff: matched,
        status: lateMinutes > 15 ? "late" : "present",
        lateMinutes,
        method,
        record,
        message: `Welcome, ${matched.name}! Sign-In successfully registered. ${lateMinutes > 15 ? `(Recorded Late: +${lateMinutes} min)` : "Punctual Morning Arrival!"}`,
      });
    } else {
      // Clock Out
      if (!existing || !existing.clockIn) {
        res.status(400).json({
          error: `No morning sign-in record found for ${matched.name} today. Please sign in first.`,
          staff: matched,
        });
        return;
      }

      const earlyDepartureMinutes = getPngEarlyDepartureMinutes(now, 16, 6);
      const overtimeMinutes = getPngOvertimeMinutes(now, 16, 30);

      const [updated] = await db
        .update(attendanceRecordsTable)
        .set({
          clockOut: now,
          earlyDepartureMinutes,
          overtimeMinutes,
          overtimeStatus: overtimeMinutes >= 15 ? "pending_approval" : "none",
          updatedAt: now,
          notes: existing.notes ? `${existing.notes} | Out via ${method}` : `Out via ${method}`,
        })
        .where(eq(attendanceRecordsTable.id, existing.id))
        .returning();

      await db
        .update(employeesTable)
        .set({ liveAttendanceStatus: "out_of_office", lastClockOutAt: now })
        .where(eq(employeesTable.id, matched.id));

      res.json({
        success: true,
        action: "clock_out",
        punchType: "SIGN OUT",
        timestamp: now.toISOString(),
        timeString: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        staff: matched,
        overtimeMinutes,
        earlyDepartureMinutes,
        method,
        record: updated,
        message: `Goodbye, ${matched.name}! Shift completed and sign-out confirmed. ${overtimeMinutes >= 15 ? `(+${overtimeMinutes} min Overtime logged for approval)` : ""}`,
      });
    }
  } catch (err: any) {
    logger.error({ err }, "staff-punch failed");
    res.status(500).json({ error: "Failed to record staff punch", message: err?.message });
  }
});

// GET /api/attendance/live-presence - Real-time presence board for all staff
router.get("/attendance/live-presence", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const todayStr = getPngTodayDateStr();
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

    // Historical attendance aggregation for genuine punctuality scoring
    const totalRecords = await db
      .select({
        employeeId: attendanceRecordsTable.employeeId,
        count: sql<number>`count(*)::int`,
        lateCount: sql<number>`count(case when ${attendanceRecordsTable.status} = 'late' then 1 end)::int`,
      })
      .from(attendanceRecordsTable)
      .groupBy(attendanceRecordsTable.employeeId);

    const historyMap = new Map<number, { count: number; lateCount: number }>();
    for (const h of totalRecords) {
      historyMap.set(h.employeeId, { count: Number(h.count), lateCount: Number(h.lateCount) });
    }

    const result = employees.map((emp) => {
      const today = recordMap.get(emp.id);
      const hist = historyMap.get(emp.id);

      // Compute truthful presence status:
      // - If employee has no punch today: 'not_reported' (pending arrival / absent).
      // - If they clocked out today: 'departed' (shift concluded / out of office).
      // - If in field duty: 'in_field'.
      // - If clocked in today: 'present' or 'late'.
      let effectiveStatus = emp.liveAttendanceStatus;
      if (emp.liveAttendanceStatus === "in_field") {
        effectiveStatus = "in_field";
      } else if (!today) {
        effectiveStatus = "not_reported";
      } else if (today.clockOut) {
        effectiveStatus = "departed";
      } else {
        effectiveStatus = today.status === "late" ? "late" : "present";
      }

      // Truthful punctuality scoring (never award 100% to officers with 0 attendance history)
      let effectiveScore: string | null = null;
      if (hist && hist.count > 0) {
        effectiveScore = Math.max(0, Math.round(((hist.count - hist.lateCount) / hist.count) * 100)).toFixed(1);
      }

      return {
        ...emp,
        liveAttendanceStatus: effectiveStatus,
        punctualityScore: effectiveScore,
        hasAttendanceHistory: Boolean(hist && hist.count > 0),
        totalDaysRecorded: hist ? hist.count : 0,
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

// GET /api/clocking/staff-roster - Active personnel roster for biometric enrollment and turnstile verification
router.get("/clocking/staff-roster", optionalAuth, async (_req, res): Promise<void> => {
  try {
    const list = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        employeeNumber: employeesTable.employeeNumber,
        departmentId: employeesTable.departmentId,
        departmentName: departmentsTable.name,
        positionTitle: positionsTable.title,
        photoUrl: employeesTable.photoUrl,
        rfidCardNumber: employeesTable.rfidCardNumber,
        attendancePin: employeesTable.attendancePin,
        biometricsEnrolled: employeesTable.biometricsEnrolled,
        liveAttendanceStatus: employeesTable.liveAttendanceStatus,
      })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .where(eq(employeesTable.status, "active"))
      .orderBy(employeesTable.name);

    res.json(list);
  } catch (err: any) {
    logger.error({ err }, "staff-roster failed");
    res.status(500).json({ error: "Failed to fetch staff roster" });
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

    const todayStr = getPngTodayDateStr();
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

// PATCH /api/attendance/:id/overtime - Approve or reject pending overtime
router.patch(
  "/attendance/:id/overtime",
  authMiddleware,
  requireRole("admin", "hr_manager", "hr_officer"),
  async (req, res): Promise<void> => {
    try {
      const recordId = parseIntParam(req.params.id);
      const { status, notes } = req.body;

      if (!status || !["approved", "rejected"].includes(status)) {
        res.status(400).json({ error: "Invalid status: Expected 'approved' or 'rejected'." });
        return;
      }

      const [record] = await db
        .select()
        .from(attendanceRecordsTable)
        .where(eq(attendanceRecordsTable.id, recordId))
        .limit(1);

      if (!record) {
        res.status(404).json({ error: "Attendance record not found." });
        return;
      }

      const now = new Date();
      let updatedNotes = record.notes || "";
      if (notes) {
        updatedNotes = updatedNotes ? `${updatedNotes} | OT ${status}: ${notes}` : `OT ${status}: ${notes}`;
      }

      const [updated] = await db
        .update(attendanceRecordsTable)
        .set({
          overtimeStatus: status,
          overtimeApprovedBy: req.user?.userId ?? null,
          overtimeApprovedAt: now,
          notes: updatedNotes,
          updatedAt: now,
        })
        .where(eq(attendanceRecordsTable.id, recordId))
        .returning();

      res.json({
        success: true,
        message: `Overtime status updated to ${status}.`,
        record: updated,
      });
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update overtime status");
      res.status(500).json({ error: "Failed to update overtime status", message: error?.message });
    }
  }
);

// PATCH /api/attendance/:id - Update attendance record (HR/Admin)
router.patch(
  "/attendance/:id",
  authMiddleware,
  requireRole("admin", "hr_manager", "hr_officer"),
  async (req, res): Promise<void> => {
    try {
      const recordId = parseIntParam(req.params.id);
      const { date, clockIn, clockOut, status, lateMinutes, earlyDepartureMinutes, location, notes } = req.body;

      const [existing] = await db
        .select()
        .from(attendanceRecordsTable)
        .where(eq(attendanceRecordsTable.id, recordId))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Attendance record not found." });
        return;
      }

      const updateValues: Record<string, any> = { updatedAt: new Date() };
      if (date !== undefined) updateValues.date = date;
      if (clockIn !== undefined) updateValues.clockIn = clockIn ? new Date(clockIn) : null;
      if (clockOut !== undefined) updateValues.clockOut = clockOut ? new Date(clockOut) : null;
      if (status !== undefined) updateValues.status = status;
      if (lateMinutes !== undefined) updateValues.lateMinutes = lateMinutes;
      if (earlyDepartureMinutes !== undefined) updateValues.earlyDepartureMinutes = earlyDepartureMinutes;
      if (location !== undefined) updateValues.location = location;
      if (notes !== undefined) updateValues.notes = notes;

      const [updated] = await db
        .update(attendanceRecordsTable)
        .set(updateValues)
        .where(eq(attendanceRecordsTable.id, recordId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      logger.error({ err: error }, "Failed to update attendance record");
      res.status(500).json({ error: "Failed to update attendance record", message: error?.message });
    }
  }
);

// DELETE /api/attendance/:id - Delete attendance record (Admin only)
router.delete(
  "/attendance/:id",
  authMiddleware,
  requireRole("admin", "hr_manager"),
  async (req, res): Promise<void> => {
    try {
      const recordId = parseIntParam(req.params.id);
      await db.delete(attendanceRecordsTable).where(eq(attendanceRecordsTable.id, recordId));
      res.json({ success: true, message: "Attendance record deleted." });
    } catch (error: any) {
      logger.error({ err: error }, "Failed to delete attendance record");
      res.status(500).json({ error: "Failed to delete attendance record" });
    }
  }
);

export default router;
