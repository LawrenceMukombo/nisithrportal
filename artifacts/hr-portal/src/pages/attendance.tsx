import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MapPin,
  LogIn,
  LogOut,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Timer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Smartphone,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Radio,
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: "present" | "late" | "absent" | "half_day" | "excused";
  lateMinutes: number | null;
  earlyDepartureMinutes: number | null;
  location: string | null;
  source: string | null;
  notes: string | null;
  overtimeMinutes?: number | null;
  overtimeStatus?: "none" | "pending_approval" | "approved" | "rejected" | null;
  overtimeApprovedBy?: number | null;
  overtimeApprovedAt?: string | null;
  createdAt: string;
}

export default function AttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isHR, isApplicant } = useRole();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<"name" | "date" | "clockIn" | "clockOut" | "status" | "variance">("date");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmployeeId, setManualEmployeeId] = useState<string>("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualClockIn, setManualClockIn] = useState("08:00");
  const [manualClockOut, setManualClockOut] = useState("16:06");
  const [manualStatus, setManualStatus] = useState("present");
  const [manualNotes, setManualNotes] = useState("");

  const [kioskModalOpen, setKioskModalOpen] = useState(false);
  const [kioskToken, setKioskToken] = useState("NISIT_TOTP_INIT_2026");
  const [kioskExpires, setKioskExpires] = useState(15);
  const [kioskScanResult, setKioskScanResult] = useState<string | null>(null);
  const [isScanningKiosk, setIsScanningKiosk] = useState(false);

  useEffect(() => {
    if (!kioskModalOpen) return;
    const fetchToken = async () => {
      try {
        const res = await fetch("/api/clocking/kiosk/token", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setKioskToken(data.token);
          setKioskExpires(data.expiresInSeconds || 15);
        }
      } catch {
        // fallback
      }
    };
    fetchToken();
    const interval = setInterval(fetchToken, 10000);
    return () => clearInterval(interval);
  }, [kioskModalOpen]);

  const [kioskBadgeInput, setKioskBadgeInput] = useState("");
  const handleKioskScan = async (badgeOverride?: string) => {
    setIsScanningKiosk(true);
    setKioskScanResult(null);
    try {
      const identifier = (badgeOverride || kioskBadgeInput).trim();
      const res = await fetch("/api/clocking/kiosk/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          token: kioskToken,
          kioskLocation: "NISIT HQ Main Turnstile",
          employeeIdentifier: identifier || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setKioskScanResult(`Success: ${data.message || "Clocking punch confirmed!"}`);
        setKioskBadgeInput("");
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      } else {
        setKioskScanResult(`Error: ${data.error || "Scan failed"}`);
      }
    } catch (err: any) {
      setKioskScanResult(`Error: ${err.message || "Request failed"}`);
    } finally {
      setIsScanningKiosk(false);
    }
  };

  const { data: rawEmployees = [] } = useGetEmployees(undefined, {
    query: { queryKey: getGetEmployeesQueryKey() },
  });
  const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

  const employeeOptions = useMemo(
    () =>
      employees.map((emp: any) => ({
        value: String(emp.id),
        label: `${emp.name} (${emp.position?.title || `Staff #${emp.id}`})`,
        searchTerms: `${emp.name} ${emp.employeeNumber || ""} ${emp.position?.title || ""} ${emp.email || ""}`,
      })),
    [employees]
  );

  // Keep live clock updated
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch Attendance Records
  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance"],
    queryFn: async () => {
      const res = await fetch("/api/attendance", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Resolve logged-in staff member profile
  const currentEmployee = useMemo(() => {
    if (!user?.email && !user?.userId) return null;
    return (
      employees.find(
        (e: any) =>
          (user?.email && e.email?.toLowerCase() === user.email.toLowerCase()) ||
          (user?.userId && e.userId === user.userId)
      ) || null
    );
  }, [employees, user]);

  const currentEmpId = currentEmployee?.id;

  // Today's record for active user (scoped to current staff profile to avoid cross-user bleed)
  const todayRecord = useMemo(() => {
    if (!currentEmpId) return null;
    return records.find((r) => r.date === todayStr && r.employeeId === currentEmpId) || null;
  }, [records, todayStr, currentEmpId]);

  // Overtime Approval Mutation
  const overtimeMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const res = await fetch(`/api/attendance/${id}/overtime`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ overtimeStatus: status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update overtime status");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({
        title: "Overtime Updated",
        description: `Overtime status marked as ${variables.status}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Overtime Update Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Clock In Mutation
  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          location: "NISIT HQ Port Moresby (Web Portal)",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Clock-in failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({
        title: "Clock-In Recorded",
        description: `Logged in at ${new Date(data.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. ${data.status === "late" ? `(Late by ${data.lateMinutes} mins)` : "Punctual!"}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Clock-In Failed", description: err.message, variant: "destructive" });
    },
  });

  // Clock Out Mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ notes: "Standard sign out" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Clock-out failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({
        title: "Clock-Out Recorded",
        description: `Signed out at ${new Date(data.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Have a good evening!`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Clock-Out Failed", description: err.message, variant: "destructive" });
    },
  });

  // Manual Log Mutation
  const manualMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create manual entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Success", description: "Manual attendance record saved." });
      setManualOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveEmployeeId = manualEmployeeId
      ? parseInt(manualEmployeeId)
      : (employees[0]?.id ? employees[0].id : 1);
    manualMutation.mutate({
      employeeId: effectiveEmployeeId,
      date: manualDate,
      clockIn: manualClockIn ? `${manualDate}T${manualClockIn}:00` : null,
      clockOut: manualClockOut ? `${manualDate}T${manualClockOut}:00` : null,
      status: manualStatus,
      notes: manualNotes,
    });
  };

  // KPIs
  const totalDays = records.length;
  const presentCount = records.filter((r) => r.status === "present").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const punctualityRate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100;

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
        r.notes?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchDate = !dateFilter || r.date === dateFilter;
      return matchSearch && matchStatus && matchDate;
    });
  }, [records, search, statusFilter, dateFilter]);

  const handleSort = (field: "name" | "date" | "clockIn" | "clockOut" | "status" | "variance") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPage(1);
  };

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      if (sortField === "name") {
        valA = (a.employeeName || "").toLowerCase();
        valB = (b.employeeName || "").toLowerCase();
      } else if (sortField === "date") {
        valA = a.date || "";
        valB = b.date || "";
      } else if (sortField === "clockIn") {
        valA = a.clockIn || "";
        valB = b.clockIn || "";
      } else if (sortField === "clockOut") {
        valA = a.clockOut || "";
        valB = b.clockOut || "";
      } else if (sortField === "status") {
        valA = a.status || "";
        valB = b.status || "";
      } else if (sortField === "variance") {
        valA = a.lateMinutes || 0;
        valB = b.lateMinutes || 0;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = sortedRecords.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const headers = [
      "Officer Name",
      "Date",
      "Clock In",
      "Clock Out",
      "Status",
      "Late Minutes",
      "Overtime Minutes",
      "Overtime Status",
      "Location",
      "Source",
      "Notes",
    ];
    const rows = sortedRecords.map((r) => [
      `"${(r.employeeName || "Active Officer").replace(/"/g, '""')}"`,
      `"${r.date}"`,
      `"${r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : '—'}"`,
      `"${r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : '—'}"`,
      `"${r.status}"`,
      `"${r.lateMinutes || 0}"`,
      `"${r.overtimeMinutes || 0}"`,
      `"${r.overtimeStatus || "none"}"`,
      `"${(r.location || "NISIT HQ").replace(/"/g, '""')}"`,
      `"${r.source || "web"}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NISIT_Attendance_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Punctual</Badge>;
      case "late":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Late Arrival</Badge>;
      case "excused":
        return <Badge variant="outline">Excused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendance & Time Tracking</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Digital Punch Clock
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Log daily office attendance, record field activities, and monitor statutory punctuality
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setKioskModalOpen(true)}
              className="bg-primary/5 hover:bg-primary/10 border-primary/30 text-primary shadow-sm"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Smart Kiosk & Mobile Clocking
            </Button>
            {(isAdmin || isHR) && (
              <Button variant="outline" onClick={() => setManualOpen(true)} className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Manual Log Entry
              </Button>
            )}
          </div>
        </div>

        {/* Live Punch Clock Widget & Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Punch Clock Card */}
          <Card className="lg:col-span-1 bg-gradient-to-b from-card to-muted/30 border-primary/20 shadow-md">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Live Digital Punch Clock
                </CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                  PNG Standard Time
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Official Working Hours: 08:00 – 16:06 (Monday to Friday)
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-2 space-y-4">
              {/* Clock Display */}
              <div className="text-center py-4 bg-background/80 backdrop-blur rounded-xl border border-border/80 shadow-inner">
                <p className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-foreground">
                  {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-2">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>NISIT HQ, Port Moresby</span>
                </div>
              </div>

              {/* Punch Actions */}
              <div className="space-y-2">
                {isApplicant ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center space-y-1">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Applicant Account
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Daily time tracking and punch clock logging are reserved for active PNG NISIT employees and staff members.
                    </p>
                  </div>
                ) : !todayRecord?.clockIn ? (
                  <Button
                    onClick={() => clockInMutation.mutate()}
                    disabled={clockInMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm h-11"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    {clockInMutation.isPending ? "Recording..." : "Clock In for Today"}
                  </Button>
                ) : !todayRecord?.clockOut ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                      <span>Clocked in at:</span>
                      <span className="font-bold">
                        {new Date(todayRecord.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <Button
                      onClick={() => clockOutMutation.mutate()}
                      disabled={clockOutMutation.isPending}
                      variant="outline"
                      className="w-full border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-semibold h-11"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      {clockOutMutation.isPending ? "Recording..." : "Clock Out (End Shift)"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/60 rounded-xl text-center space-y-1 text-xs">
                    <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-600" />
                    <p className="font-semibold text-foreground">Shift Completed</p>
                    <p className="text-muted-foreground">
                      In: {new Date(todayRecord.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Out:{" "}
                      {new Date(todayRecord.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Metrics */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-card border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Punctuality Score</p>
                    <p className="text-3xl font-extrabold text-foreground mt-1">{punctualityRate}%</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">Target: &ge; 95%</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Late Arrivals</p>
                    <p className="text-3xl font-extrabold text-foreground mt-1">{lateCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Recorded this period</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-l-4 border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Present Logs</p>
                    <p className="text-3xl font-extrabold text-foreground mt-1">{presentCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Verified workdays</p>
                  </div>
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Timer className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Guidelines Card */}
            <Card className="sm:col-span-3 bg-muted/20 border-border/70">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-foreground">General Orders Attendance Policy</p>
                  <p className="text-muted-foreground mt-0.5">
                    Arrivals after 08:15 AM are automatically flagged as late arrivals. For field calibration duties, submit a travel approval.
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit text-xs font-normal">
                  Public Services Act Compliance
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Attendance History Table */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 border-b border-border/60">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search staff, notes, location..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 bg-background"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-40 text-xs bg-background"
                />

                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-36 text-xs bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Logs</SelectItem>
                    <SelectItem value="present">Punctual</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCsv}
                  className="text-xs h-9 text-emerald-600 border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : paginatedRecords.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <p className="text-base font-semibold text-foreground">No attendance records found</p>
                <p className="text-xs text-muted-foreground">Clock in above or adjust search filters.</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                  <tr>
                    <th 
                      onClick={() => handleSort("name")}
                      className="p-3.5 pl-6 cursor-pointer hover:text-foreground transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Officer Name</span>
                        {sortField === "name" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("date")}
                      className="p-3.5 cursor-pointer hover:text-foreground transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Date</span>
                        {sortField === "date" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("clockIn")}
                      className="p-3.5 cursor-pointer hover:text-foreground transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Clock In</span>
                        {sortField === "clockIn" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("clockOut")}
                      className="p-3.5 cursor-pointer hover:text-foreground transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Clock Out</span>
                        {sortField === "clockOut" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("status")}
                      className="p-3.5 cursor-pointer hover:text-foreground transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        {sortField === "status" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("variance")}
                      className="p-3.5 cursor-pointer hover:text-foreground transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Variance</span>
                        {sortField === "variance" ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="p-3.5">Location & Source</th>
                    <th className="p-3.5 pr-6 text-right">Overtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 pl-6 font-semibold text-foreground">{r.employeeName || "Active Officer"}</td>
                      <td className="p-3.5 font-medium">{r.date}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {r.clockIn ? new Date(r.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {r.clockOut ? new Date(r.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="p-3.5">{getStatusBadge(r.status)}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {r.lateMinutes && r.lateMinutes > 0 ? (
                          <span className="text-amber-600 font-medium">+{r.lateMinutes} min late</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">On time</span>
                        )}
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        <span className="block truncate max-w-xs">{r.location || "NISIT HQ"}</span>
                        <span className="text-[10px] text-muted-foreground/80 uppercase">Source: {r.source || "web"}</span>
                      </td>
                      <td className="p-3.5 pr-6 text-right">
                        {r.overtimeMinutes && r.overtimeMinutes > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-semibold text-foreground">
                              +{r.overtimeMinutes}m OT
                            </span>
                            {r.overtimeStatus === "approved" ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                Approved
                              </Badge>
                            ) : r.overtimeStatus === "rejected" ? (
                              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                                Rejected
                              </Badge>
                            ) : (isAdmin || isHR) ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px] text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 border-emerald-500/40"
                                  disabled={overtimeMutation.isPending}
                                  onClick={() => overtimeMutation.mutate({ id: r.id, status: "approved" })}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10 border-destructive/40"
                                  disabled={overtimeMutation.isPending}
                                  onClick={() => overtimeMutation.mutate({ id: r.id, status: "rejected" })}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                Pending
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            {sortedRecords.length > 0 && (
              <div className="p-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedRecords.length)} of{" "}
                    {sortedRecords.length} records
                  </span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-muted-foreground">Rows:</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-16 h-7 text-xs bg-background">
                        <SelectValue placeholder="10" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    className="h-8 w-8 p-0"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8 w-8 p-0"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-2 font-medium text-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 w-8 p-0"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    className="h-8 w-8 p-0"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Log Modal */}
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleManualSubmit}>
              <DialogHeader>
                <DialogTitle>Add Manual Attendance Record</DialogTitle>
                <DialogDescription>
                  Record attendance exception, field work, or retrospective manual adjustment.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Staff Member *</label>
                  <SearchableSelect
                    value={manualEmployeeId || (employees[0]?.id ? String(employees[0].id) : "")}
                    onValueChange={setManualEmployeeId}
                    options={employeeOptions}
                    placeholder="Search or select employee..."
                    searchPlaceholder="Search employee by name, position, or ID..."
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Date *</label>
                  <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Clock In Time</label>
                    <Input type="time" value={manualClockIn} onChange={(e) => setManualClockIn(e.target.value)} />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Clock Out Time</label>
                    <Input type="time" value={manualClockOut} onChange={(e) => setManualClockOut(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Status Classification *</label>
                  <Select value={manualStatus} onValueChange={setManualStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present (Punctual)</SelectItem>
                      <SelectItem value="late">Late Arrival</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="excused">Excused Duty / Field Trip</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Notes / Reason</label>
                  <Textarea
                    placeholder="Provide justification or reference memo number..."
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={manualMutation.isPending}>
                  {manualMutation.isPending ? "Saving..." : "Save Record"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Smart Kiosk & Mobile Clocking Modal */}
        <Dialog open={kioskModalOpen} onOpenChange={setKioskModalOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <QrCode className="w-3.5 h-3.5 mr-1" />
                  TOTP Dynamic Kiosk
                </Badge>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                  Live Terminal Active
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold mt-1">NISIT Smart Attendance & Kiosk Terminal</DialogTitle>
              <DialogDescription>
                Scan dynamic TOTP token using staff smartphone, or launch dedicated fullscreen terminal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Dynamic QR Display */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-muted/50 to-muted/20 border border-border text-center space-y-3">
                <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl shadow-md border flex flex-col items-center justify-center relative">
                  <QrCode className="w-28 h-28 text-slate-900" />
                  <span className="font-mono text-[9px] font-bold text-slate-700 tracking-wider truncate max-w-full px-2">
                    {kioskToken.substring(0, 22)}...
                  </span>
                  <Badge className="absolute -bottom-2.5 bg-white text-emerald-700 border-2 border-emerald-500/50 text-[10px] font-mono shadow-sm">
                    Refreshes in {kioskExpires}s
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  Dynamic rolling token (TOTP) prevents screenshot clock-in sharing. Rotates every 15 seconds.
                </p>
              </div>

              {/* Staff ID Badge / Contactless Card Scanner */}
              <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Staff Smart ID / Badge Verification:</span>
                  <span className="text-[10px] text-muted-foreground font-mono">e.g. EMP-001, EMP-002</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={kioskBadgeInput}
                    onChange={(e) => setKioskBadgeInput(e.target.value)}
                    placeholder="Enter staff number or swipe card..."
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleKioskScan();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isScanningKiosk}
                    onClick={() => handleKioskScan()}
                    className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isScanningKiosk ? "Verifying..." : "Verify Punch"}
                  </Button>
                </div>
              </div>

              {/* Geofence & Verification Parameters */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-card border border-border/80">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground">Spatial Geofence</span>
                  </div>
                  <p className="text-muted-foreground">NISIT HQ Gordon (200m radius)</p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/80">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold text-foreground">Anti-Spoofing</span>
                  </div>
                  <p className="text-muted-foreground">Active Geofence & Device Integrity Guard</p>
                </div>
              </div>

              {/* Scan result if triggered */}
              {kioskScanResult && (
                <div className={`p-3 rounded-xl text-xs font-medium border ${
                  kioskScanResult.startsWith("Success")
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}>
                  {kioskScanResult}
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const targetUrl =
                    window.location.port === "5173" || window.location.port === "3000"
                      ? `${window.location.protocol}//${window.location.hostname}:5174`
                      : `${window.location.origin}/attendance-app/`;
                  window.open(targetUrl, "_blank");
                }}
                className="w-full sm:w-auto text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Open Standalone App
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setKioskModalOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isScanningKiosk}
                  onClick={() => handleKioskScan()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                  {isScanningKiosk ? "Verifying..." : "Punch Active Profile"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
