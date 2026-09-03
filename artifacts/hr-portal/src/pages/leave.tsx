import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Filter,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
  CalendarDays,
  ShieldAlert,
  Users,
  SlidersHorizontal,
  Download,
  Printer,
  Info,
  UserCheck,
  Phone,
  Paperclip,
  Activity,
  History,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useGetEmployees, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface LeaveType {
  id: number;
  name: string;
  code: string;
  defaultDays: number;
  carryOverMax: number;
  isPaid: boolean;
  description: string;
}

interface LeaveBalance {
  id: number;
  employeeId: number;
  employeeName?: string;
  employeeNumber?: string;
  departmentName?: string;
  leaveTypeId: number;
  leaveTypeName: string;
  leaveTypeCode: string;
  year: number;
  allocatedDays: string;
  usedDays: string;
  pendingDays: string;
}

interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  departmentName?: string;
  positionTitle?: string;
  leaveTypeId: number;
  leaveTypeName: string;
  leaveTypeCode?: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approverId?: number | null;
  approverComment: string | null;
  approvedAt: string | null;
  attachmentUrl?: string | null;
  handoverEmployeeId?: number | null;
  handoverEmployeeName?: string | null;
  leavePeriodType?: string;
  emergencyContact?: string | null;
  medicalCertificateNumber?: string | null;
  createdAt: string;
}

interface PublicHoliday {
  id: number;
  name: string;
  date: string;
  year: number;
  isRecurring: boolean;
  notes?: string | null;
}

interface BalanceAdjustment {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  year: number;
  adjustmentDays: string;
  adjustmentType: string;
  reason: string;
  authorizedByName?: string | null;
  createdAt: string;
}

interface LeaveAnalytics {
  summary: {
    totalEmployees: number;
    activeOnLeaveToday: number;
    pendingApprovalsCount: number;
    totalDaysTakenYear: number;
    utilizationRate: number;
    currentYear: number;
  };
  byType: Array<{
    typeId: number;
    name: string;
    code: string;
    requestCount: number;
    daysTaken: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    monthIndex: number;
    days: number;
    count: number;
  }>;
  byDepartment: Array<{
    departmentName: string;
    daysTaken: number;
    pendingRequests: number;
  }>;
  statusCounts: {
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
}

export default function LeaveManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isHR, isHiringManager } = useRole();
  const canApprove = isAdmin || isHR || isHiringManager;

  const [activeTab, setActiveTab] = useState("requests");

  // Filter state for requests table
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modals state
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isHolidayOpen, setIsHolidayOpen] = useState(false);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState<LeaveRequest | null>(null);

  // Application Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leavePeriodType, setLeavePeriodType] = useState<string>("full_day");
  const [handoverEmployeeId, setHandoverEmployeeId] = useState<string>("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [medicalCertNumber, setMedicalCertNumber] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  // Adjustment Form State
  const [adjEmployeeId, setAdjEmployeeId] = useState("");
  const [adjLeaveTypeId, setAdjLeaveTypeId] = useState("");
  const [adjDays, setAdjDays] = useState("");
  const [adjType, setAdjType] = useState("accrual");
  const [adjReason, setAdjReason] = useState("");

  // Holiday Form State
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayRecurring, setHolidayRecurring] = useState(true);
  const [holidayNotes, setHolidayNotes] = useState("");

  // Approval review state
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    request: LeaveRequest | null;
    status: "approved" | "rejected";
    comment: string;
  }>({
    open: false,
    request: null,
    status: "approved",
    comment: "",
  });

  // Calendar view navigation state
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarDeptFilter, setCalendarDeptFilter] = useState("all");

  // Fetch employees for selectors
  const { data: rawEmployees = [] } = useGetEmployees(undefined, {
    query: { queryKey: getGetEmployeesQueryKey() },
  });
  const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

  const staffSelectOptions = useMemo(
    () =>
      employees.map((emp: any) => ({
        value: String(emp.id),
        label: `${emp.name} (${emp.position?.title || `Staff #${emp.id}`})`,
        searchTerms: `${emp.name} ${emp.employeeNumber || ""} ${emp.position?.title || ""} ${emp.email || ""}`,
      })),
    [employees]
  );

  const reliefOfficerOptions = useMemo(
    () => [
      { value: "", label: "None / Not Assigned", searchTerms: "none unassigned self" },
      ...employees.map((emp: any) => ({
        value: String(emp.id),
        label: `${emp.name} (${emp.position?.title || `Staff #${emp.id}`})`,
        searchTerms: `${emp.name} ${emp.employeeNumber || ""} ${emp.position?.title || ""} ${emp.email || ""}`,
      })),
    ],
    [employees]
  );

  // Fetch Leave Types
  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ["/api/leave/types"],
    queryFn: async () => {
      const res = await fetch("/api/leave/types");
      if (!res.ok) throw new Error("Failed to fetch leave types");
      return res.json();
    },
  });

  // Fetch Balances for active employee
  const { data: balances = [], isLoading: isLoadingBalances } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave/balances"],
    queryFn: async () => {
      const res = await fetch("/api/leave/balances", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch All Staff Balances (HR / Admin view)
  const { data: allStaffBalances = [], isLoading: isLoadingAllBalances } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave/balances", "all"],
    queryFn: async () => {
      const res = await fetch("/api/leave/balances?all=true", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(canApprove),
  });

  // Fetch Leave Requests
  const { data: requests = [], isLoading: isLoadingRequests } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave/requests"],
    queryFn: async () => {
      const res = await fetch("/api/leave/requests", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Statutory Public Holidays
  const { data: holidays = [] } = useQuery<PublicHoliday[]>({
    queryKey: ["/api/leave/holidays"],
    queryFn: async () => {
      const res = await fetch("/api/leave/holidays?year=2026");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Analytics & Trends
  const { data: analytics } = useQuery<LeaveAnalytics>({
    queryKey: ["/api/leave/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/leave/analytics", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });

  // Fetch Balance Adjustments Ledger
  const { data: adjustments = [], isLoading: isLoadingAdjustments } = useQuery<BalanceAdjustment[]>({
    queryKey: ["/api/leave/adjustments"],
    queryFn: async () => {
      const res = await fetch("/api/leave/adjustments", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(canApprove),
  });

  // Dynamic calculation of Working Days vs Total Calendar Days
  const calculatedDaysBreakdown = useMemo(() => {
    if (!startDate || !endDate) return { calendarDays: 0, workingDays: 0, weekendDays: 0, holidayDays: 0 };
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (end < start) return { calendarDays: 0, workingDays: 0, weekendDays: 0, holidayDays: 0 };

    if (leavePeriodType === "half_day_am" || leavePeriodType === "half_day_pm") {
      return { calendarDays: 1, workingDays: 0.5, weekendDays: 0, holidayDays: 0 };
    }

    const holidaySet = new Set(holidays.map((h) => h.date));
    let current = new Date(start);
    let calendarCount = 0;
    let weekendCount = 0;
    let holidayCount = 0;
    let workingCount = 0;

    while (current <= end) {
      calendarCount++;
      const dayOfWeek = current.getUTCDay();
      const dateKey = current.toISOString().slice(0, 10);

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendCount++;
      } else if (holidaySet.has(dateKey)) {
        holidayCount++;
      } else {
        workingCount++;
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return {
      calendarDays: calendarCount,
      workingDays: workingCount,
      weekendDays: weekendCount,
      holidayDays: holidayCount,
    };
  }, [startDate, endDate, leavePeriodType, holidays]);

  // Submit Leave Request Mutation
  const applyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/leave/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/analytics"] });
      toast({ title: "Success", description: "Leave request submitted successfully for approval routing." });
      setIsApplyOpen(false);
      setSelectedType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setHandoverEmployeeId("");
      setEmergencyContact("");
      setMedicalCertNumber("");
    },
    onError: (err: any) => {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    },
  });

  // Single Status Update Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, approverComment }: { id: number; status: string; approverComment: string }) => {
      const res = await fetch(`/api/leave/requests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status, approverComment }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/analytics"] });
      toast({ title: "Status Updated", description: "Leave request decision recorded successfully." });
      setReviewDialog({ open: false, request: null, status: "approved", comment: "" });
      setSelectedRequestDetails(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Bulk Status Update Mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: "approved" | "rejected" }) => {
      const res = await fetch("/api/leave/requests/bulk-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ids,
          status,
          approverComment: `Bulk ${status} via Leave Management Console`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk update failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/analytics"] });
      toast({
        title: "Bulk Action Completed",
        description: `Successfully processed ${data.processedCount} leave requests.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Bulk Action Failed", description: err.message, variant: "destructive" });
    },
  });

  // Balance Adjustment Mutation
  const adjustmentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/leave/adjustments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to adjust balance");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/analytics"] });
      toast({ title: "Balance Adjusted", description: "Leave balance ledger entry recorded successfully." });
      setIsAdjustmentOpen(false);
      setAdjEmployeeId("");
      setAdjLeaveTypeId("");
      setAdjDays("");
      setAdjReason("");
    },
    onError: (err: any) => {
      toast({ title: "Adjustment Failed", description: err.message, variant: "destructive" });
    },
  });

  // Public Holiday Mutation
  const holidayMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/leave/holidays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add holiday");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/holidays"] });
      toast({ title: "Public Holiday Added", description: "Official statutory holiday added to calendar." });
      setIsHolidayOpen(false);
      setHolidayName("");
      setHolidayDate("");
      setHolidayNotes("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !startDate || !endDate || !reason) {
      toast({ title: "Incomplete Form", description: "Please complete all mandatory fields", variant: "destructive" });
      return;
    }
    if (endDate < startDate) {
      toast({ title: "Invalid Dates", description: "End date must be on or after start date.", variant: "destructive" });
      return;
    }

    const effectiveEmployeeId = selectedEmployeeId
      ? parseInt(selectedEmployeeId)
      : employees[0]?.id
      ? employees[0].id
      : 1;

    applyMutation.mutate({
      employeeId: effectiveEmployeeId,
      leaveTypeId: parseInt(selectedType),
      startDate,
      endDate,
      days: calculatedDaysBreakdown.workingDays,
      leavePeriodType,
      handoverEmployeeId: handoverEmployeeId ? parseInt(handoverEmployeeId) : null,
      emergencyContact,
      medicalCertificateNumber: medicalCertNumber || null,
      reason,
      attachmentUrl: attachmentUrl || null,
    });
  };

  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjEmployeeId || !adjLeaveTypeId || !adjDays || !adjReason) {
      toast({ title: "Required Fields", description: "Please provide employee, leave type, days, and reason.", variant: "destructive" });
      return;
    }

    adjustmentMutation.mutate({
      employeeId: adjEmployeeId,
      leaveTypeId: adjLeaveTypeId,
      year: 2026,
      adjustmentDays: adjDays,
      adjustmentType: adjType,
      reason: adjReason,
    });
  };

  const handleHolidaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) {
      toast({ title: "Required Fields", description: "Holiday name and date are required.", variant: "destructive" });
      return;
    }

    holidayMutation.mutate({
      name: holidayName,
      date: holidayDate,
      year: new Date(holidayDate).getFullYear(),
      isRecurring: holidayRecurring,
      notes: holidayNotes,
    });
  };

  // Filter requests based on top chips
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchType = typeFilter === "all" || String(r.leaveTypeId) === typeFilter;
      return matchStatus && matchType;
    });
  }, [requests, statusFilter, typeFilter]);

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Pending</Badge>;
    }
  };

  // Define Enterprise DataTable Columns for Requests
  const requestColumns: DataTableColumn<LeaveRequest>[] = useMemo(
    () => [
      {
        key: "employeeName",
        label: "Officer Name",
        sortable: true,
        minWidth: 170,
        render: (row) => (
          <div>
            <span className="font-semibold text-foreground block">{row.employeeName || "Active Officer"}</span>
            <span className="text-[11px] text-muted-foreground">{row.positionTitle || "Staff"}</span>
          </div>
        ),
        sortValue: (row) => row.employeeName || "",
        exportValue: (row) => row.employeeName || "",
      },
      {
        key: "departmentName",
        label: "Department",
        sortable: true,
        minWidth: 140,
        render: (row) => <span className="text-muted-foreground">{row.departmentName || "General Staff"}</span>,
        sortValue: (row) => row.departmentName || "",
        exportValue: (row) => row.departmentName || "",
      },
      {
        key: "leaveTypeName",
        label: "Leave Category",
        sortable: true,
        minWidth: 140,
        render: (row) => (
          <Badge variant="outline" className="font-medium bg-background text-foreground">
            {row.leaveTypeName}
          </Badge>
        ),
        sortValue: (row) => row.leaveTypeName || "",
        exportValue: (row) => row.leaveTypeName || "",
      },
      {
        key: "dates",
        label: "Duration / Dates",
        sortable: true,
        minWidth: 180,
        render: (row) => (
          <span className="whitespace-nowrap text-muted-foreground font-mono text-xs">
            {row.startDate} <span className="text-primary font-bold">→</span> {row.endDate}
          </span>
        ),
        sortValue: (row) => row.startDate,
        exportValue: (row) => `${row.startDate} to ${row.endDate}`,
      },
      {
        key: "days",
        label: "Working Days",
        sortable: true,
        minWidth: 120,
        render: (row) => (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="font-semibold">
              {row.days} d
            </Badge>
            {row.leavePeriodType && row.leavePeriodType !== "full_day" && (
              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                {row.leavePeriodType.replace("half_day_", "1/2 ")}
              </span>
            )}
          </div>
        ),
        sortValue: (row) => parseFloat(row.days) || 0,
        exportValue: (row) => `${row.days} days`,
      },
      {
        key: "handoverEmployeeName",
        label: "Relief / Handover",
        minWidth: 150,
        render: (row) => (
          <span className="text-muted-foreground text-xs">
            {row.handoverEmployeeName ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <UserCheck className="w-3 h-3 text-muted-foreground" />
                {row.handoverEmployeeName}
              </span>
            ) : (
              "—"
            )}
          </span>
        ),
        exportValue: (row) => row.handoverEmployeeName || "None",
      },
      {
        key: "reason",
        label: "Justification",
        minWidth: 180,
        render: (row) => (
          <span className="text-muted-foreground max-w-xs truncate block" title={row.reason}>
            {row.reason}
          </span>
        ),
        exportValue: (row) => row.reason || "",
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        minWidth: 110,
        render: (row) => getStatusBadge(row.status),
        sortValue: (row) => row.status,
        exportValue: (row) => row.status,
      },
      {
        key: "actions",
        label: "Actions",
        resizable: false,
        minWidth: 150,
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setSelectedRequestDetails(row)}
            >
              <FileText className="w-3.5 h-3.5 mr-1" /> Details
            </Button>
            {row.status === "pending" && canApprove && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={() =>
                    setReviewDialog({
                      open: true,
                      request: row,
                      status: "approved",
                      comment: "",
                    })
                  }
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() =>
                    setReviewDialog({
                      open: true,
                      request: row,
                      status: "rejected",
                      comment: "",
                    })
                  }
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [canApprove]
  );

  // Define Enterprise DataTable Columns for All Staff Balances
  const balanceColumns: DataTableColumn<LeaveBalance>[] = useMemo(
    () => [
      {
        key: "employeeName",
        label: "Staff Member",
        sortable: true,
        minWidth: 180,
        render: (row) => (
          <div>
            <span className="font-semibold text-foreground block">{row.employeeName || "Active Officer"}</span>
            <span className="text-[10px] text-muted-foreground">Payroll: {row.employeeNumber || `#${row.employeeId}`}</span>
          </div>
        ),
        sortValue: (row) => row.employeeName || "",
        exportValue: (row) => row.employeeName || "",
      },
      {
        key: "departmentName",
        label: "Department",
        sortable: true,
        minWidth: 140,
        render: (row) => <span className="text-muted-foreground">{row.departmentName || "General Staff"}</span>,
        sortValue: (row) => row.departmentName || "",
        exportValue: (row) => row.departmentName || "",
      },
      {
        key: "leaveTypeName",
        label: "Category",
        sortable: true,
        minWidth: 130,
        render: (row) => <Badge variant="outline">{row.leaveTypeName}</Badge>,
        sortValue: (row) => row.leaveTypeName || "",
        exportValue: (row) => row.leaveTypeName || "",
      },
      {
        key: "allocatedDays",
        label: "Allocated",
        sortable: true,
        minWidth: 100,
        render: (row) => <span className="font-medium text-foreground">{row.allocatedDays} d</span>,
        sortValue: (row) => parseFloat(row.allocatedDays) || 0,
        exportValue: (row) => `${row.allocatedDays} days`,
      },
      {
        key: "usedDays",
        label: "Days Taken",
        sortable: true,
        minWidth: 100,
        render: (row) => <span className="text-muted-foreground">{row.usedDays} d</span>,
        sortValue: (row) => parseFloat(row.usedDays) || 0,
        exportValue: (row) => `${row.usedDays} days`,
      },
      {
        key: "pendingDays",
        label: "Pending",
        sortable: true,
        minWidth: 100,
        render: (row) => (
          <span className={parseFloat(row.pendingDays) > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
            {row.pendingDays} d
          </span>
        ),
        sortValue: (row) => parseFloat(row.pendingDays) || 0,
        exportValue: (row) => `${row.pendingDays} days`,
      },
      {
        key: "remaining",
        label: "Available Balance",
        sortable: true,
        minWidth: 130,
        render: (row) => {
          const total = parseFloat(row.allocatedDays) || 0;
          const used = parseFloat(row.usedDays) || 0;
          const pending = parseFloat(row.pendingDays) || 0;
          const rem = Math.max(0, total - used - pending);
          return (
            <Badge
              variant="secondary"
              className={rem <= 2 ? "bg-rose-500/15 text-rose-700 font-bold" : "bg-primary/10 text-primary font-bold"}
            >
              {rem} days
            </Badge>
          );
        },
        sortValue: (row) => {
          const total = parseFloat(row.allocatedDays) || 0;
          const used = parseFloat(row.usedDays) || 0;
          const pending = parseFloat(row.pendingDays) || 0;
          return Math.max(0, total - used - pending);
        },
        exportValue: (row) => {
          const total = parseFloat(row.allocatedDays) || 0;
          const used = parseFloat(row.usedDays) || 0;
          const pending = parseFloat(row.pendingDays) || 0;
          return `${Math.max(0, total - used - pending)} days`;
        },
      },
    ],
    []
  );

  // Absence Calendar generation helper
  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    // Shift to Mon = 0
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayRequests = requests.filter((r) => {
        if (r.status !== "approved" && r.status !== "pending") return false;
        if (calendarDeptFilter !== "all" && r.departmentName !== calendarDeptFilter) return false;
        return r.startDate <= dateKey && r.endDate >= dateKey;
      });

      const holiday = holidays.find((h) => h.date === dateKey);

      days.push({
        dayNumber: day,
        dateKey,
        requests: dayRequests,
        holiday,
      });
    }

    return days;
  }, [calendarMonth, requests, holidays, calendarDeptFilter]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.departmentName) set.add(r.departmentName);
    });
    return Array.from(set);
  }, [requests]);

  const monthYearDisplay = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave & Absence Management</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Enterprise ESS & Workflow
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Statutory leave entitlement tracking, automated working-days calculation, and General Orders governance
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canApprove && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdjustmentOpen(true)}
                className="h-9"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                Adjust Balance
              </Button>
            )}
            <Button onClick={() => setIsApplyOpen(true)} className="h-9 shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Apply for Leave
            </Button>
          </div>
        </div>

        {/* 2026 Employee Entitlement Overview Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              My 2026 Statutory Entitlements & Remaining Balances
            </h2>
            <span className="text-xs text-muted-foreground">General Orders Compliant</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {isLoadingBalances ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border-border/70">
                  <CardContent className="p-3.5">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : balances.length === 0 ? (
              leaveTypes.map((lt) => (
                <Card key={lt.id} className="bg-card border-border/80">
                  <CardContent className="p-3.5">
                    <p className="text-xs font-semibold text-muted-foreground truncate">{lt.name}</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {lt.defaultDays} <span className="text-xs font-normal text-muted-foreground">days</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Standard Entitlement</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              balances.map((b) => {
                const total = parseFloat(b.allocatedDays) || 0;
                const used = parseFloat(b.usedDays) || 0;
                const pending = parseFloat(b.pendingDays) || 0;
                const remaining = Math.max(0, total - used - pending);
                return (
                  <Card key={b.id} className="bg-card border-border/80 hover:border-primary/40 transition-colors shadow-xs">
                    <CardContent className="p-3.5">
                      <p className="text-xs font-semibold text-muted-foreground truncate">{b.leaveTypeName}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {remaining}{" "}
                        <span className="text-xs font-normal text-muted-foreground">/ {total}d</span>
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                        <span>Used: {used}d</span>
                        {pending > 0 && <span className="text-amber-600 font-medium">Pending: {pending}d</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/70 p-1 border border-border/60">
            <TabsTrigger value="requests" className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Requests & Approvals
              {requests.filter((r) => r.status === "pending").length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-amber-500/20 text-amber-700">
                  {requests.filter((r) => r.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics & Insights
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Absence Calendar
            </TabsTrigger>
            {canApprove && (
              <TabsTrigger value="balances" className="text-xs gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Staff Entitlements Ledger
              </TabsTrigger>
            )}
            <TabsTrigger value="policies" className="text-xs gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Statutory Holidays & Policy
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: REQUESTS & APPROVALS */}
          <TabsContent value="requests" className="space-y-4">
            <Card className="shadow-xs border-border/80">
              <CardHeader className="p-4 border-b border-border/60">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 h-8 text-xs bg-background">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending Approval</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-44 h-8 text-xs bg-background">
                        <SelectValue placeholder="Leave Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Entitlement Types</SelectItem>
                        {leaveTypes.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {(statusFilter !== "all" || typeFilter !== "all") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setStatusFilter("all");
                          setTypeFilter("all");
                        }}
                        className="h-8 text-xs text-muted-foreground"
                      >
                        Reset filters
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <DataTable<LeaveRequest>
                  columns={requestColumns}
                  rows={filteredRequests}
                  getRowId={(r) => r.id}
                  isLoading={isLoadingRequests}
                  exportFilename="nisit-leave-requests"
                  tableId="nisit-leave-table"
                  searchPlaceholder="Search officer, department, or reason..."
                  bulkActions={
                    canApprove
                      ? [
                          { label: "Approve Selected", value: "approve" },
                          { label: "Reject Selected", value: "reject", variant: "destructive" },
                        ]
                      : []
                  }
                  onBulkAction={async (ids, action) => {
                    if (ids.length === 0) return;
                    await bulkStatusMutation.mutateAsync({
                      ids,
                      status: action === "approve" ? "approved" : "rejected",
                    });
                  }}
                  emptyState={
                    <div className="p-8 text-center space-y-2">
                      <CalendarIcon className="w-8 h-8 mx-auto text-muted-foreground/40" />
                      <p className="text-sm font-semibold text-foreground">No leave applications found</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Submit a new application or clear active search filters above.
                      </p>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: ANALYTICS & INSIGHTS */}
          <TabsContent value="analytics" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border/80 shadow-xs">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Staff On Leave Today
                    </p>
                    <p className="text-3xl font-extrabold text-foreground mt-1">
                      {analytics?.summary.activeOnLeaveToday ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Active Absence Duty Coverage
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                    <UserCheck className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/80 shadow-xs">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Pending Approvals
                    </p>
                    <p className="text-3xl font-extrabold text-amber-600 mt-1">
                      {analytics?.summary.pendingApprovalsCount ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">Awaiting Line Manager or HR Review</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/80 shadow-xs">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Total Days Taken (2026)
                    </p>
                    <p className="text-3xl font-extrabold text-foreground mt-1">
                      {analytics?.summary.totalDaysTakenYear ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">Approved Statutory Working Days</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                    <Activity className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/80 shadow-xs">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Leave Utilization Rate
                    </p>
                    <p className="text-3xl font-extrabold text-foreground mt-1">
                      {analytics?.summary.utilizationRate ?? 0}%
                    </p>
                    <div className="w-28 bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.min(100, analytics?.summary.utilizationRate ?? 0)}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Interactive Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Absence Trends */}
              <Card className="shadow-xs border-border/80">
                <CardHeader className="p-4 border-b border-border/60">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Monthly Absence Trends (Approved Working Days)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribution of approved staff leave days across the 2026 calendar year
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.monthlyTrend || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          formatter={(value: any) => [`${value} working days`, "Absence Days"]}
                          contentStyle={{ backgroundColor: "rgba(255,255,255,0.95)", borderRadius: "8px", fontSize: "12px" }}
                        />
                        <Bar dataKey="days" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Leave by Entitlement Category */}
              <Card className="shadow-xs border-border/80">
                <CardHeader className="p-4 border-b border-border/60">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Leave Days by Category
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Statutory breakdown of annual, medical, study, and compassionate days
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={analytics?.byType || []}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          formatter={(value: any) => [`${value} days taken`, "Days"]}
                          contentStyle={{ backgroundColor: "rgba(255,255,255,0.95)", borderRadius: "8px", fontSize: "12px" }}
                        />
                        <Bar dataKey="daysTaken" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Departmental Leave Summary */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="p-4 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Departmental Absence Allocation & Pending Requests
                </CardTitle>
                <CardDescription className="text-xs">
                  Monitoring operational availability and duty coverage across divisions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(analytics?.byDepartment || []).map((dept, index) => (
                    <div
                      key={index}
                      className="p-3.5 rounded-lg border border-border/70 bg-card/60 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-xs text-foreground">{dept.departmentName || "General Division"}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{dept.daysTaken} days taken in 2026</p>
                      </div>
                      <div className="text-right">
                        {dept.pendingRequests > 0 ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                            {dept.pendingRequests} Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                            All Processed
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ABSENCE CALENDAR */}
          <TabsContent value="calendar" className="space-y-4">
            <Card className="shadow-xs border-border/80">
              <CardHeader className="p-4 border-b border-border/60">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
                      }
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-bold text-sm text-foreground px-2">{monthYearDisplay}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
                      }
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-primary"
                      onClick={() => setCalendarMonth(new Date())}
                    >
                      Current Month
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={calendarDeptFilter} onValueChange={setCalendarDeptFilter}>
                      <SelectTrigger className="w-48 h-8 text-xs bg-background">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {uniqueDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                {/* 7-day header */}
                <div className="grid grid-cols-7 text-center font-semibold text-xs text-muted-foreground border-b border-border/60 pb-2 mb-2">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span className="text-rose-500">Sat</span>
                  <span className="text-rose-500">Sun</span>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarData.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="h-24 bg-muted/20 rounded-md border border-dashed border-border/40" />;
                    }

                    const isToday = cell.dateKey === new Date().toISOString().slice(0, 10);

                    return (
                      <div
                        key={cell.dateKey}
                        className={`h-28 p-1.5 rounded-md border text-xs flex flex-col justify-between transition-colors overflow-hidden ${
                          isToday
                            ? "border-primary bg-primary/5"
                            : cell.holiday
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-card border-border/70 hover:border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold ${
                              isToday
                                ? "w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                                : cell.holiday
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-foreground"
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                          {cell.holiday && (
                            <span className="text-[9px] font-semibold text-amber-700 truncate max-w-[70px]" title={cell.holiday.name}>
                              {cell.holiday.name}
                            </span>
                          )}
                        </div>

                        {/* List of active leaves for this day */}
                        <div className="space-y-1 overflow-y-auto max-h-20 pt-1">
                          {cell.requests.slice(0, 3).map((req) => (
                            <div
                              key={req.id}
                              onClick={() => setSelectedRequestDetails(req)}
                              className={`cursor-pointer px-1 py-0.5 rounded text-[10px] font-medium truncate ${
                                req.status === "approved"
                                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              }`}
                              title={`${req.employeeName} (${req.leaveTypeName}) - ${req.reason}`}
                            >
                              {req.employeeName.split(" ")[0]} • {req.leaveTypeName.split(" ")[0]}
                            </div>
                          ))}
                          {cell.requests.length > 3 && (
                            <span className="text-[9px] text-muted-foreground block text-center">
                              +{cell.requests.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: ALL STAFF BALANCES (HR / ADMIN VIEW) */}
          {canApprove && (
            <TabsContent value="balances" className="space-y-4">
              <Card className="shadow-xs border-border/80">
                <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Staff Entitlements & Remaining Balances Ledger</CardTitle>
                    <CardDescription className="text-xs">
                      Comprehensive organization-wide leave ledger with allocated, taken, and pending balances
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setIsAdjustmentOpen(true)} className="h-8 text-xs">
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                    New Balance Adjustment
                  </Button>
                </CardHeader>
                <CardContent className="p-4">
                  <DataTable<LeaveBalance>
                    columns={balanceColumns}
                    rows={allStaffBalances}
                    getRowId={(b) => b.id}
                    isLoading={isLoadingAllBalances}
                    exportFilename="nisit-staff-leave-balances"
                    tableId="nisit-balances-table"
                    searchPlaceholder="Search staff by name or payroll number..."
                  />
                </CardContent>
              </Card>

              {/* Adjustments Audit Ledger */}
              <Card className="shadow-xs border-border/80">
                <CardHeader className="p-4 border-b border-border/60">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Balance Adjustments Audit Trail
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Record of authorized annual rollovers, carry-overs, and policy balance adjustments
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {isLoadingAdjustments ? (
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : adjustments.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No manual balance adjustments recorded yet.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                        <tr>
                          <th className="p-3 pl-6">Officer Name</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Days</th>
                          <th className="p-3">Reason / Remarks</th>
                          <th className="p-3">Authorized By</th>
                          <th className="p-3 pr-6 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {adjustments.map((adj) => (
                          <tr key={adj.id} className="hover:bg-muted/30">
                            <td className="p-3 pl-6 font-medium text-foreground">{adj.employeeName}</td>
                            <td className="p-3">{adj.leaveTypeName}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {adj.adjustmentType}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold text-primary">
                              {parseFloat(adj.adjustmentDays) > 0 ? `+${adj.adjustmentDays}` : adj.adjustmentDays} d
                            </td>
                            <td className="p-3 text-muted-foreground max-w-xs truncate">{adj.reason}</td>
                            <td className="p-3 text-muted-foreground">{adj.authorizedByName || "System Admin"}</td>
                            <td className="p-3 pr-6 text-right text-muted-foreground whitespace-nowrap">
                              {new Date(adj.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TAB 5: STATUTORY HOLIDAYS & POLICY */}
          <TabsContent value="policies" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 2026 PNG Statutory Holidays */}
              <Card className="shadow-xs border-border/80">
                <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      Papua New Guinea Statutory Public Holidays (2026)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Official non-working days automatically excluded from leave calculations
                    </CardDescription>
                  </div>
                  {canApprove && (
                    <Button size="sm" variant="outline" onClick={() => setIsHolidayOpen(true)} className="h-8 text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Holiday
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                      <tr>
                        <th className="p-3 pl-6">Holiday Name</th>
                        <th className="p-3">Official Date</th>
                        <th className="p-3">Observance</th>
                        <th className="p-3 pr-6 text-right">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {holidays.map((h) => (
                        <tr key={h.id} className="hover:bg-muted/30">
                          <td className="p-3 pl-6 font-semibold text-foreground">{h.name}</td>
                          <td className="p-3 font-mono text-muted-foreground">{h.date}</td>
                          <td className="p-3 text-muted-foreground text-[11px]">{h.notes || "Official Public Holiday"}</td>
                          <td className="p-3 pr-6 text-right">
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">
                              Statutory
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* NISIT General Orders Leave Policies */}
              <Card className="shadow-xs border-border/80">
                <CardHeader className="p-4 border-b border-border/60">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-primary" />
                    NISIT Leave Governance & Entitlement Rules
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Standard entitlements per Public Service General Orders & Staff Handbook
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  {leaveTypes.map((type) => (
                    <div key={type.id} className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{type.name}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="font-bold">
                            {type.defaultDays} Days / Year
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            Max Carry: {type.carryOverMax}d
                          </Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{type.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* APPLY FOR LEAVE MODAL */}
        <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleApply}>
              <DialogHeader>
                <DialogTitle>Submit Leave Application</DialogTitle>
                <DialogDescription>
                  Apply for scheduled absence with automated working-days calculation and relief officer coverage.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                {/* Staff Member Selector (HR / Manager can apply on behalf) */}
                <div>
                  <label className="font-medium text-foreground block mb-1">Staff Member *</label>
                  <SearchableSelect
                    value={selectedEmployeeId || (employees[0]?.id ? String(employees[0].id) : "")}
                    onValueChange={setSelectedEmployeeId}
                    options={staffSelectOptions}
                    placeholder="Search or select staff member..."
                    searchPlaceholder="Search staff by name, position, or ID..."
                  />
                </div>

                {/* Leave Entitlement Category */}
                <div>
                  <label className="font-medium text-foreground block mb-1">Leave Category *</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select leave category" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.defaultDays} days standard)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration & Period Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Start Date *</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">End Date *</label>
                    <Input
                      type="date"
                      min={startDate || undefined}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Period Type</label>
                    <Select value={leavePeriodType} onValueChange={setLeavePeriodType}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_day">Full Working Day</SelectItem>
                        <SelectItem value="half_day_am">Half Day (Morning)</SelectItem>
                        <SelectItem value="half_day_pm">Half Day (Afternoon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Automatic Working Days Breakdown Alert */}
                {startDate && endDate && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        Calculated Working Days:
                      </span>
                      <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                        {calculatedDaysBreakdown.workingDays} Working Days
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Total calendar period: {calculatedDaysBreakdown.calendarDays} days • Excluded:{" "}
                      {calculatedDaysBreakdown.weekendDays} weekend days & {calculatedDaysBreakdown.holidayDays} statutory public
                      holidays.
                    </p>
                  </div>
                )}

                {/* Relief / Handover Officer */}
                <div>
                  <label className="font-medium text-foreground block mb-1">
                    Designated Relief / Handover Officer
                  </label>
                  <SearchableSelect
                    value={handoverEmployeeId}
                    onValueChange={setHandoverEmployeeId}
                    options={reliefOfficerOptions}
                    placeholder="Search or select relief colleague..."
                    searchPlaceholder="Search colleague by name or position..."
                  />
                </div>

                {/* Emergency Contact & Medical Cert */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Emergency Contact Phone / Details</label>
                    <Input
                      placeholder="+675 7... or alternative location"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Medical Certificate # (If Sick Leave)</label>
                    <Input
                      placeholder="Doctor / Clinic Reference Number"
                      value={medicalCertNumber}
                      onChange={(e) => setMedicalCertNumber(e.target.value)}
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="font-medium text-foreground block mb-1">Purpose & Handover Plan *</label>
                  <Textarea
                    placeholder="State reason for absence and brief handover instructions..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsApplyOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* REVIEW APPROVAL MODAL */}
        <Dialog
          open={reviewDialog.open}
          onOpenChange={(open) => !open && setReviewDialog({ ...reviewDialog, open: false })}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {reviewDialog.status === "approved" ? "Approve Leave Application" : "Reject Leave Application"}
              </DialogTitle>
              <DialogDescription>
                {reviewDialog.request?.employeeName} • {reviewDialog.request?.days} working days (
                {reviewDialog.request?.leaveTypeName})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Duration:</span> {reviewDialog.request?.startDate} to{" "}
                  {reviewDialog.request?.endDate}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Relief Officer:</span>{" "}
                  {reviewDialog.request?.handoverEmployeeName || "None assigned"}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Reason:</span> {reviewDialog.request?.reason}
                </p>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1.5">Approver Remarks (Optional)</label>
                <Textarea
                  placeholder="Provide handover instructions or formal notes..."
                  value={reviewDialog.comment}
                  onChange={(e) => setReviewDialog({ ...reviewDialog, comment: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog({ ...reviewDialog, open: false })}>
                Cancel
              </Button>
              <Button
                variant={reviewDialog.status === "approved" ? "default" : "destructive"}
                onClick={() => {
                  if (reviewDialog.request) {
                    updateStatusMutation.mutate({
                      id: reviewDialog.request.id,
                      status: reviewDialog.status,
                      approverComment: reviewDialog.comment,
                    });
                  }
                }}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Processing..." : `Confirm ${reviewDialog.status === "approved" ? "Approval" : "Rejection"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DETAILS MODAL */}
        <Dialog
          open={!!selectedRequestDetails}
          onOpenChange={(open) => !open && setSelectedRequestDetails(null)}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Leave Application Details</span>
                {selectedRequestDetails && getStatusBadge(selectedRequestDetails.status)}
              </DialogTitle>
              <DialogDescription>
                Reference #{selectedRequestDetails?.id} • Submitted on{" "}
                {selectedRequestDetails?.createdAt
                  ? new Date(selectedRequestDetails.createdAt).toLocaleDateString()
                  : "—"}
              </DialogDescription>
            </DialogHeader>

            {selectedRequestDetails && (
              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-semibold">Staff Member</p>
                    <p className="font-bold text-foreground text-sm">{selectedRequestDetails.employeeName}</p>
                    <p className="text-muted-foreground">{selectedRequestDetails.departmentName || "General Division"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-semibold">Leave Category</p>
                    <p className="font-bold text-foreground text-sm">{selectedRequestDetails.leaveTypeName}</p>
                    <p className="text-muted-foreground font-mono">{selectedRequestDetails.days} Working Days</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground text-[10px] uppercase font-semibold">Absence Period</p>
                    <p className="font-medium text-foreground mt-1">
                      {selectedRequestDetails.startDate} to {selectedRequestDetails.endDate}
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground text-[10px] uppercase font-semibold">Relief / Handover Officer</p>
                    <p className="font-medium text-foreground mt-1">
                      {selectedRequestDetails.handoverEmployeeName || "No relief officer assigned"}
                    </p>
                  </div>
                </div>

                <div className="p-3 border rounded-lg space-y-1">
                  <p className="text-muted-foreground text-[10px] uppercase font-semibold">Purpose & Handover Notes</p>
                  <p className="text-foreground">{selectedRequestDetails.reason}</p>
                </div>

                {(selectedRequestDetails.emergencyContact || selectedRequestDetails.medicalCertificateNumber) && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg">
                    {selectedRequestDetails.emergencyContact && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Emergency Contact</span>
                        <p className="font-medium text-foreground">{selectedRequestDetails.emergencyContact}</p>
                      </div>
                    )}
                    {selectedRequestDetails.medicalCertificateNumber && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Medical Certificate</span>
                        <p className="font-mono font-medium text-foreground">{selectedRequestDetails.medicalCertificateNumber}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedRequestDetails.approverComment && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-1">
                    <p className="text-primary font-semibold text-[11px]">Approver Decision Remarks</p>
                    <p className="text-foreground">{selectedRequestDetails.approverComment}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRequestDetails(null)}>
                Close
              </Button>
              {selectedRequestDetails?.status === "pending" && canApprove && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setReviewDialog({
                        open: true,
                        request: selectedRequestDetails,
                        status: "rejected",
                        comment: "",
                      });
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setReviewDialog({
                        open: true,
                        request: selectedRequestDetails,
                        status: "approved",
                        comment: "",
                      });
                    }}
                  >
                    Approve Request
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ADJUST BALANCE MODAL */}
        <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleAdjustmentSubmit}>
              <DialogHeader>
                <DialogTitle>Authorize Leave Balance Adjustment</DialogTitle>
                <DialogDescription>
                  Record an official audit ledger entry to credit, carry over, or adjust staff leave days.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Staff Member *</label>
                  <SearchableSelect
                    value={adjEmployeeId}
                    onValueChange={setAdjEmployeeId}
                    options={staffSelectOptions}
                    placeholder="Search or select staff member..."
                    searchPlaceholder="Search staff by name, position, or ID..."
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Leave Category *</label>
                  <Select value={adjLeaveTypeId} onValueChange={setAdjLeaveTypeId} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select leave entitlement" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Adjustment Type *</label>
                    <Select value={adjType} onValueChange={setAdjType}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accrual">Annual Accrual</SelectItem>
                        <SelectItem value="carry_over">Rollover / Carry Over</SelectItem>
                        <SelectItem value="correction">Audit Correction</SelectItem>
                        <SelectItem value="credit">Discretionary Credit</SelectItem>
                        <SelectItem value="debit">Leave Debit / Deduction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Days (+ / -) *</label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 5 or -2"
                      value={adjDays}
                      onChange={(e) => setAdjDays(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Authorization Reference / Reason *</label>
                  <Textarea
                    placeholder="Enter HR minute reference or reason for adjustment..."
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    rows={2}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAdjustmentOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adjustmentMutation.isPending}>
                  {adjustmentMutation.isPending ? "Recording..." : "Authorize Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ADD PUBLIC HOLIDAY MODAL */}
        <Dialog open={isHolidayOpen} onOpenChange={setIsHolidayOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleHolidaySubmit}>
              <DialogHeader>
                <DialogTitle>Add Statutory Public Holiday</DialogTitle>
                <DialogDescription>
                  Register a statutory or agency holiday to automatically exclude it from leave duration counts.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Holiday Name *</label>
                  <Input
                    placeholder="e.g. National Day of Worship"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Holiday Date *</label>
                  <Input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Notes / Gazetted Reference</label>
                  <Input
                    placeholder="Gazette notice or statutory reference"
                    value={holidayNotes}
                    onChange={(e) => setHolidayNotes(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsHolidayOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={holidayMutation.isPending}>
                  {holidayMutation.isPending ? "Saving..." : "Add Public Holiday"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
