import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Mail,
  Printer,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  AlertCircle,
  HelpCircle,
  Briefcase,
  FileBadge,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";

export interface PeriodStatementData {
  period: {
    id: number;
    periodCode: string;
    name: string;
    startDate: string;
    endDate: string;
    payDate: string;
    status: string;
  };
  employee: {
    id: number;
    employeeNumber: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    hireDate: string;
    dateOfBirth: string;
    privateEmail: string;
    departmentName: string;
    positionTitle: string;
    agencyName: string;
    supervisorName: string;
    tin: string;
    superFund: string;
    superMemberNumber: string;
    gradeLevel: string;
  };
  contract: {
    id: number;
    type: string;
    status: string;
    startDate: string;
    endDate: string;
    salary: string;
    duties: string;
    workingHours: string;
  } | null;
  remuneration: {
    isDisbursed: boolean;
    payslipNumber: string;
    baseSalary: number;
    regularHoursWorked: number;
    overtimeHours15: number;
    overtimeHours20: number;
    overtimePay: number;
    allowancesBreakdown: {
      housing?: number;
      utility?: number;
      transport?: number;
      representation?: number;
      other?: number;
      [key: string]: any;
    };
    totalAllowances: number;
    grossPay: number;
    taxableIncome: number;
    ircTax: number;
    superannuationEmployee: number;
    superannuationEmployer: number;
    totalSuperContribution: number;
    deductionsBreakdown: {
      tax?: number;
      superannuation?: number;
      unionDues?: number;
      insurance?: number;
      unpaidLeave?: number;
      [key: string]: any;
    };
    totalDeductions: number;
    netPay: number;
    currency: string;
    paymentStatus: string;
    paymentMethod: string;
    bankName: string;
    bankAccountNumber: string;
    bankBranch?: string;
  };
  attendance: {
    summary: {
      workingDaysCount: number;
      daysPresent: number;
      daysLate: number;
      totalLateMinutes: number;
      totalOvertimeMinutes: number;
      approvedOvertimeMinutes: number;
      approvedOvertimeHours: number;
      daysOnLeave: number;
      daysAbsent: number;
      attendanceRatePercent: number;
    };
    records: Array<{
      id: number;
      date: string;
      clockIn: string | null;
      clockOut: string | null;
      status: string;
      lateMinutes: number;
      earlyDepartureMinutes: number;
      overtimeMinutes: number;
      overtimeStatus: string;
      location: string;
      source: string;
      verificationMethod: string;
      notes: string | null;
    }>;
  };
  leave: {
    requestsInPeriod: Array<{
      id: number;
      startDate: string;
      endDate: string;
      days: string;
      status: string;
      reason: string;
      periodType: string;
      leaveTypeName: string;
      leaveTypeCode: string;
    }>;
    balances: Array<{
      id: number;
      year: number;
      leaveTypeName: string;
      leaveTypeCode: string;
      allocatedDays: number;
      usedDays: number;
      pendingDays: number;
      remainingDays: number;
    }>;
  };
  adjustments: Array<{
    id: number;
    type: string;
    category: string;
    amount: number;
    taxable: boolean;
    description: string;
    status: string;
    createdAt: string;
  }>;
  auditCertification: {
    certificateId: string;
    certifiedAt: string;
    issuer: string;
    division: string;
    actReference: string;
    qrVerificationData: string;
  };
}

function formatPGK(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  return `PGK ${num.toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PeriodStatementViewProps {
  initialPeriodId?: number | null;
  initialEmployeeId?: number | null;
  embeddedInReports?: boolean;
}

export function PeriodStatementView({
  initialPeriodId,
  initialEmployeeId,
  embeddedInReports = false,
}: PeriodStatementViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isHrOfficer, isExecutive } = useRole();
  const canSelectAnyEmployee = isAdmin || isHrOfficer || isExecutive;

  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(initialPeriodId || null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(initialEmployeeId || null);
  const [statementSubTab, setStatementSubTab] = useState<string>("remuneration");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // 1. Fetch Periods list
  const { data: periods = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll/periods"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/periods", { headers: getAuthHeader() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json || [];
    },
  });

  // Default to first period if not selected
  const effectivePeriodId = selectedPeriodId || (periods.length > 0 ? periods[0].id : null);

  // 2. Fetch Employees list for privileged users
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", { headers: getAuthHeader() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json || [];
    },
    enabled: canSelectAnyEmployee,
  });

  // 3. Fetch Comprehensive Period Statement
  const {
    data: statementData,
    isLoading,
    isError,
    refetch,
  } = useQuery<PeriodStatementData>({
    queryKey: ["/api/payroll/period-statement", effectivePeriodId, selectedEmployeeId],
    queryFn: async () => {
      let url = "/api/payroll/period-statement";
      const params = new URLSearchParams();
      if (effectivePeriodId) params.append("periodId", String(effectivePeriodId));
      if (selectedEmployeeId) params.append("employeeId", String(selectedEmployeeId));
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeader() });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to load statement");
      }
      const json = await res.json();
      return json.data;
    },
    enabled: true,
  });

  // Action: Print official PDF statement
  const handlePrint = () => {
    window.print();
  };

  // Action: Export JSON Audit
  const handleExportJson = () => {
    if (!statementData) return;
    const blob = new Blob([JSON.stringify(statementData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NISIT_Period_Statement_${statementData.period.periodCode}_${statementData.employee.employeeNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Audit Record Exported", description: "JSON statement archive downloaded successfully." });
  };

  // Action: Export CSV breakdown
  const handleExportCsv = () => {
    if (!statementData) return;
    const rows = [
      ["PNG NATIONAL INSTITUTE OF STANDARDS & INDUSTRIAL TECHNOLOGY (NISIT)"],
      ["OFFICIAL PERIOD STATEMENT & STATUTORY AUDIT REPORT"],
      ["Pay Fortnight", statementData.period.periodCode, statementData.period.name],
      ["Pay Date", statementData.period.payDate],
      ["Period Window", `${statementData.period.startDate} to ${statementData.period.endDate}`],
      [""],
      ["EMPLOYEE PARTICULARS"],
      ["Staff Name", statementData.employee.name],
      ["Employee ID", statementData.employee.employeeNumber],
      ["Position Title", statementData.employee.positionTitle],
      ["Department", statementData.employee.departmentName],
      ["Salary Grade", statementData.employee.gradeLevel],
      ["IRC Tax TIN", statementData.employee.tin || "—"],
      ["Superannuation Fund", `${statementData.employee.superFund || "Nasfund"} (#${statementData.employee.superMemberNumber || "—"})`],
      [""],
      ["REMUNERATION EARNINGS & ALLOWANCES"],
      ["Fortnight Base Salary", statementData.remuneration.baseSalary],
      ["Regular Hours Worked", statementData.remuneration.regularHoursWorked],
      ["Overtime Pay", statementData.remuneration.overtimePay],
      ["Housing Allowance", statementData.remuneration.allowancesBreakdown?.housing || 0],
      ["Utility Allowance", statementData.remuneration.allowancesBreakdown?.utility || 0],
      ["Transport Allowance", statementData.remuneration.allowancesBreakdown?.transport || 0],
      ["Representation Allowance", statementData.remuneration.allowancesBreakdown?.representation || 0],
      ["Other Allowances", statementData.remuneration.allowancesBreakdown?.other || 0],
      ["Total Gross Remuneration", statementData.remuneration.grossPay],
      [""],
      ["STATUTORY & VOLUNTARY DEDUCTIONS"],
      ["PNG IRC Salary & Wages Tax (SWT)", statementData.remuneration.ircTax],
      ["Superannuation Employee (6% + Voluntary)", statementData.remuneration.superannuationEmployee],
      ["Superannuation Employer (8.4%)", statementData.remuneration.superannuationEmployer],
      ["Total Deductions", statementData.remuneration.totalDeductions],
      ["NET TAKE-HOME PAY (DIRECT CREDIT)", statementData.remuneration.netPay],
      ["Beneficiary Bank", statementData.remuneration.bankName || "—"],
      ["Account Number", statementData.remuneration.bankAccountNumber || "—"],
      [""],
      ["ATTENDANCE SUMMARY"],
      ["Standard Fortnight Days", statementData.attendance.summary.workingDaysCount],
      ["Days Present", statementData.attendance.summary.daysPresent],
      ["Days Late", statementData.attendance.summary.daysLate],
      ["Total Late Minutes", statementData.attendance.summary.totalLateMinutes],
      ["Approved Overtime Hours", statementData.attendance.summary.approvedOvertimeHours],
      ["Attendance Score", `${statementData.attendance.summary.attendanceRatePercent}%`],
      [""],
      ["STATUTORY AUDIT CERTIFICATE"],
      ["Certificate ID", statementData.auditCertification.certificateId],
      ["Issuing Authority", statementData.auditCertification.issuer],
      ["Statutory Acts", statementData.auditCertification.actReference],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NISIT_Statement_${statementData.period.periodCode}_${statementData.employee.employeeNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "CSV Report Downloaded", description: "Statement ledger exported to CSV format." });
  };

  // Attendance columns for enterprise DataTable (Rule 24 compliant)
  const attendanceColumns: DataTableColumn<any>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground text-xs">{row.date}</span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(row.date + "T00:00:00").toLocaleDateString("en-PG", { weekday: "short" })}
          </span>
        </div>
      ),
      sortValue: (row) => row.date,
    },
    {
      key: "status",
      label: "Attendance Status",
      sortable: true,
      render: (row) => {
        const s = (row.status || "").toLowerCase();
        if (s === "present") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[11px]">Present</Badge>;
        if (s === "late") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 text-[11px]">Late ({row.lateMinutes}m)</Badge>;
        if (s === "on_leave") return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 text-[11px]">On Leave</Badge>;
        if (s === "excused") return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 text-[11px]">Excused</Badge>;
        return <Badge variant="outline" className="text-muted-foreground text-[11px]">{row.status || "Absent"}</Badge>;
      },
      sortValue: (row) => row.status,
    },
    {
      key: "clockIn",
      label: "Clock In",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.clockIn ? new Date(row.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
      ),
      sortValue: (row) => row.clockIn || "",
    },
    {
      key: "clockOut",
      label: "Clock Out",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.clockOut ? new Date(row.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
      ),
      sortValue: (row) => row.clockOut || "",
    },
    {
      key: "lateMinutes",
      label: "Late Arrival",
      sortable: true,
      render: (row) => (
        <span className={`font-mono text-xs ${Number(row.lateMinutes) > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
          {Number(row.lateMinutes) > 0 ? `${row.lateMinutes} mins` : "On time"}
        </span>
      ),
      sortValue: (row) => Number(row.lateMinutes || 0),
    },
    {
      key: "overtimeMinutes",
      label: "Overtime Claim",
      sortable: true,
      render: (row) => {
        const mins = Number(row.overtimeMinutes || 0);
        if (mins <= 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-primary">{(mins / 60).toFixed(1)}h</span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {row.overtimeStatus || "pending"}
            </Badge>
          </div>
        );
      },
      sortValue: (row) => Number(row.overtimeMinutes || 0),
    },
    {
      key: "verificationMethod",
      label: "Verification Mode",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="capitalize">{String(row.verificationMethod || "Biometric").replace("_", " ")}</span>
        </div>
      ),
      sortValue: (row) => row.verificationMethod || "",
    },
    {
      key: "location",
      label: "Location / Station",
      sortable: true,
      render: (row) => <span className="text-xs text-muted-foreground">{row.location || "NISIT HQ"}</span>,
      sortValue: (row) => row.location || "",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ================================================= */}
      {/* TOP CONTROLS & SCOPING BAR */}
      {/* ================================================= */}
      <Card className="border border-border/80 shadow-xs no-print">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Scoping Dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Pay Period Picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Pay Fortnight:
                </span>
                <Select
                  value={effectivePeriodId ? String(effectivePeriodId) : ""}
                  onValueChange={(val) => setSelectedPeriodId(Number(val))}
                >
                  <SelectTrigger className="w-60 h-9 text-xs font-medium">
                    <SelectValue placeholder="Select Fortnight" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                        <span className="font-semibold">{p.periodCode}</span> — {p.name}
                        {p.status === "disbursed" && " (Disbursed)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee Selector (Privileged HR/Admin users) */}
              {canSelectAnyEmployee ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Target Staff:
                  </span>
                  <Select
                    value={selectedEmployeeId ? String(selectedEmployeeId) : "self"}
                    onValueChange={(val) => setSelectedEmployeeId(val === "self" ? null : Number(val))}
                  >
                    <SelectTrigger className="w-64 h-9 text-xs font-medium">
                      <SelectValue placeholder="Select Staff Member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self" className="text-xs font-semibold text-primary">
                        👤 My Personal Statement ({user?.name || "Self"})
                      </SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)} className="text-xs">
                          {emp.name} ({emp.employeeNumber || `EMP${String(emp.id).padStart(4, "0")}`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Badge variant="outline" className="text-xs py-1.5 px-3 bg-muted/40 text-muted-foreground border-border">
                  <UserCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Viewing personal record for {user?.name}
                </Badge>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="font-medium text-xs h-9 shadow-xs"
                title="Print official NISIT statement letterhead"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5 text-foreground" />
                Print / Save PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="font-medium text-xs h-9 shadow-xs"
                title="Export period statement to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Export CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                className="font-medium text-xs h-9 shadow-xs"
                title="Download complete signed JSON audit payload"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Audit JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================= */}
      {/* LOADING & ERROR STATES */}
      {/* ================================================= */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {isError && !isLoading && (
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
            <h3 className="font-semibold text-lg">Unable to Load Period Statement</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Please verify that you have permission to view this employee's records and that the selected pay period exists.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="font-medium">
              Retry Query
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ================================================= */}
      {/* FULL STATEMENT VIEW (SCREEN & PRINT READY) */}
      {/* ================================================= */}
      {statementData && !isLoading && (
        <div className="space-y-6 print:space-y-4">
          {/* ================================================= */}
          {/* OFFICIAL NISIT LETTERHEAD HEADER (ALWAYS VISIBLE ON PRINT) */}
          {/* ================================================= */}
          <div className="p-6 rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 shadow-xs print:border-b-2 print:border-black print:p-0 print:shadow-none">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-semibold text-xs uppercase tracking-wider">
                    Government of Papua New Guinea
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-xs">
                    {statementData.remuneration.isDisbursed ? "Disbursed & Reconciled" : "Provisional Calculation"}
                  </Badge>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  National Institute of Standards & Industrial Technology (NISIT)
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Official Remuneration Advice, Attendance Timesheet & Comprehensive Statutory Statement
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                  <span>Pay Fortnight: <strong className="text-foreground">{statementData.period.periodCode}</strong> ({statementData.period.name})</span>
                  <span>•</span>
                  <span>Pay Date: <strong className="text-foreground">{statementData.period.payDate}</strong></span>
                  <span>•</span>
                  <span>Cycle: <strong className="text-foreground">{statementData.period.startDate} to {statementData.period.endDate}</strong></span>
                </div>
              </div>

              {/* Security Verification & QR Token */}
              <div className="flex flex-col sm:items-end p-3 rounded-xl bg-muted/40 border border-border/60 text-xs print:border-none print:p-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-foreground">Audit Certificate</span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground mt-0.5">
                  {statementData.auditCertification.certificateId}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Ref: PNG Public Services Management Act 1995
                </span>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* ROW 1: EXECUTIVE KPI SUMMARY CARDS */}
          {/* ================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Gross Remuneration</span>
                  <Coins className="w-4 h-4 text-primary" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold font-mono text-foreground">
                  {formatPGK(statementData.remuneration.grossPay)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Base: {formatPGK(statementData.remuneration.baseSalary)}</span>
                <span>Allowances: {formatPGK(statementData.remuneration.totalAllowances)}</span>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Net Take-Home Pay</span>
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatPGK(statementData.remuneration.netPay)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Total Deductions: {formatPGK(statementData.remuneration.totalDeductions)}</span>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                  Direct Credit EFT
                </Badge>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>IRC Tax (SWT) & Super</span>
                  <Landmark className="w-4 h-4 text-amber-600" />
                </CardDescription>
                <CardTitle className="text-xl font-bold font-mono text-foreground flex items-baseline gap-2">
                  <span className="text-amber-600 dark:text-amber-400">-{formatPGK(statementData.remuneration.ircTax)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Super: {formatPGK(statementData.remuneration.superannuationEmployee)}</span>
                <span className="text-[11px] font-semibold text-blue-600">
                  Employer 8.4%: {formatPGK(statementData.remuneration.superannuationEmployer)}
                </span>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Fortnight Attendance</span>
                  <Clock className="w-4 h-4 text-purple-600" />
                </CardDescription>
                <CardTitle className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
                  <span>{statementData.attendance.summary.attendanceRatePercent}%</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {statementData.attendance.summary.daysPresent} / {statementData.attendance.summary.workingDaysCount} days
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
                <span>OT: {statementData.attendance.summary.approvedOvertimeHours} hrs</span>
                <span>Late: {statementData.attendance.summary.totalLateMinutes} mins</span>
              </CardContent>
            </Card>
          </div>

          {/* ================================================= */}
          {/* EMPLOYEE PARTICULARS & CONTRACT CARD */}
          {/* ================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-2 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Staff Employment Particulars
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Staff Full Name</span>
                  <strong className="text-foreground text-sm font-semibold">{statementData.employee.name}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Staff Payroll ID</span>
                  <span className="font-mono font-semibold text-primary">{statementData.employee.employeeNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Position Title</span>
                  <span className="font-medium text-foreground">{statementData.employee.positionTitle || "Staff Officer"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Directorate / Unit</span>
                  <span className="font-medium text-foreground">{statementData.employee.departmentName || "Corporate Services"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Pay Grade Level</span>
                  <Badge variant="outline" className="text-xs font-medium">{statementData.employee.gradeLevel}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Supervisor / Reporting To</span>
                  <span className="text-foreground">{statementData.employee.supervisorName || "Director General"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Official Email</span>
                  <span className="text-foreground">{statementData.employee.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Private Delivery Email</span>
                  <span className="text-foreground">{statementData.employee.privateEmail || "—"}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-2 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  Statutory, Superannuation & Banking Particulars
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">IRC Tax TIN</span>
                  <span className="font-mono font-semibold text-foreground">{statementData.employee.tin || "Pending Registration"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Superannuation Fund</span>
                  <span className="font-semibold text-foreground">{statementData.employee.superFund || "Nasfund"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Super Member Number</span>
                  <span className="font-mono font-semibold text-blue-600">{statementData.employee.superMemberNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Commercial Bank</span>
                  <span className="font-semibold text-foreground">{statementData.remuneration.bankName || "Bank South Pacific (BSP)"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">EFT Account Number</span>
                  <span className="font-mono font-semibold text-foreground">{statementData.remuneration.bankAccountNumber || "••••••••"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Branch / Clearance</span>
                  <span className="text-muted-foreground">{statementData.remuneration.bankBranch || "Port Moresby Main"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Contract Status</span>
                  <Badge variant="outline" className="text-xs capitalize">{statementData.contract?.status || "Active"}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Contract Type</span>
                  <span className="capitalize">{statementData.contract?.type?.replace("_", " ") || "Permanent Public Service"}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ================================================= */}
          {/* TABBED SECTIONS FOR DEEP STATEMENT DIVE */}
          {/* ================================================= */}
          <Tabs value={statementSubTab} onValueChange={setStatementSubTab} className="space-y-4 no-print">
            <TabsList className="bg-muted/60 border border-border/70 p-1 rounded-xl h-auto flex flex-wrap gap-1">
              <TabsTrigger value="remuneration" className="text-xs sm:text-sm py-2 px-3 flex items-center gap-1.5">
                <Banknote className="w-4 h-4" />
                Remuneration & Deductions
              </TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs sm:text-sm py-2 px-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Attendance & Timesheet ({statementData.attendance.records.length} logs)
              </TabsTrigger>
              <TabsTrigger value="leave" className="text-xs sm:text-sm py-2 px-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Leave Entitlements & Balances
              </TabsTrigger>
              {statementData.adjustments.length > 0 && (
                <TabsTrigger value="adjustments" className="text-xs sm:text-sm py-2 px-3 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" />
                  Adjustments ({statementData.adjustments.length})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {/* SECTION 1: REMUNERATION & DEDUCTIONS BREAKDOWN */}
          <div className={`${statementSubTab === "remuneration" ? "block" : "hidden print:block"} space-y-4`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Earnings Table */}
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      Fortnight Earnings & Allowances
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono">
                      80 Regular Hours
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/60 bg-muted/10 text-muted-foreground font-semibold">
                      <tr>
                        <th className="text-left py-2.5 px-4">Pay Component</th>
                        <th className="text-left py-2.5 px-4">Rate / Basis</th>
                        <th className="text-right py-2.5 px-4">Amount (PGK)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-foreground">Fortnight Base Remuneration</td>
                        <td className="py-2.5 px-4 text-muted-foreground">80.00 regular hours</td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold">{formatPGK(statementData.remuneration.baseSalary)}</td>
                      </tr>
                      {Number(statementData.remuneration.overtimePay) > 0 && (
                        <tr>
                          <td className="py-2.5 px-4 text-foreground">Overtime Compensation (1.5x / 2.0x)</td>
                          <td className="py-2.5 px-4 text-muted-foreground">Approved overtime</td>
                          <td className="py-2.5 px-4 text-right font-mono text-primary font-medium">+{formatPGK(statementData.remuneration.overtimePay)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-2.5 px-4 text-foreground">Housing Allowance</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Designated Allowance</td>
                        <td className="py-2.5 px-4 text-right font-mono">+{formatPGK(statementData.remuneration.allowancesBreakdown?.housing || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 text-foreground">Utility & Services Allowance</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Designated Allowance</td>
                        <td className="py-2.5 px-4 text-right font-mono">+{formatPGK(statementData.remuneration.allowancesBreakdown?.utility || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 text-foreground">Transport Allowance</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Designated Allowance</td>
                        <td className="py-2.5 px-4 text-right font-mono">+{formatPGK(statementData.remuneration.allowancesBreakdown?.transport || 0)}</td>
                      </tr>
                      {Number(statementData.remuneration.allowancesBreakdown?.representation) > 0 && (
                        <tr>
                          <td className="py-2.5 px-4 text-foreground">Representation Allowance</td>
                          <td className="py-2.5 px-4 text-muted-foreground">Executive Allowance</td>
                          <td className="py-2.5 px-4 text-right font-mono">+{formatPGK(statementData.remuneration.allowancesBreakdown.representation)}</td>
                        </tr>
                      )}
                      {Number(statementData.remuneration.allowancesBreakdown?.other) > 0 && (
                        <tr>
                          <td className="py-2.5 px-4 text-foreground">Other / Project Allowances</td>
                          <td className="py-2.5 px-4 text-muted-foreground">Special Duty</td>
                          <td className="py-2.5 px-4 text-right font-mono">+{formatPGK(statementData.remuneration.allowancesBreakdown.other)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-border/80 bg-muted/20 font-bold">
                      <tr>
                        <td colSpan={2} className="py-3 px-4 text-foreground text-sm">TOTAL GROSS REMUNERATION</td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-foreground">{formatPGK(statementData.remuneration.grossPay)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {/* Deductions Table */}
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-amber-600" />
                      Statutory & Voluntary Deductions
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono">
                      Tax & Super Ledgers
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/60 bg-muted/10 text-muted-foreground font-semibold">
                      <tr>
                        <th className="text-left py-2.5 px-4">Deduction Item</th>
                        <th className="text-left py-2.5 px-4">Statutory Basis</th>
                        <th className="text-right py-2.5 px-4">Amount (PGK)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-foreground">PNG IRC Salary & Wages Tax (SWT)</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Income Tax Act 1959</td>
                        <td className="py-2.5 px-4 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">-{formatPGK(statementData.remuneration.ircTax)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 text-foreground">Nasfund Superannuation (Employee 6%)</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Superannuation Act 2000</td>
                        <td className="py-2.5 px-4 text-right font-mono text-blue-600 dark:text-blue-400 font-medium">-{formatPGK(statementData.remuneration.superannuationEmployee)}</td>
                      </tr>
                      <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                        <td className="py-2.5 px-4 text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Nasfund Employer Contribution (8.4%)
                        </td>
                        <td className="py-2.5 px-4 text-blue-600 dark:text-blue-400">Employer Paid (Non-deductible)</td>
                        <td className="py-2.5 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-medium">+{formatPGK(statementData.remuneration.superannuationEmployer)}</td>
                      </tr>
                      {Number(statementData.remuneration.deductionsBreakdown?.unionDues) > 0 && (
                        <tr>
                          <td className="py-2.5 px-4 text-foreground">Public Sector Union Dues</td>
                          <td className="py-2.5 px-4 text-muted-foreground">Voluntary Association</td>
                          <td className="py-2.5 px-4 text-right font-mono">-{formatPGK(statementData.remuneration.deductionsBreakdown.unionDues)}</td>
                        </tr>
                      )}
                      {Number(statementData.remuneration.deductionsBreakdown?.insurance) > 0 && (
                        <tr>
                          <td className="py-2.5 px-4 text-foreground">Medical / Group Life Insurance</td>
                          <td className="py-2.5 px-4 text-muted-foreground">Benefit Plan</td>
                          <td className="py-2.5 px-4 text-right font-mono">-{formatPGK(statementData.remuneration.deductionsBreakdown.insurance)}</td>
                        </tr>
                      )}
                      {Number(statementData.remuneration.deductionsBreakdown?.unpaidLeave) > 0 && (
                        <tr>
                          <td className="py-2.5 px-4 text-foreground">Unpaid Absence Deduction</td>
                          <td className="py-2.5 px-4 text-muted-foreground">Absence Recovery</td>
                          <td className="py-2.5 px-4 text-right font-mono text-destructive">-{formatPGK(statementData.remuneration.deductionsBreakdown.unpaidLeave)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-border/80 bg-muted/20 font-bold">
                      <tr>
                        <td colSpan={2} className="py-3 px-4 text-emerald-700 dark:text-emerald-300 text-sm">NET TAKE-HOME DISBURSEMENT (EFT)</td>
                        <td className="py-3 px-4 text-right font-mono text-base text-emerald-700 dark:text-emerald-300">{formatPGK(statementData.remuneration.netPay)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* SECTION 2: ATTENDANCE & TIMESHEET LEDGER */}
          <div className={`${statementSubTab === "attendance" ? "block" : "hidden print:block"} space-y-4`}>
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Fortnight Timesheet & Biometric Audit Log
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Daily clock-in/out records, punctuality tracking, and verified overtime for {statementData.period.startDate} to {statementData.period.endDate}.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {statementData.attendance.summary.daysPresent} of {statementData.attendance.summary.workingDaysCount} Days Present
                    </Badge>
                    <Badge variant="outline" className="text-xs text-primary font-mono">
                      {statementData.attendance.summary.approvedOvertimeHours} hrs Approved OT
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <DataTable
                  columns={attendanceColumns}
                  rows={statementData.attendance.records}
                  getRowId={(r) => r.id}
                  tableId="period-attendance-statement-table"
                  exportFilename={`NISIT_Attendance_${statementData.period.periodCode}_${statementData.employee.employeeNumber}`}
                  searchPlaceholder="Filter daily punches by date, status, location..."
                  emptyState={
                    <div className="py-12 text-center space-y-2">
                      <Clock className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                      <p className="font-semibold text-foreground">No Attendance Records for this Fortnight</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Clocking punches will populate automatically from biometric hardware terminals, geofence mobile check-ins, or the web kiosk.
                      </p>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* SECTION 3: LEAVE ACTIVITY & ENTITLEMENT BALANCES */}
          <div className={`${statementSubTab === "leave" ? "block" : "hidden print:block"} space-y-4`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Leave in Period */}
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Leave Activity in This Fortnight
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {statementData.leave.requestsInPeriod.length > 0 ? (
                    <div className="space-y-3">
                      {statementData.leave.requestsInPeriod.map((lr) => (
                        <div key={lr.id} className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{lr.leaveTypeName}</span>
                            <Badge variant="outline" className="capitalize text-[10px]">{lr.status}</Badge>
                          </div>
                          <div className="text-muted-foreground flex items-center justify-between">
                            <span>Window: {lr.startDate} to {lr.endDate}</span>
                            <strong className="text-foreground">{lr.days} days</strong>
                          </div>
                          {lr.reason && <p className="text-[11px] text-muted-foreground italic">"{lr.reason}"</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No leave requests taken during this pay cycle. Full attendance recorded.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Accrued Leave Balances */}
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileBadge className="w-4 h-4 text-emerald-600" />
                    Statutory Leave Entitlement Balances
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/60 bg-muted/10 text-muted-foreground font-semibold">
                      <tr>
                        <th className="text-left py-2.5 px-4">Leave Category</th>
                        <th className="text-right py-2.5 px-3">Allocated</th>
                        <th className="text-right py-2.5 px-3">Taken</th>
                        <th className="text-right py-2.5 px-4 font-bold text-foreground">Available Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {statementData.leave.balances.map((lb) => (
                        <tr key={lb.id}>
                          <td className="py-2.5 px-4 font-medium text-foreground">{lb.leaveTypeName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{lb.allocatedDays}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{lb.usedDays}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {lb.remainingDays} days
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* SECTION 4: PAYROLL ADJUSTMENTS */}
          {statementData.adjustments.length > 0 && (
            <div className={`${statementSubTab === "adjustments" ? "block" : "hidden print:block"} space-y-4`}>
              <Card className="border border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    Special Fortnight Adjustments & Claims
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/60 bg-muted/10 text-muted-foreground font-semibold">
                      <tr>
                        <th className="text-left py-2.5 px-4">Category & Type</th>
                        <th className="text-left py-2.5 px-4">Description</th>
                        <th className="text-center py-2.5 px-3">Taxable</th>
                        <th className="text-center py-2.5 px-3">Approval</th>
                        <th className="text-right py-2.5 px-4">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {statementData.adjustments.map((adj) => (
                        <tr key={adj.id}>
                          <td className="py-2.5 px-4 font-semibold text-foreground">
                            {adj.category} <span className="text-muted-foreground font-normal">({adj.type})</span>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">{adj.description}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {adj.taxable ? "Yes" : "Exempt"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className="capitalize text-[10px] text-emerald-600 border-emerald-300">
                              {adj.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground">
                            {formatPGK(adj.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ================================================= */}
          {/* STATUTORY AUDIT CERTIFICATION & OFFICIAL SIGNATURE BLOCK */}
          {/* ================================================= */}
          <Card className="border border-border/80 bg-muted/10 shadow-xs">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1.5 text-xs text-muted-foreground max-w-xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-foreground text-sm">
                      Official Government of Papua New Guinea Audit Verification
                    </span>
                  </div>
                  <p>
                    This comprehensive record has been generated and cryptographically sealed under the authority of the{" "}
                    <strong className="text-foreground">PNG National Institute of Standards & Industrial Technology (NISIT)</strong>.
                    Calculations comply with the Papua New Guinea Public Services Management Act 1995, Salaries and Wages Tax (SWT) Act 1959, and Superannuation Act 2000.
                  </p>
                  <p className="font-mono text-[11px] text-foreground">
                    Verification Certificate: <strong>{statementData.auditCertification.certificateId}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  {/* Signature Blocks for Print */}
                  <div className="hidden print:flex items-center gap-12 text-center text-xs">
                    <div className="border-t border-black pt-2 w-36">
                      <span className="font-semibold block">Director of Finance</span>
                      <span className="text-[10px]">NISIT Financial Controller</span>
                    </div>
                    <div className="border-t border-black pt-2 w-36">
                      <span className="font-semibold block">Director of HR</span>
                      <span className="text-[10px]">Human Capital Management</span>
                    </div>
                  </div>

                  {/* QR Code Block */}
                  <div className="p-2.5 rounded-xl border border-border/80 bg-card flex flex-col items-center justify-center text-center">
                    <QrCode className="w-16 h-16 text-primary" />
                    <span className="text-[10px] font-mono text-muted-foreground mt-1">NISIT-VERIFIED</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
