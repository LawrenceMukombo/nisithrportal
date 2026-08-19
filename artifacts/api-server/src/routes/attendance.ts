import { Router, type IRouter } from "express";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db, attendanceRecordsTable, employeesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";

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
    let targetEmployeeId = employeeId ? parseInt(employeeId) : undefined;

    if (!targetEmployeeId) {
      const allEmps = await db.select().from(employeesTable).limit(1);
      if (allEmps.length > 0) targetEmployeeId = allEmps[0].id;
    }

    if (!targetEmployeeId) {
      res.status(400).json({ error: "Employee profile required for clock-in" });
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
        source: "web",
        notes,
      })
      .returning();

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// POST /api/attendance/clock-out - Clock out for employee
router.post("/attendance/clock-out", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, notes } = req.body;
    let targetEmployeeId = employeeId ? parseInt(employeeId) : undefined;

    if (!targetEmployeeId) {
      const allEmps = await db.select().from(employeesTable).limit(1);
      if (allEmps.length > 0) targetEmployeeId = allEmps[0].id;
    }

    if (!targetEmployeeId) {
      res.status(400).json({ error: "Employee profile required" });
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
    const [updated] = await db
      .update(attendanceRecordsTable)
      .set({
        clockOut: now,
        notes: notes ? sql`CONCAT(COALESCE(notes, ''), ' ', ${notes})` : attendanceRecordsTable.notes,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecordsTable.id, existing[0].id))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to clock out" });
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

export default router;
