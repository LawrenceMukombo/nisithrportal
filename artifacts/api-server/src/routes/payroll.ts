import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, asc, sql, inArray, or, ilike } from "drizzle-orm";
import {
  db,
  payrollPeriodsTable,
  employeeSalaryProfilesTable,
  payrollItemsTable,
  payrollAdjustmentsTable,
  payrollAuditLogsTable,
  employeesTable,
  departmentsTable,
  positionsTable,
  agenciesTable,
  attendanceRecordsTable,
  usersTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";
import { currentEmployeeId, canReadEmployee } from "../lib/employee-access";
import { logger } from "../lib/logger";
import {
  calculateEmployeePayroll,
  calculatePSTRate,
  generateBankingABAText,
  PNG_PAY_GRADE_SCALES,
  getPayGradeScale,
} from "../lib/payrollEngine";
import { generatePasswordProtectedPayslipPdf } from "../lib/payslipPdf";
import { sendPasswordProtectedPayslipEmail } from "../lib/email";

const router: IRouter = Router();

function getParamId(param: string | string[] | undefined): number {
  if (Array.isArray(param)) return parseInt(param[0], 10);
  return parseInt(String(param || "0"), 10);
}

function formatPayrollItem(row: any) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    periodId: row.period_id ?? row.periodId,
    employeeId: row.employee_id ?? row.employeeId,
    payslipNumber: row.payslip_number ?? row.payslipNumber,
    baseSalary: String(row.base_salary ?? row.baseSalary ?? "0"),
    regularHoursWorked: String(row.regular_hours_worked ?? row.regularHoursWorked ?? "80.00"),
    overtimeHours15: String(row.overtime_hours_15 ?? row.overtimeHours15 ?? "0"),
    overtimeHours20: String(row.overtime_hours_20 ?? row.overtimeHours20 ?? "0"),
    overtimePay: String(row.overtime_pay ?? row.overtimePay ?? "0"),
    allowancesBreakdown: row.allowances_breakdown ?? row.allowancesBreakdown ?? {},
    totalAllowances: String(row.total_allowances ?? row.totalAllowances ?? "0"),
    grossPay: String(row.gross_pay ?? row.grossPay ?? "0"),
    taxableIncome: String(row.taxable_income ?? row.taxableIncome ?? "0"),
    ircTax: String(row.irc_tax ?? row.ircTax ?? "0"),
    superannuationEmployee: String(row.superannuation_employee ?? row.superannuationEmployee ?? "0"),
    superannuationEmployer: String(row.superannuation_employer ?? row.superannuationEmployer ?? "0"),
    deductionsBreakdown: row.deductions_breakdown ?? row.deductionsBreakdown ?? {},
    totalDeductions: String(row.total_deductions ?? row.totalDeductions ?? "0"),
    netPay: String(row.net_pay ?? row.netPay ?? "0"),
    currency: row.currency ?? "PGK",
    paymentStatus: row.payment_status ?? row.paymentStatus ?? "pending",
    paymentMethod: row.payment_method ?? row.paymentMethod ?? "bank_transfer",
    bankName: row.bank_name ?? row.bankName,
    bankAccountNumber: row.bank_account_number ?? row.bankAccountNumber,
    attendanceDaysPresent: row.attendance_days_present ?? row.attendanceDaysPresent,
    leaveDaysTaken: row.leave_days_taken ?? row.leaveDaysTaken,
    unpaidLeaveDays: row.unpaid_leave_days ?? row.unpaidLeaveDays,
    unpaidLeaveDeduction: row.unpaid_leave_deduction ?? row.unpaidLeaveDeduction,
    notes: row.notes,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    employeeName: row.employee_name ?? row.employeeName,
    employeeNumber: row.employee_number ?? row.employeeNumber,
    gradeLevel: row.grade_level ?? row.gradeLevel,
    departmentName: row.department_name ?? row.departmentName,
    positionTitle: row.position_title ?? row.positionTitle,
    tin: row.tin,
    superFund: row.super_fund ?? row.superFund,
    superMemberNumber: row.super_member_number ?? row.superMemberNumber,
    periodCode: row.period_code ?? row.periodCode,
    periodName: row.period_name ?? row.periodName,
    payDate: row.pay_date ?? row.payDate,
    periodStartDate: row.period_start_date ?? row.periodStartDate,
    periodEndDate: row.period_end_date ?? row.periodEndDate,
    bankBranch: row.bank_branch ?? row.bankBranch,
    emailDeliveryStatus: row.email_delivery_status ?? row.emailDeliveryStatus ?? "not_sent",
    emailSentTo: row.email_sent_to ?? row.emailSentTo,
    emailSentAt: row.email_sent_at ?? row.emailSentAt,
    emailDeliveryError: row.email_delivery_error ?? row.emailDeliveryError,
    privateEmail: row.private_email ?? row.privateEmail,
    dateOfBirth: row.date_of_birth ?? row.dateOfBirth,
  };
}

function formatSalaryProfile(row: any) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    employeeId: row.employee_id ?? row.employeeId,
    employeeName: row.employee_name ?? row.employeeName,
    employeeNumber: row.employee_number ?? row.employeeNumber,
    employeeEmail: row.employee_email ?? row.employeeEmail,
    departmentName: row.department_name ?? row.departmentName,
    positionTitle: row.position_title ?? row.positionTitle,
    gradeLevel: row.grade_level ?? row.gradeLevel,
    annualBaseSalary: String(row.annual_base_salary ?? row.annualBaseSalary ?? "0"),
    fortnightlyBaseSalary: String(row.fortnightly_base_salary ?? row.fortnightlyBaseSalary ?? "0"),
    hourlyRate: String(row.hourly_rate ?? row.hourlyRate ?? "0"),
    payCycle: row.pay_cycle ?? row.payCycle ?? "fortnightly",
    paymentMethod: row.payment_method ?? row.paymentMethod ?? "bank_transfer",
    bankName: row.bank_name ?? row.bankName,
    bankBranch: row.bank_branch ?? row.bankBranch,
    bankAccountNumber: row.bank_account_number ?? row.bankAccountNumber,
    bankAccountName: row.bank_account_name ?? row.bankAccountName,
    tin: row.tin,
    taxCode: row.tax_code ?? row.taxCode ?? "A",
    superFund: row.super_fund ?? row.superFund ?? "Nasfund",
    superMemberNumber: row.super_member_number ?? row.superMemberNumber,
    superVoluntaryRate: String(row.super_voluntary_rate ?? row.superVoluntaryRate ?? "0"),
    superannuationType: row.superannuation_type ?? row.superannuationType ?? "percentage",
    superannuationFixedAmount: String(row.superannuation_fixed_amount ?? row.superannuationFixedAmount ?? "0"),
    housingAllowance: String(row.housing_allowance ?? row.housingAllowance ?? "0"),
    housingAllowanceType: row.housing_allowance_type ?? row.housingAllowanceType ?? "fixed",
    housingAllowanceRate: String(row.housing_allowance_rate ?? row.housingAllowanceRate ?? "0"),
    utilityAllowance: String(row.utility_allowance ?? row.utilityAllowance ?? "0"),
    utilityAllowanceType: row.utility_allowance_type ?? row.utilityAllowanceType ?? "fixed",
    utilityAllowanceRate: String(row.utility_allowance_rate ?? row.utilityAllowanceRate ?? "0"),
    transportAllowance: String(row.transport_allowance ?? row.transportAllowance ?? "0"),
    transportAllowanceType: row.transport_allowance_type ?? row.transportAllowanceType ?? "fixed",
    transportAllowanceRate: String(row.transport_allowance_rate ?? row.transportAllowanceRate ?? "0"),
    representationAllowance: String(row.representation_allowance ?? row.representationAllowance ?? "0"),
    representationAllowanceType: row.representation_allowance_type ?? row.representationAllowanceType ?? "fixed",
    representationAllowanceRate: String(row.representation_allowance_rate ?? row.representationAllowanceRate ?? "0"),
    otherAllowances: String(row.other_allowances ?? row.otherAllowances ?? "0"),
    otherAllowancesType: row.other_allowances_type ?? row.otherAllowancesType ?? "fixed",
    otherAllowancesRate: String(row.other_allowances_rate ?? row.otherAllowancesRate ?? "0"),
    unionDues: String(row.union_dues ?? row.unionDues ?? "0"),
    insuranceDeduction: String(row.insurance_deduction ?? row.insuranceDeduction ?? "0"),
    privateEmail: row.private_email ?? row.privateEmail,
    payslipPasswordPin: row.payslip_password_pin ?? row.payslipPasswordPin,
    payslipPasswordType: row.payslip_password_type ?? row.payslipPasswordType ?? "dob_or_pin",
    isActive: row.is_active ?? row.isActive ?? true,
  };
}

function formatAdjustment(row: any) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    employeeId: row.employee_id ?? row.employeeId,
    employeeName: row.employee_name ?? row.employeeName,
    employeeNumber: row.employee_number ?? row.employeeNumber,
    periodId: row.period_id ?? row.periodId,
    periodCode: row.period_code ?? row.periodCode,
    type: row.type,
    category: row.category,
    amount: String(row.amount ?? "0"),
    taxable: Boolean(row.taxable),
    description: row.description,
    status: row.status,
    requestedByName: row.requested_by_name ?? row.requestedByName,
    createdAt: row.created_at ?? row.createdAt,
  };
}

// ==========================================
// 1. HIGH-LEVEL OVERVIEW & ANALYTICS
// ==========================================
router.get("/payroll/overview", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const agencyId = await getTenantAgencyId(req);

    // Get the most recent / active period
    const [latestPeriod] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(agencyId ? eq(payrollPeriodsTable.agencyId, agencyId) : sql`1=1`)
      .orderBy(desc(payrollPeriodsTable.year), desc(payrollPeriodsTable.periodNumber))
      .limit(1);

    // Get previous period for variance comparison
    let previousPeriod = null;
    if (latestPeriod) {
      const [prev] = await db
        .select()
        .from(payrollPeriodsTable)
        .where(
          and(
            agencyId ? eq(payrollPeriodsTable.agencyId, agencyId) : sql`1=1`,
            sql`${payrollPeriodsTable.id} != ${latestPeriod.id}`
          )
        )
        .orderBy(desc(payrollPeriodsTable.year), desc(payrollPeriodsTable.periodNumber))
        .limit(1);
      previousPeriod = prev || null;
    }

    // YTD Aggregates for current year (2026)
    const ytdResult = await db.execute(sql`
      SELECT 
        COUNT(id)::int as total_runs,
        COALESCE(SUM(total_gross), 0) as ytd_gross,
        COALESCE(SUM(total_irc_tax), 0) as ytd_irc_tax,
        COALESCE(SUM(total_super_employee), 0) as ytd_super_employee,
        COALESCE(SUM(total_super_employer), 0) as ytd_super_employer,
        COALESCE(SUM(total_net), 0) as ytd_net,
        COALESCE(SUM(total_allowances), 0) as ytd_allowances
      FROM payroll_periods
      WHERE year = 2026 ${agencyId ? sql`AND agency_id = ${agencyId}` : sql``}
    `);
    const ytd = (ytdResult.rows[0] as any) || {};

    // Departmental Cost Breakdown for the latest period
    let departmentCosts: any[] = [];
    if (latestPeriod) {
      const deptRes = await db.execute(sql`
        SELECT 
          COALESCE(d.name, 'Unassigned / General') as department_name,
          COUNT(pi.id)::int as employee_count,
          COALESCE(SUM(pi.gross_pay), 0) as gross_pay,
          COALESCE(SUM(pi.net_pay), 0) as net_pay,
          COALESCE(SUM(pi.irc_tax), 0) as irc_tax,
          COALESCE(SUM(pi.superannuation_employee), 0) as super_employee,
          COALESCE(SUM(pi.superannuation_employer), 0) as super_employer,
          COALESCE(SUM(pi.total_allowances), 0) as allowances
        FROM payroll_items pi
        JOIN employees e ON e.id = pi.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE pi.period_id = ${latestPeriod.id}
        GROUP BY d.name
        ORDER BY gross_pay DESC
      `);
      departmentCosts = deptRes.rows as any[];
    }

    // Period History Trends (last 6 pay periods)
    const trendsRes = await db.execute(sql`
      SELECT 
        id, period_code, name, pay_date, status,
        total_gross, total_net, total_irc_tax, total_super_employee, total_super_employer,
        total_allowances, employee_count
      FROM payroll_periods
      WHERE 1=1 ${agencyId ? sql`AND agency_id = ${agencyId}` : sql``}
      ORDER BY year DESC, period_number DESC
      LIMIT 6
    `);
    const trends = (trendsRes.rows as any[]).reverse();

    // Allowance & Deduction breakdown for active period
    let allowanceBreakdown = { housing: 0, utility: 0, transport: 0, representation: 0, other: 0, overtime: 0 };
    if (latestPeriod) {
      const allRes = await db.execute(sql`
        SELECT 
          COALESCE(SUM((allowances_breakdown->>'housing')::numeric), 0) as housing,
          COALESCE(SUM((allowances_breakdown->>'utility')::numeric), 0) as utility,
          COALESCE(SUM((allowances_breakdown->>'transport')::numeric), 0) as transport,
          COALESCE(SUM((allowances_breakdown->>'representation')::numeric), 0) as representation,
          COALESCE(SUM(overtime_pay), 0) as overtime
        FROM payroll_items
        WHERE period_id = ${latestPeriod.id}
      `);
      const row = (allRes.rows[0] as any) || {};
      allowanceBreakdown = {
        housing: Number(row.housing) || 0,
        utility: Number(row.utility) || 0,
        transport: Number(row.transport) || 0,
        representation: Number(row.representation) || 0,
        other: 0,
        overtime: Number(row.overtime) || 0,
      };
    }

    // Calculate variance vs previous
    let varianceGrossPct = 0;
    let varianceNetPct = 0;
    if (latestPeriod && previousPeriod && Number(previousPeriod.totalGross) > 0) {
      const diffGross = Number(latestPeriod.totalGross) - Number(previousPeriod.totalGross);
      varianceGrossPct = Math.round((diffGross / Number(previousPeriod.totalGross)) * 1000) / 10;
      const diffNet = Number(latestPeriod.totalNet) - Number(previousPeriod.totalNet);
      varianceNetPct = Math.round((diffNet / Number(previousPeriod.totalNet)) * 1000) / 10;
    }

    res.json({
      success: true,
      data: {
        activePeriod: latestPeriod || null,
        previousPeriod: previousPeriod || null,
        variance: {
          grossPct: varianceGrossPct,
          netPct: varianceNetPct,
        },
        ytd: {
          totalRuns: ytd.total_runs || 0,
          gross: Number(ytd.ytd_gross) || 0,
          net: Number(ytd.ytd_net) || 0,
          ircTax: Number(ytd.ytd_irc_tax) || 0,
          superEmployee: Number(ytd.ytd_super_employee) || 0,
          superEmployer: Number(ytd.ytd_super_employer) || 0,
          allowances: Number(ytd.ytd_allowances) || 0,
        },
        allowanceBreakdown,
        departmentCosts,
        trends,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch payroll overview");
    res.status(500).json({ success: false, message: "Failed to load payroll overview" });
  }
});

// ==========================================
// 2. PAYROLL PERIODS (PAGINATED CRUD)
// ==========================================
router.get("/payroll/periods", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const agencyId = await getTenantAgencyId(req);
    const page = Math.max(1, parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(typeof req.query.pageSize === "string" ? req.query.pageSize : "10", 10) || 10));
    const search = (typeof req.query.search === "string" ? req.query.search : "").trim();
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const year = parseInt(typeof req.query.year === "string" ? req.query.year : "0", 10) || 0;
    const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "periodNumber";
    const sortOrder = typeof req.query.sortOrder === "string" && req.query.sortOrder === "asc" ? "asc" : "desc";

    const conditions = [];
    if (agencyId) conditions.push(eq(payrollPeriodsTable.agencyId, agencyId));
    if (status && status !== "all") conditions.push(eq(payrollPeriodsTable.status, status));
    if (year > 0) conditions.push(eq(payrollPeriodsTable.year, year));
    if (search) {
      const searchCond = or(
        ilike(payrollPeriodsTable.periodCode, `%${search}%`),
        ilike(payrollPeriodsTable.name, `%${search}%`)
      );
      if (searchCond) conditions.push(searchCond);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payrollPeriodsTable)
      .where(whereClause);
    const total = countResult?.count || 0;

    // Query records
    let orderColumn = payrollPeriodsTable.periodNumber;
    if (sortBy === "payDate") orderColumn = payrollPeriodsTable.payDate as any;
    else if (sortBy === "totalGross") orderColumn = payrollPeriodsTable.totalGross as any;
    else if (sortBy === "status") orderColumn = payrollPeriodsTable.status as any;
    else if (sortBy === "periodCode") orderColumn = payrollPeriodsTable.periodCode as any;

    const items = await db
      .select()
      .from(payrollPeriodsTable)
      .where(whereClause)
      .orderBy(sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch payroll periods");
    res.status(500).json({ success: false, message: "Failed to load payroll periods" });
  }
});

router.post("/payroll/periods", authMiddleware, requireRole("admin", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const agencyId = (await getTenantAgencyId(req)) || 1;
    const { periodCode, name, cycleType, year, periodNumber, startDate, endDate, payDate, notes } = req.body;

    if (!periodCode || !name || !startDate || !endDate || !payDate) {
      res.status(400).json({ success: false, message: "Missing required period fields" });
      return;
    }

    const [existing] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.periodCode, periodCode))
      .limit(1);

    if (existing) {
      res.status(409).json({ success: false, message: `Period code "${periodCode}" already exists` });
      return;
    }

    const [created] = await db
      .insert(payrollPeriodsTable)
      .values({
        agencyId,
        periodCode,
        name,
        cycleType: cycleType || "fortnightly",
        year: year ? parseInt(year, 10) : 2026,
        periodNumber: periodNumber ? parseInt(periodNumber, 10) : 1,
        startDate,
        endDate,
        payDate,
        notes: notes || null,
        status: "draft",
        currency: "PGK",
      })
      .returning();

    // Log audit
    await db.insert(payrollAuditLogsTable).values({
      periodId: created.id,
      action: "period_created",
      performedByUserId: (req as any).user?.userId,
      details: { periodCode, name, startDate, endDate, payDate },
    });

    res.status(201).json({ success: true, message: "Payroll period created successfully", data: created });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to create payroll period");
    res.status(500).json({ success: false, message: "Failed to create payroll period" });
  }
});

router.get("/payroll/periods/:id", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.id);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, periodId))
      .limit(1);

    if (!period) {
      res.status(404).json({ success: false, message: "Payroll period not found" });
      return;
    }

    // Get audit logs for this period
    const auditLogs = await db
      .select({
        id: payrollAuditLogsTable.id,
        action: payrollAuditLogsTable.action,
        details: payrollAuditLogsTable.details,
        createdAt: payrollAuditLogsTable.createdAt,
        userEmail: usersTable.email,
        userName: usersTable.name,
      })
      .from(payrollAuditLogsTable)
      .leftJoin(usersTable, eq(usersTable.id, payrollAuditLogsTable.performedByUserId))
      .where(eq(payrollAuditLogsTable.periodId, periodId))
      .orderBy(desc(payrollAuditLogsTable.createdAt));

    res.json({
      success: true,
      data: {
        ...period,
        auditLogs,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch period details");
    res.status(500).json({ success: false, message: "Failed to load period details" });
  }
});

// ==========================================
// 3. AUTOMATED BATCH PAYROLL CALCULATION ENGINE
// ==========================================
router.post("/payroll/periods/:id/calculate", authMiddleware, requireRole("admin", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.id);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, periodId))
      .limit(1);

    if (!period) {
      res.status(404).json({ success: false, message: "Payroll period not found" });
      return;
    }

    if (period.status === "disbursed" || period.status === "locked") {
      res.status(400).json({ success: false, message: `Cannot recalculate a ${period.status} pay period.` });
      return;
    }

    // Update status to calculating
    await db
      .update(payrollPeriodsTable)
      .set({ status: "calculating", updatedAt: new Date() })
      .where(eq(payrollPeriodsTable.id, periodId));

    // Fetch all active employees with salary profiles
    const profiles = (await db.execute(sql`
      SELECT 
        p.*,
        e.name as employee_name,
        e.employee_number,
        e.department_id,
        e.status as employee_status
      FROM employee_salary_profiles p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.is_active = true AND e.status = 'active'
    `)).rows as any[];

    // Fetch attendance data for the period window (overtime & unpaid days)
    const attendanceSummary = (await db.execute(sql`
      SELECT 
        employee_id,
        COUNT(id)::int as days_logged,
        COALESCE(SUM(CASE WHEN overtime_status = 'approved' THEN overtime_minutes ELSE 0 END), 0)::int as approved_overtime_mins,
        COALESCE(SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END), 0)::int as absent_days
      FROM attendance_records
      WHERE date >= ${period.startDate} AND date <= ${period.endDate}
      GROUP BY employee_id
    `)).rows as any[];

    const attendanceMap = new Map<number, any>();
    attendanceSummary.forEach((row) => attendanceMap.set(row.employee_id, row));

    // Fetch approved ad-hoc payroll adjustments for this period
    const adjustments = await db
      .select()
      .from(payrollAdjustmentsTable)
      .where(
        and(
          eq(payrollAdjustmentsTable.status, "approved"),
          or(
            eq(payrollAdjustmentsTable.periodId, periodId),
            sql`${payrollAdjustmentsTable.periodId} IS NULL`
          )
        )
      );

    const adjustmentsMap = new Map<number, any[]>();
    adjustments.forEach((adj) => {
      const arr = adjustmentsMap.get(adj.employeeId) || [];
      arr.push(adj);
      adjustmentsMap.set(adj.employeeId, arr);
    });

    let totalGross = 0;
    let totalTaxable = 0;
    let totalIrcTax = 0;
    let totalSuperEmployee = 0;
    let totalSuperEmployer = 0;
    let totalAllowances = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    // Delete any existing items for this period before rewriting
    await db.delete(payrollItemsTable).where(eq(payrollItemsTable.periodId, periodId));

    for (const prof of profiles) {
      const empId = prof.employee_id;
      const att = attendanceMap.get(empId) || { days_logged: 10, approved_overtime_mins: 0, absent_days: 0 };
      const adjs = adjustmentsMap.get(empId) || [];

      // Calculate overtime hours from smart attendance
      const otMins = att.approved_overtime_mins || 0;
      const otHours15 = Math.round((otMins / 60) * 10) / 10;

      // Ad-hoc additions / deductions
      let adHocAllowances = 0;
      let adHocDeductions = 0;
      adjs.forEach((adj) => {
        const amt = Number(adj.amount) || 0;
        if (adj.type === "allowance" || adj.type === "reimbursement" || adj.type === "acting_arrears") {
          adHocAllowances += amt;
        } else {
          adHocDeductions += amt;
        }
      });

      const calcResult = calculateEmployeePayroll({
        annualBaseSalary: Number(prof.annual_base_salary),
        fortnightlyBaseSalary: Number(prof.fortnightly_base_salary),
        regularHoursWorked: 80,
        overtimeHours15: otHours15,
        overtimeHours20: 0,
        housingAllowance: Number(prof.housing_allowance) || 0,
        housingAllowanceType: prof.housing_allowance_type || "fixed",
        housingAllowanceRate: Number(prof.housing_allowance_rate) || 0,
        utilityAllowance: Number(prof.utility_allowance) || 0,
        utilityAllowanceType: prof.utility_allowance_type || "fixed",
        utilityAllowanceRate: Number(prof.utility_allowance_rate) || 0,
        transportAllowance: Number(prof.transport_allowance) || 0,
        transportAllowanceType: prof.transport_allowance_type || "fixed",
        transportAllowanceRate: Number(prof.transport_allowance_rate) || 0,
        representationAllowance: Number(prof.representation_allowance) || 0,
        representationAllowanceType: prof.representation_allowance_type || "fixed",
        representationAllowanceRate: Number(prof.representation_allowance_rate) || 0,
        otherAllowances: Number(prof.other_allowances) || 0,
        otherAllowancesType: prof.other_allowances_type || "fixed",
        otherAllowancesRate: Number(prof.other_allowances_rate) || 0,
        adHocAllowances,
        adHocDeductions,
        unionDues: Number(prof.union_dues) || 0,
        insuranceDeduction: Number(prof.insurance_deduction) || 0,
        superannuationType: prof.superannuation_type || "percentage",
        superannuationFixedAmount: Number(prof.superannuation_fixed_amount) || 0,
        voluntarySuperRate: Number(prof.super_voluntary_rate) || 0,
        unpaidLeaveDays: att.absent_days || 0,
      });

      const payslipNumber = `NISIT-PS-${period.periodCode}-${String(100 + empId)}`;

      await db.insert(payrollItemsTable).values({
        periodId,
        employeeId: empId,
        payslipNumber,
        baseSalary: String(calcResult.baseSalary),
        regularHoursWorked: String(calcResult.regularHoursWorked),
        overtimeHours15: String(calcResult.overtimeHours15),
        overtimeHours20: String(calcResult.overtimeHours20),
        overtimePay: String(calcResult.overtimePay),
        allowancesBreakdown: calcResult.allowancesBreakdown,
        totalAllowances: String(calcResult.totalAllowances),
        grossPay: String(calcResult.grossPay),
        taxableIncome: String(calcResult.taxableIncome),
        ircTax: String(calcResult.ircTax),
        superannuationEmployee: String(calcResult.superannuationEmployee),
        superannuationEmployer: String(calcResult.superannuationEmployer),
        deductionsBreakdown: calcResult.deductionsBreakdown,
        totalDeductions: String(calcResult.totalDeductions),
        netPay: String(calcResult.netPay),
        currency: "PGK",
        paymentStatus: "pending",
        paymentMethod: prof.payment_method || "bank_transfer",
        bankName: prof.bank_name,
        bankAccountNumber: prof.bank_account_number,
        attendanceDaysPresent: att.days_logged || 10,
        unpaidLeaveDays: String(att.absent_days || 0),
        unpaidLeaveDeduction: String(calcResult.unpaidLeaveDeduction),
      });

      totalGross += calcResult.grossPay;
      totalTaxable += calcResult.taxableIncome;
      totalIrcTax += calcResult.ircTax;
      totalSuperEmployee += calcResult.superannuationEmployee;
      totalSuperEmployer += calcResult.superannuationEmployer;
      totalAllowances += calcResult.totalAllowances;
      totalDeductions += calcResult.totalDeductions;
      totalNet += calcResult.netPay;
    }

    // Update period totals & transition status to pending_review
    await db
      .update(payrollPeriodsTable)
      .set({
        status: "pending_review",
        totalGross: String(Math.round(totalGross * 100) / 100),
        totalTaxable: String(Math.round(totalTaxable * 100) / 100),
        totalIrcTax: String(Math.round(totalIrcTax * 100) / 100),
        totalSuperEmployee: String(Math.round(totalSuperEmployee * 100) / 100),
        totalSuperEmployer: String(Math.round(totalSuperEmployer * 100) / 100),
        totalAllowances: String(Math.round(totalAllowances * 100) / 100),
        totalDeductions: String(Math.round(totalDeductions * 100) / 100),
        totalNet: String(Math.round(totalNet * 100) / 100),
        employeeCount: profiles.length,
        updatedAt: new Date(),
      })
      .where(eq(payrollPeriodsTable.id, periodId));

    // Audit log
    await db.insert(payrollAuditLogsTable).values({
      periodId,
      action: "calculated",
      performedByUserId: (req as any).user?.userId,
      details: {
        employeeCount: profiles.length,
        totalGross,
        totalNet,
        totalIrcTax,
        totalSuperEmployee,
      },
    });

    res.json({
      success: true,
      message: `Successfully calculated remuneration for ${profiles.length} employees.`,
      data: {
        employeeCount: profiles.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalIrcTax: Math.round(totalIrcTax * 100) / 100,
        totalSuperEmployee: Math.round(totalSuperEmployee * 100) / 100,
        totalSuperEmployer: Math.round(totalSuperEmployer * 100) / 100,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to calculate payroll");
    res.status(500).json({ success: false, message: "Batch payroll calculation failed" });
  }
});

// ==========================================
// 4. APPROVAL & DISBURSEMENT WORKFLOWS
// ==========================================
router.post("/payroll/periods/:id/approve", authMiddleware, requireRole("admin", "executive", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.id);
    const userId = (req as any).user?.userId;

    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, periodId))
      .limit(1);

    if (!period) {
      res.status(404).json({ success: false, message: "Payroll period not found" });
      return;
    }

    if (period.status === "disbursed" || period.status === "locked") {
      res.status(400).json({ success: false, message: `Period is already ${period.status}` });
      return;
    }

    await db
      .update(payrollPeriodsTable)
      .set({
        status: "approved",
        approvedByUserId: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payrollPeriodsTable.id, periodId));

    await db.insert(payrollAuditLogsTable).values({
      periodId,
      action: "approved",
      performedByUserId: userId,
      details: { approvedAt: new Date().toISOString() },
    });

    res.json({ success: true, message: `Pay period ${period.periodCode} officially approved for disbursement.` });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to approve payroll period");
    res.status(500).json({ success: false, message: "Approval failed" });
  }
});

router.post("/payroll/periods/:id/disburse", authMiddleware, requireRole("admin", "executive"), async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.id);
    const userId = (req as any).user?.userId;

    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, periodId))
      .limit(1);

    if (!period) {
      res.status(404).json({ success: false, message: "Payroll period not found" });
      return;
    }

    // Set period to disbursed and mark all payslips as cleared
    await db
      .update(payrollPeriodsTable)
      .set({
        status: "disbursed",
        disbursedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payrollPeriodsTable.id, periodId));

    await db
      .update(payrollItemsTable)
      .set({ paymentStatus: "cleared", updatedAt: new Date() })
      .where(eq(payrollItemsTable.periodId, periodId));

    await db.insert(payrollAuditLogsTable).values({
      periodId,
      action: "disbursed",
      performedByUserId: userId,
      details: { disbursedAt: new Date().toISOString() },
    });

    res.json({ success: true, message: `Pay period ${period.periodCode} disbursed successfully. Bank EFT batches dispatched.` });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to disburse payroll period");
    res.status(500).json({ success: false, message: "Disbursement failed" });
  }
});

// ==========================================
// 5. PAYSLIP ITEMS (ENTERPRISE PAGINATED TABLE)
// ==========================================
router.get("/payroll/periods/:id/items", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.id);
    const page = Math.max(1, parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(typeof req.query.pageSize === "string" ? req.query.pageSize : "10", 10) || 10));
    const search = (typeof req.query.search === "string" ? req.query.search : "").trim();
    const departmentId = parseInt(typeof req.query.departmentId === "string" ? req.query.departmentId : "0", 10) || 0;
    const bankName = typeof req.query.bankName === "string" ? req.query.bankName : "";
    const paymentStatus = typeof req.query.paymentStatus === "string" ? req.query.paymentStatus : "";
    const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "employeeName";
    const sortOrder = typeof req.query.sortOrder === "string" && req.query.sortOrder === "asc" ? "asc" : "desc";

    const conditions = [eq(payrollItemsTable.periodId, periodId)];
    if (bankName && bankName !== "all") conditions.push(eq(payrollItemsTable.bankName, bankName));
    if (paymentStatus && paymentStatus !== "all") conditions.push(eq(payrollItemsTable.paymentStatus, paymentStatus));
    if (departmentId > 0) conditions.push(eq(employeesTable.departmentId, departmentId));

    if (search) {
      const searchCondition = or(
        ilike(employeesTable.name, `%${search}%`),
        ilike(employeesTable.employeeNumber, `%${search}%`),
        ilike(payrollItemsTable.payslipNumber, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : sql`1=1`;

    // Count
    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payrollItemsTable)
      .innerJoin(employeesTable, eq(employeesTable.id, payrollItemsTable.employeeId))
      .where(whereClause);
    const total = countRes?.count || 0;

    // Sort order definition
    let orderExpr = sql`e.name`;
    if (sortBy === "baseSalary") orderExpr = sql`pi.base_salary`;
    else if (sortBy === "grossPay") orderExpr = sql`pi.gross_pay`;
    else if (sortBy === "ircTax") orderExpr = sql`pi.irc_tax`;
    else if (sortBy === "netPay") orderExpr = sql`pi.net_pay`;
    else if (sortBy === "payslipNumber") orderExpr = sql`pi.payslip_number`;

    const items = (await db.execute(sql`
      SELECT 
        pi.*,
        e.name as employee_name,
        e.employee_number,
        e.grade_level,
        d.name as department_name,
        pos.title as position_title,
        prof.tin,
        prof.super_fund,
        prof.super_member_number,
        prof.private_email,
        prof.payslip_password_pin,
        prof.payslip_password_type,
        e.date_of_birth
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.period_id = ${periodId}
      ${search ? sql`AND (e.name ILIKE ${`%${search}%`} OR e.employee_number ILIKE ${`%${search}%`} OR pi.payslip_number ILIKE ${`%${search}%`})` : sql``}
      ${bankName && bankName !== "all" ? sql`AND pi.bank_name = ${bankName}` : sql``}
      ${paymentStatus && paymentStatus !== "all" ? sql`AND pi.payment_status = ${paymentStatus}` : sql``}
      ${departmentId > 0 ? sql`AND e.department_id = ${departmentId}` : sql``}
      ORDER BY ${orderExpr} ${sortOrder === "asc" ? sql`ASC` : sql`DESC`}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `)).rows as any[];

    res.json({
      success: true,
      data: items.map(formatPayrollItem),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch payslip items");
    res.status(500).json({ success: false, message: "Failed to load payslip items" });
  }
});

// ==========================================
// 6. SINGLE PAYSLIP DETAIL
// ==========================================
router.get("/payroll/items/:id", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = getParamId(req.params.id);

    const [item] = (await db.execute(sql`
      SELECT 
        pi.*,
        pp.period_code,
        pp.name as period_name,
        pp.pay_date,
        pp.start_date as period_start_date,
        pp.end_date as period_end_date,
        e.name as employee_name,
        e.employee_number,
        e.email as employee_email,
        e.grade_level,
        d.name as department_name,
        pos.title as position_title,
        prof.annual_base_salary,
        prof.hourly_rate,
        prof.tin,
        prof.super_fund,
        prof.super_member_number,
        prof.bank_branch,
        prof.private_email,
        prof.payslip_password_pin,
        prof.payslip_password_type,
        e.date_of_birth
      FROM payroll_items pi
      JOIN payroll_periods pp ON pp.id = pi.period_id
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.id = ${itemId}
      LIMIT 1
    `)).rows as any[];

    if (!item) {
      res.status(404).json({ success: false, message: "Payslip record not found" });
      return;
    }

    res.json({ success: true, data: formatPayrollItem(item) });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch payslip details");
    res.status(500).json({ success: false, message: "Failed to load payslip" });
  }
});

// ==========================================
// 6B. PASSWORD-PROTECTED PAYSLIP EMAIL DISTRIBUTION
// ==========================================

// Single Payslip Email Delivery
router.post("/payroll/items/:id/email", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = getParamId(req.params.id);
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.roleName || (req as any).user?.role;
    const callerEmpId = await currentEmployeeId(req);

    const [row] = (await db.execute(sql`
      SELECT 
        pi.*,
        pp.period_code,
        pp.name as period_name,
        pp.pay_date,
        pp.start_date as period_start_date,
        pp.end_date as period_end_date,
        pp.year as period_year,
        e.id as emp_id,
        e.name as employee_name,
        e.employee_number,
        e.email as employee_work_email,
        e.date_of_birth,
        e.grade_level,
        d.name as department_name,
        pos.title as position_title,
        prof.tin,
        prof.super_fund,
        prof.super_member_number,
        prof.private_email,
        prof.payslip_password_pin,
        prof.payslip_password_type,
        prof.bank_branch
      FROM payroll_items pi
      JOIN payroll_periods pp ON pp.id = pi.period_id
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.id = ${itemId}
      LIMIT 1
    `)).rows as any[];

    if (!row) {
      res.status(404).json({ success: false, message: "Payslip record not found" });
      return;
    }

    const isPrivileged = ["admin", "hr_officer", "executive"].includes(userRole);
    if (!isPrivileged && callerEmpId !== row.employee_id) {
      res.status(403).json({ success: false, message: "Unauthorized to distribute this payslip" });
      return;
    }

    const recipientOverride = typeof req.body?.recipientEmailOverride === "string" ? req.body.recipientEmailOverride.trim() : "";
    const targetEmail = recipientOverride || row.private_email?.trim() || row.employee_work_email?.trim();

    if (!targetEmail || !targetEmail.includes("@")) {
      res.status(400).json({
        success: false,
        message: "No registered private email address found for this staff member. Please register their private email in their Salary Profile first.",
      });
      return;
    }

    const { pdfBuffer, passwordHint } = await generatePasswordProtectedPayslipPdf({
      item: {
        id: row.id,
        payslipNumber: row.payslip_number,
        baseSalary: row.base_salary,
        regularHoursWorked: row.regular_hours_worked,
        overtimeHours15: row.overtime_hours_15,
        overtimeHours20: row.overtime_hours_20,
        overtimePay: row.overtime_pay,
        allowancesBreakdown: row.allowances_breakdown,
        totalAllowances: row.total_allowances,
        grossPay: row.gross_pay,
        taxableIncome: row.taxable_income,
        ircTax: row.irc_tax,
        superannuationEmployee: row.superannuation_employee,
        superannuationEmployer: row.superannuation_employer,
        deductionsBreakdown: row.deductions_breakdown,
        totalDeductions: row.total_deductions,
        netPay: row.net_pay,
        currency: row.currency,
        paymentMethod: row.payment_method,
        bankName: row.bank_name,
        bankAccountNumber: row.bank_account_number,
        attendanceDaysPresent: row.attendance_days_present,
        leaveDaysTaken: row.leave_days_taken,
        unpaidLeaveDays: row.unpaid_leave_days,
        unpaidLeaveDeduction: row.unpaid_leave_deduction,
      },
      employee: {
        id: row.emp_id,
        name: row.employee_name,
        employeeNumber: row.employee_number,
        dateOfBirth: row.date_of_birth,
        email: row.employee_work_email,
        departmentName: row.department_name,
        positionTitle: row.position_title,
        gradeLevel: row.grade_level,
      },
      period: {
        id: row.period_id,
        periodCode: row.period_code,
        name: row.period_name,
        startDate: row.period_start_date,
        endDate: row.period_end_date,
        payDate: row.pay_date,
        year: row.period_year || 2026,
      },
      salaryProfile: {
        tin: row.tin,
        superFund: row.super_fund,
        superMemberNumber: row.super_member_number,
        privateEmail: targetEmail,
        payslipPasswordPin: row.payslip_password_pin,
        payslipPasswordType: row.payslip_password_type,
        bankBranch: row.bank_branch,
      },
    });

    const delivery = await sendPasswordProtectedPayslipEmail({
      to: targetEmail,
      employeeName: row.employee_name,
      periodName: row.period_name,
      periodCode: row.period_code,
      payDate: row.pay_date,
      netPay: String(row.net_pay),
      currency: row.currency || "PGK",
      passwordHint,
      pdfBuffer,
      payslipNumber: row.payslip_number,
    });

    await db.execute(sql`
      UPDATE payroll_items
      SET email_delivery_status = 'sent',
          email_sent_to = ${targetEmail},
          email_sent_at = NOW(),
          email_delivery_error = NULL
      WHERE id = ${itemId}
    `);

    await db.execute(sql`
      INSERT INTO payroll_audit_logs (period_id, action, performed_by_user_id, details)
      VALUES (
        ${row.period_id},
        'EMAIL_PAYSLIP',
        ${userId || null},
        ${JSON.stringify({
          itemId,
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          sentTo: targetEmail,
          passwordHint,
          mode: delivery.mode,
        })}::jsonb
      )
    `);

    res.json({
      success: true,
      message: `Password-protected payslip successfully distributed to ${targetEmail}`,
      data: {
        sentTo: targetEmail,
        passwordHint,
        payslipNumber: row.payslip_number,
        deliveryMode: delivery.mode,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to send payslip email");
    const itemId = getParamId(req.params.id);
    if (itemId) {
      await db.execute(sql`
        UPDATE payroll_items
        SET email_delivery_status = 'failed',
            email_delivery_error = ${error?.message || "Delivery failed"}
        WHERE id = ${itemId}
      `).catch(() => {});
    }
    res.status(500).json({ success: false, message: error?.message || "Failed to deliver payslip email" });
  }
});

// Batch Period Payslip Distribution
router.post("/payroll/periods/:id/distribute-payslips", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.id);
    const userId = (req as any).user?.userId;
    const requirePrivateEmailOnly = req.body?.requirePrivateEmail !== false;
    const overrideExisting = Boolean(req.body?.overrideExisting);

    const [period] = await db.select().from(payrollPeriodsTable).where(eq(payrollPeriodsTable.id, periodId));
    if (!period) {
      res.status(404).json({ success: false, message: "Payroll period not found" });
      return;
    }

    const items = (await db.execute(sql`
      SELECT 
        pi.*,
        pp.period_code,
        pp.name as period_name,
        pp.pay_date,
        pp.start_date as period_start_date,
        pp.end_date as period_end_date,
        pp.year as period_year,
        e.id as emp_id,
        e.name as employee_name,
        e.employee_number,
        e.email as employee_work_email,
        e.date_of_birth,
        e.grade_level,
        d.name as department_name,
        pos.title as position_title,
        prof.tin,
        prof.super_fund,
        prof.super_member_number,
        prof.private_email,
        prof.payslip_password_pin,
        prof.payslip_password_type,
        prof.bank_branch
      FROM payroll_items pi
      JOIN payroll_periods pp ON pp.id = pi.period_id
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.period_id = ${periodId}
      ORDER BY e.name ASC
    `)).rows as any[];

    if (items.length === 0) {
      res.status(400).json({ success: false, message: "No payslip records found for this period. Please calculate the run first." });
      return;
    }

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const details: any[] = [];

    for (const row of items) {
      if (row.email_delivery_status === "sent" && !overrideExisting) {
        skippedCount++;
        details.push({
          id: row.id,
          employeeName: row.employee_name,
          recipient: row.email_sent_to,
          status: "skipped",
          reason: "Already distributed",
        });
        continue;
      }

      const targetEmail = row.private_email?.trim() || (!requirePrivateEmailOnly ? row.employee_work_email?.trim() : "");

      if (!targetEmail || !targetEmail.includes("@")) {
        skippedCount++;
        await db.execute(sql`
          UPDATE payroll_items
          SET email_delivery_status = 'failed',
              email_delivery_error = 'No registered private email address'
          WHERE id = ${row.id}
        `);
        details.push({
          id: row.id,
          employeeName: row.employee_name,
          status: "skipped",
          reason: "Missing registered private email",
        });
        continue;
      }

      try {
        const { pdfBuffer, passwordHint } = await generatePasswordProtectedPayslipPdf({
          item: {
            id: row.id,
            payslipNumber: row.payslip_number,
            baseSalary: row.base_salary,
            regularHoursWorked: row.regular_hours_worked,
            overtimeHours15: row.overtime_hours_15,
            overtimeHours20: row.overtime_hours_20,
            overtimePay: row.overtime_pay,
            allowancesBreakdown: row.allowances_breakdown,
            totalAllowances: row.total_allowances,
            grossPay: row.gross_pay,
            taxableIncome: row.taxable_income,
            ircTax: row.irc_tax,
            superannuationEmployee: row.superannuation_employee,
            superannuationEmployer: row.superannuation_employer,
            deductionsBreakdown: row.deductions_breakdown,
            totalDeductions: row.total_deductions,
            netPay: row.net_pay,
            currency: row.currency,
            paymentMethod: row.payment_method,
            bankName: row.bank_name,
            bankAccountNumber: row.bank_account_number,
            attendanceDaysPresent: row.attendance_days_present,
            leaveDaysTaken: row.leave_days_taken,
            unpaidLeaveDays: row.unpaid_leave_days,
            unpaidLeaveDeduction: row.unpaid_leave_deduction,
          },
          employee: {
            id: row.emp_id,
            name: row.employee_name,
            employeeNumber: row.employee_number,
            dateOfBirth: row.date_of_birth,
            email: row.employee_work_email,
            departmentName: row.department_name,
            positionTitle: row.position_title,
            gradeLevel: row.grade_level,
          },
          period: {
            id: row.period_id,
            periodCode: row.period_code,
            name: row.period_name,
            startDate: row.period_start_date,
            endDate: row.period_end_date,
            payDate: row.pay_date,
            year: row.period_year || 2026,
          },
          salaryProfile: {
            tin: row.tin,
            superFund: row.super_fund,
            superMemberNumber: row.super_member_number,
            privateEmail: targetEmail,
            payslipPasswordPin: row.payslip_password_pin,
            payslipPasswordType: row.payslip_password_type,
            bankBranch: row.bank_branch,
          },
        });

        await sendPasswordProtectedPayslipEmail({
          to: targetEmail,
          employeeName: row.employee_name,
          periodName: row.period_name,
          periodCode: row.period_code,
          payDate: row.pay_date,
          netPay: String(row.net_pay),
          currency: row.currency || "PGK",
          passwordHint,
          pdfBuffer,
          payslipNumber: row.payslip_number,
        });

        await db.execute(sql`
          UPDATE payroll_items
          SET email_delivery_status = 'sent',
              email_sent_to = ${targetEmail},
              email_sent_at = NOW(),
              email_delivery_error = NULL
          WHERE id = ${row.id}
        `);

        sentCount++;
        details.push({
          id: row.id,
          employeeName: row.employee_name,
          recipient: targetEmail,
          status: "sent",
          passwordHint,
        });
      } catch (err: any) {
        failedCount++;
        await db.execute(sql`
          UPDATE payroll_items
          SET email_delivery_status = 'failed',
              email_delivery_error = ${err?.message || "Delivery error"}
          WHERE id = ${row.id}
        `);
        details.push({
          id: row.id,
          employeeName: row.employee_name,
          recipient: targetEmail,
          status: "failed",
          error: err?.message || "Failed to send email",
        });
      }
    }

    await db.execute(sql`
      INSERT INTO payroll_audit_logs (period_id, action, performed_by_user_id, details)
      VALUES (
        ${periodId},
        'BATCH_DISTRIBUTE_PAYSLIPS',
        ${userId || null},
        ${JSON.stringify({
          periodCode: period.periodCode,
          total: items.length,
          sentCount,
          failedCount,
          skippedCount,
          requirePrivateEmailOnly,
        })}::jsonb
      )
    `);

    res.json({
      success: true,
      message: `Batch distribution completed: ${sentCount} password-protected payslips distributed to registered private emails.`,
      data: {
        total: items.length,
        sentCount,
        failedCount,
        skippedCount,
        details,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed batch payslip distribution");
    res.status(500).json({ success: false, message: error?.message || "Batch distribution failed" });
  }
});

// Period Distribution Status Overview
router.get("/payroll/periods/:id/distribution-status", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.id);

    const [stats] = (await db.execute(sql`
      SELECT 
        COUNT(pi.id)::int as total_items,
        COUNT(CASE WHEN pi.email_delivery_status = 'sent' THEN 1 END)::int as sent_count,
        COUNT(CASE WHEN pi.email_delivery_status = 'failed' THEN 1 END)::int as failed_count,
        COUNT(CASE WHEN pi.email_delivery_status = 'not_sent' OR pi.email_delivery_status IS NULL THEN 1 END)::int as pending_count,
        COUNT(CASE WHEN prof.private_email IS NOT NULL AND prof.private_email != '' THEN 1 END)::int as staff_with_private_email,
        COUNT(CASE WHEN prof.private_email IS NULL OR prof.private_email = '' THEN 1 END)::int as staff_missing_private_email
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.period_id = ${periodId}
    `)).rows as any[];

    res.json({
      success: true,
      data: stats || {
        total_items: 0,
        sent_count: 0,
        failed_count: 0,
        pending_count: 0,
        staff_with_private_email: 0,
        staff_missing_private_email: 0,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch period distribution status");
    res.status(500).json({ success: false, message: "Failed to load distribution status" });
  }
});

// ==========================================
// 7. EMPLOYEE SELF SERVICE: MY PAYSLIPS
// ==========================================
router.get("/payroll/my-payslips", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const empId = await currentEmployeeId(req);
    if (!empId) {
      // If user is admin/hr_officer without an employee link, pick first employee as demo
      const [fallback] = await db.select({ id: employeesTable.id }).from(employeesTable).limit(1);
      if (!fallback) {
        res.json({ success: true, data: [] });
        return;
      }
      const myItems = (await db.execute(sql`
        SELECT 
          pi.*,
          pp.period_code,
          pp.name as period_name,
          pp.pay_date,
          pp.start_date as period_start_date,
          pp.end_date as period_end_date,
          e.name as employee_name,
          e.employee_number,
          d.name as department_name,
          pos.title as position_title,
          prof.tin,
          prof.super_fund,
          prof.super_member_number
        FROM payroll_items pi
        JOIN payroll_periods pp ON pp.id = pi.period_id
        JOIN employees e ON e.id = pi.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN positions pos ON pos.id = e.position_id
        LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
        WHERE pi.employee_id = ${fallback.id}
        ORDER BY pp.pay_date DESC
      `)).rows as any[];
      res.json({ success: true, data: myItems.map(formatPayrollItem) });
      return;
    }

    const myItems = (await db.execute(sql`
      SELECT 
        pi.*,
        pp.period_code,
        pp.name as period_name,
        pp.pay_date,
        pp.start_date as period_start_date,
        pp.end_date as period_end_date,
        e.name as employee_name,
        e.employee_number,
        d.name as department_name,
        pos.title as position_title,
        prof.tin,
        prof.super_fund,
        prof.super_member_number
      FROM payroll_items pi
      JOIN payroll_periods pp ON pp.id = pi.period_id
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.employee_id = ${empId}
      ORDER BY pp.pay_date DESC
    `)).rows as any[];

    res.json({ success: true, data: myItems.map(formatPayrollItem) });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch employee payslips");
    res.status(500).json({ success: false, message: "Failed to load payslips" });
  }
});

// ==========================================
// 8. EMPLOYEE SALARY PROFILES (CRUD)
// ==========================================
router.get("/payroll/employee-profiles", authMiddleware, requireRole("admin", "hr_officer", "executive"), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(typeof req.query.pageSize === "string" ? req.query.pageSize : "10", 10) || 10));
    const search = (typeof req.query.search === "string" ? req.query.search : "").trim();
    const bankName = typeof req.query.bankName === "string" ? req.query.bankName : "";
    const superFund = typeof req.query.superFund === "string" ? req.query.superFund : "";

    const conditions = [];
    if (bankName && bankName !== "all") conditions.push(sql`prof.bank_name = ${bankName}`);
    if (superFund && superFund !== "all") conditions.push(sql`prof.super_fund = ${superFund}`);
    if (search) {
      conditions.push(sql`(e.name ILIKE ${`%${search}%`} OR e.employee_number ILIKE ${`%${search}%`} OR prof.tin ILIKE ${`%${search}%`})`);
    }

    const whereStr = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const countRes = await db.execute(sql`
      SELECT COUNT(prof.id)::int as count 
      FROM employee_salary_profiles prof
      JOIN employees e ON e.id = prof.employee_id
      ${whereStr}
    `);
    const total = Number((countRes.rows[0] as any)?.count || 0);

    const profiles = (await db.execute(sql`
      SELECT 
        prof.*,
        e.name as employee_name,
        e.employee_number,
        e.email as employee_email,
        d.name as department_name,
        pos.title as position_title
      FROM employee_salary_profiles prof
      JOIN employees e ON e.id = prof.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      ${whereStr}
      ORDER BY e.name ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `)).rows as any[];

    res.json({
      success: true,
      data: profiles.map(formatSalaryProfile),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch employee salary profiles");
    res.status(500).json({ success: false, message: "Failed to load employee salary profiles" });
  }
});

// ==========================================
// 8.5 PAY GRADE SCALES (PNG Public Service Standard)
// ==========================================
router.get("/payroll/pay-grades", authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: Object.values(PNG_PAY_GRADE_SCALES),
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch pay grade scales");
    res.status(500).json({ success: false, message: "Failed to load pay grade scales" });
  }
});

router.put("/payroll/employee-profiles/:employeeId", authMiddleware, requireRole("admin", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = getParamId(req.params.employeeId);
    const {
      gradeLevel,
      annualBaseSalary,
      bankName,
      bankBranch,
      bankAccountNumber,
      bankAccountName,
      tin,
      taxCode,
      superFund,
      superMemberNumber,
      superVoluntaryRate,
      superannuationType,
      superannuationFixedAmount,
      housingAllowance,
      housingAllowanceType,
      housingAllowanceRate,
      utilityAllowance,
      utilityAllowanceType,
      utilityAllowanceRate,
      transportAllowance,
      transportAllowanceType,
      transportAllowanceRate,
      representationAllowance,
      representationAllowanceType,
      representationAllowanceRate,
      otherAllowances,
      otherAllowancesType,
      otherAllowancesRate,
      unionDues,
      insuranceDeduction,
      privateEmail,
      payslipPasswordPin,
      payslipPasswordType,
      isActive,
      notes,
    } = req.body;

    // Tie paygrade directly to base salary if not custom-specified or <= 0
    const scale = getPayGradeScale(gradeLevel);
    const annual = (Number(annualBaseSalary) > 0) ? Number(annualBaseSalary) : scale.annualBaseSalary;
    const resolvedGrade = gradeLevel ? String(gradeLevel).trim() : scale.grade;
    const fortnightly = Math.round((annual / 26) * 100) / 100;
    const hourly = Math.round((fortnightly / 80) * 100) / 100;

    // Calculate allowance figures based on percentage or fixed choice
    const resolveAllowancePair = (
      type: string | undefined,
      fixedVal: any,
      rateVal: any,
      defaultFixed: number
    ) => {
      const mode = type === "percentage" ? "percentage" : "fixed";
      if (mode === "percentage") {
        const rate = Number(rateVal) || 0;
        const fixed = Math.round((fortnightly * (rate / 100)) * 100) / 100;
        return { mode, rate, fixed };
      } else {
        const fixed = fixedVal !== undefined && fixedVal !== "" ? Number(fixedVal) || 0 : defaultFixed;
        const rate = fortnightly > 0 ? Math.round((fixed / fortnightly) * 10000) / 100 : 0;
        return { mode, rate, fixed };
      }
    };

    const housingPair = resolveAllowancePair(housingAllowanceType, housingAllowance, housingAllowanceRate, scale.defaultHousing);
    const utilityPair = resolveAllowancePair(utilityAllowanceType, utilityAllowance, utilityAllowanceRate, scale.defaultUtility);
    const transportPair = resolveAllowancePair(transportAllowanceType, transportAllowance, transportAllowanceRate, scale.defaultTransport);
    const repPair = resolveAllowancePair(representationAllowanceType, representationAllowance, representationAllowanceRate, scale.defaultRepresentation);
    const otherPair = resolveAllowancePair(otherAllowancesType, otherAllowances, otherAllowancesRate, 0);

    const resolvedSuperType = superannuationType === "fixed" ? "fixed" : "percentage";
    const resolvedSuperFixed = resolvedSuperType === "fixed" ? (Number(superannuationFixedAmount) || 0) : 0;

    await db.execute(sql`
      INSERT INTO employee_salary_profiles (
        employee_id, grade_level, annual_base_salary, fortnightly_base_salary, hourly_rate,
        pay_cycle, payment_method, bank_name, bank_branch, bank_account_number, bank_account_name,
        tin, tax_code, super_fund, super_member_number, super_voluntary_rate,
        superannuation_type, superannuation_fixed_amount,
        housing_allowance, housing_allowance_type, housing_allowance_rate,
        utility_allowance, utility_allowance_type, utility_allowance_rate,
        transport_allowance, transport_allowance_type, transport_allowance_rate,
        representation_allowance, representation_allowance_type, representation_allowance_rate,
        other_allowances, other_allowances_type, other_allowances_rate,
        union_dues, insurance_deduction, private_email, payslip_password_pin, payslip_password_type,
        is_active, notes, updated_at
      ) VALUES (
        ${employeeId}, ${resolvedGrade}, ${annual}, ${fortnightly}, ${hourly},
        'fortnightly', 'bank_transfer', ${bankName || "BSP Financial Group"}, ${bankBranch || "Port Moresby"},
        ${bankAccountNumber}, ${bankAccountName}, ${tin}, ${taxCode || "primary"},
        ${superFund || "Nasfund"}, ${superMemberNumber}, ${superVoluntaryRate || 0},
        ${resolvedSuperType}, ${resolvedSuperFixed},
        ${housingPair.fixed}, ${housingPair.mode}, ${housingPair.rate},
        ${utilityPair.fixed}, ${utilityPair.mode}, ${utilityPair.rate},
        ${transportPair.fixed}, ${transportPair.mode}, ${transportPair.rate},
        ${repPair.fixed}, ${repPair.mode}, ${repPair.rate},
        ${otherPair.fixed}, ${otherPair.mode}, ${otherPair.rate},
        ${unionDues || 0}, ${insuranceDeduction || 0}, ${privateEmail || null}, ${payslipPasswordPin || null}, ${payslipPasswordType || "dob_or_pin"},
        ${isActive !== false}, ${notes || null}, NOW()
      )
      ON CONFLICT (employee_id) DO UPDATE SET
        grade_level = EXCLUDED.grade_level,
        annual_base_salary = EXCLUDED.annual_base_salary,
        fortnightly_base_salary = EXCLUDED.fortnightly_base_salary,
        hourly_rate = EXCLUDED.hourly_rate,
        bank_name = EXCLUDED.bank_name,
        bank_branch = EXCLUDED.bank_branch,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_account_name = EXCLUDED.bank_account_name,
        tin = EXCLUDED.tin,
        tax_code = EXCLUDED.tax_code,
        super_fund = EXCLUDED.super_fund,
        super_member_number = EXCLUDED.super_member_number,
        super_voluntary_rate = EXCLUDED.super_voluntary_rate,
        superannuation_type = EXCLUDED.superannuation_type,
        superannuation_fixed_amount = EXCLUDED.superannuation_fixed_amount,
        housing_allowance = EXCLUDED.housing_allowance,
        housing_allowance_type = EXCLUDED.housing_allowance_type,
        housing_allowance_rate = EXCLUDED.housing_allowance_rate,
        utility_allowance = EXCLUDED.utility_allowance,
        utility_allowance_type = EXCLUDED.utility_allowance_type,
        utility_allowance_rate = EXCLUDED.utility_allowance_rate,
        transport_allowance = EXCLUDED.transport_allowance,
        transport_allowance_type = EXCLUDED.transport_allowance_type,
        transport_allowance_rate = EXCLUDED.transport_allowance_rate,
        representation_allowance = EXCLUDED.representation_allowance,
        representation_allowance_type = EXCLUDED.representation_allowance_type,
        representation_allowance_rate = EXCLUDED.representation_allowance_rate,
        other_allowances = EXCLUDED.other_allowances,
        other_allowances_type = EXCLUDED.other_allowances_type,
        other_allowances_rate = EXCLUDED.other_allowances_rate,
        union_dues = EXCLUDED.union_dues,
        insurance_deduction = EXCLUDED.insurance_deduction,
        private_email = COALESCE(EXCLUDED.private_email, employee_salary_profiles.private_email),
        payslip_password_pin = COALESCE(EXCLUDED.payslip_password_pin, employee_salary_profiles.payslip_password_pin),
        payslip_password_type = COALESCE(EXCLUDED.payslip_password_type, employee_salary_profiles.payslip_password_type),
        is_active = EXCLUDED.is_active,
        notes = EXCLUDED.notes,
        updated_at = NOW();
    `);

    // Keep employee record gradeLevel in sync with salary profile
    await db.execute(sql`
      UPDATE employees SET grade_level = ${resolvedGrade}, updated_at = NOW() WHERE id = ${employeeId}
    `);

    res.json({
      success: true,
      message: "Salary & banking profile updated successfully.",
      data: {
        employeeId,
        gradeLevel: resolvedGrade,
        annualBaseSalary: annual,
        fortnightlyBaseSalary: fortnightly,
        hourlyRate: hourly,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to update salary profile");
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

// ==========================================
// 9. ADJUSTMENTS & REIMBURSEMENTS
// ==========================================
router.get("/payroll/adjustments", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = req.query.periodId ? parseInt(typeof req.query.periodId === "string" ? req.query.periodId : "0", 10) : undefined;
    const employeeId = req.query.employeeId ? parseInt(typeof req.query.employeeId === "string" ? req.query.employeeId : "0", 10) : undefined;

    const conditions = [];
    if (periodId && periodId > 0) conditions.push(eq(payrollAdjustmentsTable.periodId, periodId));
    if (employeeId && employeeId > 0) conditions.push(eq(payrollAdjustmentsTable.employeeId, employeeId));

    const adjustments = (await db.execute(sql`
      SELECT 
        adj.*,
        e.name as employee_name,
        e.employee_number,
        pp.period_code,
        u.name as requested_by_name
      FROM payroll_adjustments adj
      JOIN employees e ON e.id = adj.employee_id
      LEFT JOIN payroll_periods pp ON pp.id = adj.period_id
      LEFT JOIN users u ON u.id = adj.requested_by_user_id
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      ORDER BY adj.created_at DESC
    `)).rows as any[];

    res.json({ success: true, data: adjustments.map(formatAdjustment) });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch payroll adjustments");
    res.status(500).json({ success: false, message: "Failed to load adjustments" });
  }
});

router.post("/payroll/adjustments", authMiddleware, requireRole("admin", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, periodId, type, category, amount, taxable, description } = req.body;
    const userId = (req as any).user?.userId;

    if (!employeeId || !category || !amount || !description) {
      res.status(400).json({ success: false, message: "Missing required adjustment fields" });
      return;
    }

    const [created] = await db
      .insert(payrollAdjustmentsTable)
      .values({
        employeeId: parseInt(employeeId, 10),
        periodId: periodId ? parseInt(periodId, 10) : null,
        type: type || "allowance",
        category,
        amount: String(amount),
        taxable: taxable !== false,
        description,
        status: "approved",
        requestedByUserId: userId,
        approvedByUserId: userId,
      })
      .returning();

    res.status(201).json({ success: true, message: "Adjustment recorded successfully", data: created });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to record adjustment");
    res.status(500).json({ success: false, message: "Failed to record adjustment" });
  }
});

// ==========================================
// 10. STATUTORY & BANKING EXPORTS
// ==========================================
// A. Australian/PNG Banking EFT (.ABA Direct Credit file for BSP & Kina Bank)
router.get("/payroll/export/bank-aba/:periodId", authMiddleware, requireRole("admin", "executive", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.periodId);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, periodId))
      .limit(1);

    if (!period) {
      res.status(404).json({ success: false, message: "Period not found" });
      return;
    }

    const items = (await db.execute(sql`
      SELECT 
        pi.payslip_number,
        pi.net_pay,
        pi.bank_name,
        pi.bank_account_number,
        e.name as employee_name
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      WHERE pi.period_id = ${periodId}
    `)).rows as any[];

    const abaContent = generateBankingABAText({
      periodCode: period.periodCode,
      payDate: period.payDate,
      items: items.map((it) => ({
        bankName: it.bank_name || "BSP",
        bankAccountNumber: it.bank_account_number || "1000000000",
        employeeName: it.employee_name,
        netPay: Number(it.net_pay) || 0,
        payslipNumber: it.payslip_number,
      })),
    });

    res.setHeader("Content-Disposition", `attachment; filename="NISIT_BANK_EFT_${period.periodCode}.aba"`);
    res.setHeader("Content-Type", "text/plain");
    res.send(abaContent);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to export ABA file");
    res.status(500).json({ success: false, message: "Failed to generate ABA direct credit file" });
  }
});

// B. IRC Salary & Wages Tax (SWT) Electronic Statement
router.get("/payroll/export/irc-tax/:periodId", authMiddleware, requireRole("admin", "executive", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.periodId);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, periodId))
      .limit(1);

    if (!period) {
      res.status(404).json({ success: false, message: "Period not found" });
      return;
    }

    const items = (await db.execute(sql`
      SELECT 
        e.employee_number,
        e.name as employee_name,
        prof.tin,
        prof.tax_code,
        pi.gross_pay,
        pi.taxable_income,
        pi.irc_tax
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.period_id = ${periodId}
      ORDER BY e.name ASC
    `)).rows as any[];

    res.json({
      success: true,
      data: {
        periodCode: period.periodCode,
        payDate: period.payDate,
        totalTaxable: period.totalTaxable,
        totalIrcTaxWithheld: period.totalIrcTax,
        employeeCount: items.length,
        schedule: items,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to export IRC tax schedule");
    res.status(500).json({ success: false, message: "Failed to generate IRC tax schedule" });
  }
});

// C. Superannuation Contribution Schedule (Nasfund & Nambawan Super)
router.get("/payroll/export/superannuation/:periodId", authMiddleware, requireRole("admin", "executive", "hr_officer"), async (req: Request, res: Response): Promise<void> => {
  try {
    const periodId = getParamId(req.params.periodId);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, periodId))
      .limit(1);

    if (!period) {
      res.status(404).json({ success: false, message: "Period not found" });
      return;
    }

    const items = (await db.execute(sql`
      SELECT 
        e.employee_number,
        e.name as employee_name,
        prof.super_fund,
        prof.super_member_number,
        pi.base_salary,
        pi.superannuation_employee,
        pi.superannuation_employer,
        (pi.superannuation_employee + pi.superannuation_employer) as total_contribution
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
      WHERE pi.period_id = ${periodId}
      ORDER BY prof.super_fund ASC, e.name ASC
    `)).rows as any[];

    res.json({
      success: true,
      data: {
        periodCode: period.periodCode,
        payDate: period.payDate,
        totalSuperEmployee: period.totalSuperEmployee,
        totalSuperEmployer: period.totalSuperEmployer,
        totalCombinedSuper: Number(period.totalSuperEmployee) + Number(period.totalSuperEmployer),
        schedule: items,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to export superannuation schedule");
    res.status(500).json({ success: false, message: "Failed to generate superannuation schedule" });
  }
});

// ==========================================
// 11. INTERACTIVE SALARY & TAX SIMULATOR
// ==========================================
router.post("/payroll/simulate", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      gradeLevel,
      annualBaseSalary,
      overtimeHours,
      housingAllowance,
      housingAllowanceType,
      housingAllowanceRate,
      utilityAllowance,
      utilityAllowanceType,
      utilityAllowanceRate,
      transportAllowance,
      transportAllowanceType,
      transportAllowanceRate,
      representationAllowance,
      representationAllowanceType,
      representationAllowanceRate,
      otherAllowances,
      otherAllowancesType,
      otherAllowancesRate,
      superannuationType,
      superannuationFixedAmount,
      voluntarySuperRate,
    } = req.body;

    const scale = getPayGradeScale(gradeLevel);
    const resolvedAnnual = (Number(annualBaseSalary) > 0) ? Number(annualBaseSalary) : scale.annualBaseSalary;

    const result = calculateEmployeePayroll({
      annualBaseSalary: resolvedAnnual,
      overtimeHours15: Number(overtimeHours) || 0,
      housingAllowance: housingAllowance !== undefined ? Number(housingAllowance) : scale.defaultHousing,
      housingAllowanceType: housingAllowanceType || "fixed",
      housingAllowanceRate: Number(housingAllowanceRate) || 0,
      utilityAllowance: utilityAllowance !== undefined ? Number(utilityAllowance) : scale.defaultUtility,
      utilityAllowanceType: utilityAllowanceType || "fixed",
      utilityAllowanceRate: Number(utilityAllowanceRate) || 0,
      transportAllowance: transportAllowance !== undefined ? Number(transportAllowance) : scale.defaultTransport,
      transportAllowanceType: transportAllowanceType || "fixed",
      transportAllowanceRate: Number(transportAllowanceRate) || 0,
      representationAllowance: representationAllowance !== undefined ? Number(representationAllowance) : scale.defaultRepresentation,
      representationAllowanceType: representationAllowanceType || "fixed",
      representationAllowanceRate: Number(representationAllowanceRate) || 0,
      otherAllowances: Number(otherAllowances) || 0,
      otherAllowancesType: otherAllowancesType || "fixed",
      otherAllowancesRate: Number(otherAllowancesRate) || 0,
      superannuationType: superannuationType || "percentage",
      superannuationFixedAmount: Number(superannuationFixedAmount) || 0,
      voluntarySuperRate: Number(voluntarySuperRate) || 0,
    });

    res.json({
      success: true,
      data: {
        ...result,
        gradeLevel: scale.grade,
        gradeTitle: scale.title,
        gradeScale: scale,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to run simulation");
    res.status(500).json({ success: false, message: "Simulation failed" });
  }
});

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// ==========================================
// 12. EMPLOYEE COMPREHENSIVE PERIOD STATEMENT & 360 REPORT
// ==========================================
router.get("/payroll/period-statement", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawPeriodId = req.query.periodId ? getParamId(req.query.periodId as string) : 0;
    const rawEmployeeId = req.query.employeeId ? getParamId(req.query.employeeId as string) : 0;

    // 1. Resolve Target Employee
    let targetEmployeeId = rawEmployeeId;
    if (!targetEmployeeId) {
      const selfEmpId = await currentEmployeeId(req);
      if (!selfEmpId) {
        res.status(400).json({ success: false, message: "No employee profile linked to current user" });
        return;
      }
      targetEmployeeId = selfEmpId;
    }

    // RBAC: Verify current user can read target employee's records
    const allowed = await canReadEmployee(req, targetEmployeeId);
    if (!allowed) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have permission to view this employee's records" });
      return;
    }

    // 2. Resolve Pay Period
    let periodRow: any = null;
    if (rawPeriodId > 0) {
      const [found] = await db.select().from(payrollPeriodsTable).where(eq(payrollPeriodsTable.id, rawPeriodId));
      periodRow = found;
    } else {
      // Pick latest period
      const [latest] = await db.select().from(payrollPeriodsTable).orderBy(desc(payrollPeriodsTable.startDate)).limit(1);
      periodRow = latest;
    }

    if (!periodRow) {
      res.status(404).json({ success: false, message: "No pay period found" });
      return;
    }

    // 3. Fetch Employee Profile with Department, Position, Agency, Manager
    const [emp] = (await db.execute(sql`
      SELECT 
        e.id,
        e.employee_number,
        e.name,
        e.email,
        e.phone,
        e.status,
        e.start_date as hire_date,
        e.date_of_birth,
        d.name as department_name,
        p.title as position_title,
        ag.name as agency_name,
        mgr.name as supervisor_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN positions p ON p.id = e.position_id
      LEFT JOIN agencies ag ON ag.id = e.agency_id
      LEFT JOIN employees mgr ON mgr.id = e.supervisor_id
      WHERE e.id = ${targetEmployeeId}
    `)).rows as any[];

    if (!emp) {
      res.status(404).json({ success: false, message: "Employee not found" });
      return;
    }

    // 4. Fetch Salary Profile & Pay Grade
    const [salaryProfile] = (await db.execute(sql`
      SELECT * FROM employee_salary_profiles WHERE employee_id = ${targetEmployeeId}
    `)).rows as any[];

    // 5. Fetch Active Contract
    const [activeContract] = (await db.execute(sql`
      SELECT * FROM contracts WHERE employee_id = ${targetEmployeeId} ORDER BY id DESC LIMIT 1
    `)).rows as any[];

    // 6. Fetch Payroll Item (if period processed)
    const [payrollItemRow] = (await db.execute(sql`
      SELECT * FROM payroll_items WHERE period_id = ${periodRow.id} AND employee_id = ${targetEmployeeId}
    `)).rows as any[];

    // 7. Fetch Attendance in Period Window
    const attendanceRecords = (await db.execute(sql`
      SELECT 
        id,
        date,
        clock_in,
        clock_out,
        status,
        late_minutes,
        early_departure_minutes,
        overtime_minutes,
        overtime_status,
        location,
        source,
        verification_method,
        notes
      FROM attendance_records
      WHERE employee_id = ${targetEmployeeId}
        AND date >= ${periodRow.startDate}
        AND date <= ${periodRow.endDate}
      ORDER BY date ASC
    `)).rows as any[];

    // Compute attendance statistics
    let daysPresent = 0;
    let daysLate = 0;
    let totalLateMinutes = 0;
    let totalOvertimeMinutes = 0;
    let approvedOvertimeMinutes = 0;
    let daysOnLeave = 0;
    let daysAbsent = 0;

    for (const att of attendanceRecords) {
      if (att.status === "present" || att.status === "late") daysPresent++;
      if (att.status === "late") {
        daysLate++;
        totalLateMinutes += Number(att.late_minutes) || 0;
      }
      if (att.status === "on_leave") daysOnLeave++;
      if (att.status === "absent") daysAbsent++;
      const otM = Number(att.overtime_minutes) || 0;
      totalOvertimeMinutes += otM;
      if (att.overtime_status === "approved") approvedOvertimeMinutes += otM;
    }

    const workingDaysCount = 10; // Standard 2-week fortnight
    const attendanceRate = workingDaysCount > 0 ? Math.min(100, Math.round((daysPresent / workingDaysCount) * 100)) : 100;

    // 8. Fetch Leave Requests Overlapping Period
    const leaveRequestsInPeriod = (await db.execute(sql`
      SELECT 
        lr.id,
        lr.start_date,
        lr.end_date,
        lr.days,
        lr.status,
        lr.reason,
        lr.leave_period_type,
        lt.name as leave_type_name,
        lt.code as leave_type_code
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ${targetEmployeeId}
        AND lr.start_date <= ${periodRow.endDate}
        AND lr.end_date >= ${periodRow.startDate}
      ORDER BY lr.start_date ASC
    `)).rows as any[];

    // 9. Fetch Leave Balances
    const leaveBalances = (await db.execute(sql`
      SELECT 
        lb.id,
        lb.year,
        lb.allocated_days,
        lb.used_days,
        lb.pending_days,
        (lb.allocated_days - lb.used_days) as remaining_days,
        lt.name as leave_type_name,
        lt.code as leave_type_code
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ${targetEmployeeId}
      ORDER BY lt.name ASC
    `)).rows as any[];

    // 10. Fetch Payroll Adjustments in Period
    const adjustments = (await db.execute(sql`
      SELECT 
        id,
        type,
        category,
        amount,
        taxable,
        description,
        status,
        created_at
      FROM payroll_adjustments
      WHERE period_id = ${periodRow.id} AND employee_id = ${targetEmployeeId}
      ORDER BY id ASC
    `)).rows as any[];

    // 11. Compile Remuneration Figures
    let remuneration: any = null;
    if (payrollItemRow) {
      const formatted = formatPayrollItem(payrollItemRow);
      remuneration = {
        isDisbursed: true,
        payslipNumber: formatted.payslipNumber,
        baseSalary: Number(formatted.baseSalary),
        regularHoursWorked: Number(formatted.regularHoursWorked),
        overtimeHours15: Number(formatted.overtimeHours15),
        overtimeHours20: Number(formatted.overtimeHours20),
        overtimePay: Number(formatted.overtimePay),
        allowancesBreakdown: formatted.allowancesBreakdown,
        totalAllowances: Number(formatted.totalAllowances),
        grossPay: Number(formatted.grossPay),
        taxableIncome: Number(formatted.taxableIncome),
        ircTax: Number(formatted.ircTax),
        superannuationEmployee: Number(formatted.superannuationEmployee),
        superannuationEmployer: Number(formatted.superannuationEmployer),
        totalSuperContribution: Number(formatted.superannuationEmployee) + Number(formatted.superannuationEmployer),
        deductionsBreakdown: formatted.deductionsBreakdown,
        totalDeductions: Number(formatted.totalDeductions),
        netPay: Number(formatted.netPay),
        currency: formatted.currency,
        paymentStatus: formatted.paymentStatus,
        paymentMethod: formatted.paymentMethod,
        bankName: formatted.bankName || salaryProfile?.bank_name,
        bankAccountNumber: formatted.bankAccountNumber || salaryProfile?.bank_account_number,
        bankBranch: formatted.bankBranch || salaryProfile?.bank_branch,
      };
    } else {
      // Calculate projected/provisional remuneration
      const gradeScale = getPayGradeScale(salaryProfile?.grade_level || "G09");
      const annualBase = Number(salaryProfile?.annual_base_salary) > 0 ? Number(salaryProfile?.annual_base_salary) : gradeScale.annualBaseSalary;
      const calcResult = calculateEmployeePayroll({
        annualBaseSalary: annualBase,
        regularHoursWorked: 80,
        overtimeHours15: approvedOvertimeMinutes > 0 ? Number((approvedOvertimeMinutes / 60).toFixed(2)) : 0,
        housingAllowance: salaryProfile?.housing_allowance ? Number(salaryProfile.housing_allowance) : gradeScale.defaultHousing,
        housingAllowanceType: salaryProfile?.housing_allowance_type || "fixed",
        housingAllowanceRate: Number(salaryProfile?.housing_allowance_rate) || 0,
        utilityAllowance: salaryProfile?.utility_allowance ? Number(salaryProfile.utility_allowance) : gradeScale.defaultUtility,
        utilityAllowanceType: salaryProfile?.utility_allowance_type || "fixed",
        utilityAllowanceRate: Number(salaryProfile?.utility_allowance_rate) || 0,
        transportAllowance: salaryProfile?.transport_allowance ? Number(salaryProfile.transport_allowance) : gradeScale.defaultTransport,
        transportAllowanceType: salaryProfile?.transport_allowance_type || "fixed",
        transportAllowanceRate: Number(salaryProfile?.transport_allowance_rate) || 0,
        representationAllowance: salaryProfile?.representation_allowance ? Number(salaryProfile.representation_allowance) : gradeScale.defaultRepresentation,
        representationAllowanceType: salaryProfile?.representation_allowance_type || "fixed",
        representationAllowanceRate: Number(salaryProfile?.representation_allowance_rate) || 0,
        otherAllowances: Number(salaryProfile?.other_allowances) || 0,
        otherAllowancesType: salaryProfile?.other_allowances_type || "fixed",
        otherAllowancesRate: Number(salaryProfile?.other_allowances_rate) || 0,
        superannuationType: salaryProfile?.superannuation_type || "percentage",
        superannuationFixedAmount: Number(salaryProfile?.superannuation_fixed_amount) || 0,
        voluntarySuperRate: Number(salaryProfile?.voluntary_super_rate) || 0,
      });

      remuneration = {
        isDisbursed: false,
        payslipNumber: `PROV-${periodRow.periodCode}-${emp.employee_number}`,
        baseSalary: calcResult.baseSalary,
        regularHoursWorked: calcResult.regularHoursWorked,
        overtimeHours15: calcResult.overtimeHours15,
        overtimeHours20: calcResult.overtimeHours20,
        overtimePay: calcResult.overtimePay,
        allowancesBreakdown: calcResult.allowancesBreakdown,
        totalAllowances: calcResult.totalAllowances,
        grossPay: calcResult.grossPay,
        taxableIncome: calcResult.taxableIncome,
        ircTax: calcResult.ircTax,
        superannuationEmployee: calcResult.superannuationEmployee,
        superannuationEmployer: calcResult.superannuationEmployer,
        totalSuperContribution: calcResult.superannuationEmployee + calcResult.superannuationEmployer,
        deductionsBreakdown: calcResult.deductionsBreakdown,
        totalDeductions: calcResult.totalDeductions,
        netPay: calcResult.netPay,
        currency: "PGK",
        paymentStatus: "provisional",
        paymentMethod: salaryProfile?.payment_method || "bank_transfer",
        bankName: salaryProfile?.bank_name,
        bankAccountNumber: salaryProfile?.bank_account_number,
        bankBranch: salaryProfile?.bank_branch,
      };
    }

    // 12. Digital Verification & Audit Stamp
    const employeeCode = emp.employee_number || (`EMP${String(emp.id).padStart(4, "0")}`);
    const certCode = `NISIT-${periodRow.periodCode}-${employeeCode}-${Math.abs(hashString(periodRow.periodCode + String(emp.id))).toString(16).toUpperCase()}`;

    res.json({
      success: true,
      data: {
        period: {
          id: periodRow.id,
          periodCode: periodRow.periodCode,
          name: periodRow.name,
          startDate: periodRow.startDate,
          endDate: periodRow.endDate,
          payDate: periodRow.payDate,
          status: periodRow.status,
        },
        employee: {
          id: emp.id,
          employeeNumber: employeeCode,
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          status: emp.status,
          hireDate: emp.hire_date,
          dateOfBirth: emp.date_of_birth,
          privateEmail: salaryProfile?.private_email || emp.email,
          departmentName: emp.department_name,
          positionTitle: emp.position_title,
          agencyName: emp.agency_name,
          supervisorName: emp.supervisor_name,
          tin: salaryProfile?.tin,
          superFund: salaryProfile?.super_fund,
          superMemberNumber: salaryProfile?.super_member_number,
          gradeLevel: salaryProfile?.grade_level || "G09",
        },
        contract: activeContract ? {
          id: activeContract.id,
          type: activeContract.type,
          status: activeContract.status,
          startDate: activeContract.start_date,
          endDate: activeContract.end_date,
          salary: activeContract.salary,
          duties: activeContract.duties,
          workingHours: activeContract.working_hours,
        } : null,
        remuneration,
        attendance: {
          summary: {
            workingDaysCount,
            daysPresent,
            daysLate,
            totalLateMinutes,
            totalOvertimeMinutes,
            approvedOvertimeMinutes,
            approvedOvertimeHours: Number((approvedOvertimeMinutes / 60).toFixed(2)),
            daysOnLeave,
            daysAbsent,
            attendanceRatePercent: attendanceRate,
          },
          records: attendanceRecords.map((r: any) => ({
            id: r.id,
            date: r.date,
            clockIn: r.clock_in,
            clockOut: r.clock_out,
            status: r.status,
            lateMinutes: r.late_minutes,
            earlyDepartureMinutes: r.early_departure_minutes,
            overtimeMinutes: r.overtime_minutes,
            overtimeStatus: r.overtime_status,
            location: r.location,
            source: r.source,
            verificationMethod: r.verification_method,
            notes: r.notes,
          })),
        },
        leave: {
          requestsInPeriod: leaveRequestsInPeriod.map((lr: any) => ({
            id: lr.id,
            startDate: lr.start_date,
            endDate: lr.end_date,
            days: lr.days,
            status: lr.status,
            reason: lr.reason,
            periodType: lr.leave_period_type,
            leaveTypeName: lr.leave_type_name,
            leaveTypeCode: lr.leave_type_code,
          })),
          balances: leaveBalances.map((lb: any) => ({
            id: lb.id,
            year: lb.year,
            leaveTypeName: lb.leave_type_name,
            leaveTypeCode: lb.leave_type_code,
            allocatedDays: Number(lb.allocated_days),
            usedDays: Number(lb.used_days),
            pendingDays: Number(lb.pending_days),
            remainingDays: Number(lb.remaining_days),
          })),
        },
        adjustments: adjustments.map((adj: any) => ({
          id: adj.id,
          type: adj.type,
          category: adj.category,
          amount: Number(adj.amount),
          taxable: adj.taxable,
          description: adj.description,
          status: adj.status,
          createdAt: adj.created_at,
        })),
        auditCertification: {
          certificateId: certCode,
          certifiedAt: new Date().toISOString(),
          issuer: "PNG National Institute of Standards and Industrial Technology (NISIT)",
          division: "Corporate Services & Payroll Administration Directorate",
          actReference: "PNG Public Services Management Act 1995 & Salaries and Wages Tax (SWT) Act 1959",
          qrVerificationData: `https://hr.nisit.gov.pg/verify/statement?cert=${certCode}`,
        },
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to generate comprehensive employee period statement");
    res.status(500).json({ success: false, message: "Failed to generate period statement", error: error.message });
  }
});

export default router;
