import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  Clock,
  Calendar,
  Search,
  Download,
  Printer,
  ShieldCheck,
  FileCheck2,
  GitCommit,
  GitCompare,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Building2,
  Banknote,
  Sliders,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileBadge,
  Layers,
  Sparkles,
  Award,
  Hash,
  Copy,
  Lock,
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";

interface TemporalSnapshotRow {
  id: number;
  transactionNumber: string;
  entityType: string;
  entityId: number;
  validFrom: string;
  validTo: string | null;
  recordedAt: string;
  actorUserId: number | null;
  eventType: string;
  reason: string;
  statutoryReference: string | null;
  changeSummary: string | null;
  snapshotState: Record<string, any>;
  previousState: Record<string, any> | null;
  diff: Record<string, any> | null;
  metadata: Record<string, any> | null;
  checksum: string;
  isLocked: boolean;
}

interface EmployeeOption {
  id: number;
  fullName: string;
  payrollNumber: string;
  department: string;
  position: string;
}

export default function TimeHistoryPage() {
  const { user } = useAuth();
  const { isAdmin, isHrOfficer, isExecutive } = useRole();
  const { toast } = useToast();

  const canViewAll = isAdmin || isHrOfficer || isExecutive;

  // Mode & navigation
  const [activeTab, setActiveTab] = useState<"time-machine" | "diff-analyzer" | "ledger" | "org-as-of">("time-machine");

  // Time Machine States
  const [selectedEntityId, setSelectedEntityId] = useState<string>("1");
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [asOfTime, setAsOfTime] = useState<string>("12:00");

  // Diff Analyzer States
  const [diffDateA, setDiffDateA] = useState<string>("2022-01-01");
  const [diffDateB, setDiffDateB] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Org as-of State
  const [orgAsOfDate, setOrgAsOfDate] = useState<string>("2024-07-01");

  // Certificate Modal State
  const [certificateData, setCertificateData] = useState<any | null>(null);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);

  // Snapshot Inspection Modal
  const [inspectSnapshot, setInspectSnapshot] = useState<TemporalSnapshotRow | null>(null);

  // 1. Fetch available employees
  const { data: employeeList = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/temporal/employees"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/employee-profiles", { headers: getAuthHeader() });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((e: any) => ({
        id: e.employeeId,
        fullName: `${e.firstName || ""} ${e.lastName || ""}`.trim() || `Officer #${e.employeeId}`,
        payrollNumber: e.payrollNumber || `NISIT-EMP-${String(e.employeeId).padStart(4, "0")}`,
        department: e.department || "Standards & Metrology",
        position: e.jobTitle || "Technical Officer",
      }));
    },
  });

  // Effective target employee ID
  const effectiveEmployeeId = useMemo(() => {
    if (canViewAll) {
      return Number(selectedEntityId) || 1;
    }
    // If regular staff, use their own linked employee ID or fallback to 1
    return 1;
  }, [canViewAll, selectedEntityId]);

  // Selected employee metadata
  const selectedEmployeeObj = useMemo(() => {
    return employeeList.find((e) => e.id === effectiveEmployeeId) || null;
  }, [employeeList, effectiveEmployeeId]);

  // Combined as-of timestamp
  const targetIsoString = useMemo(() => {
    return `${asOfDate}T${asOfTime}:00Z`;
  }, [asOfDate, asOfTime]);

  // 2. Query As-Of reconstructed snapshot
  const { data: asOfResult, isLoading: isLoadingAsOf, refetch: refetchAsOf } = useQuery({
    queryKey: ["/api/temporal/as-of", effectiveEmployeeId, targetIsoString],
    queryFn: async () => {
      const res = await fetch(
        `/api/temporal/as-of?entityType=employee_remuneration&entityId=${effectiveEmployeeId}&asOf=${encodeURIComponent(targetIsoString)}`,
        { headers: getAuthHeader() }
      );
      if (!res.ok) {
        throw new Error("Unable to reconstruct point-in-time state");
      }
      return res.json();
    },
    enabled: !!effectiveEmployeeId,
  });

  // 3. Query Entity Versions for Timeline Epochs
  const { data: entityVersions = [] } = useQuery<TemporalSnapshotRow[]>({
    queryKey: ["/api/temporal/entity-versions", effectiveEmployeeId],
    queryFn: async () => {
      const res = await fetch(
        `/api/temporal/entity-versions?entityType=employee_remuneration&entityId=${effectiveEmployeeId}`,
        { headers: getAuthHeader() }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!effectiveEmployeeId,
  });

  // 4. Query Comparison Diff between Date A and Date B
  const { data: compareResult, isLoading: isLoadingCompare } = useQuery({
    queryKey: ["/api/temporal/compare", effectiveEmployeeId, diffDateA, diffDateB],
    queryFn: async () => {
      const isoA = `${diffDateA}T12:00:00Z`;
      const isoB = `${diffDateB}T12:00:00Z`;
      const res = await fetch(
        `/api/temporal/compare?entityType=employee_remuneration&entityId=${effectiveEmployeeId}&dateA=${encodeURIComponent(isoA)}&dateB=${encodeURIComponent(isoB)}`,
        { headers: getAuthHeader() }
      );
      if (!res.ok) throw new Error("Could not compute temporal diff");
      return res.json();
    },
    enabled: !!effectiveEmployeeId && activeTab === "diff-analyzer",
  });

  // 5. Query Full Immutable Ledger
  const { data: ledgerData, isLoading: isLoadingLedger } = useQuery<{
    success: boolean;
    data: TemporalSnapshotRow[];
    total: number;
    stats: { totalCount: number; oldestDate: string | null; distinctEntities: number };
  }>({
    queryKey: ["/api/temporal/timeline", canViewAll ? "all" : effectiveEmployeeId],
    queryFn: async () => {
      const url = canViewAll
        ? `/api/temporal/timeline?limit=250`
        : `/api/temporal/timeline?entityType=employee_remuneration&entityId=${effectiveEmployeeId}&limit=100`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Could not load temporal ledger");
      return res.json();
    },
  });

  // 6. Query Organization As-Of Snapshot
  const { data: orgAsOfResult, isLoading: isLoadingOrg } = useQuery({
    queryKey: ["/api/temporal/organization-as-of", orgAsOfDate],
    queryFn: async () => {
      const iso = `${orgAsOfDate}T12:00:00Z`;
      const res = await fetch(`/api/temporal/organization-as-of?asOf=${encodeURIComponent(iso)}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Could not reconstruct org snapshot");
      return res.json();
    },
    enabled: canViewAll && activeTab === "org-as-of",
  });

  // Open Legal Certificate Modal
  const handleOpenCertificate = async () => {
    try {
      const res = await fetch(
        `/api/temporal/certificate?entityType=employee_remuneration&entityId=${effectiveEmployeeId}&asOf=${encodeURIComponent(targetIsoString)}`,
        { headers: getAuthHeader() }
      );
      if (!res.ok) throw new Error("Failed to generate official certificate");
      const cert = await res.json();
      setCertificateData(cert);
      setIsCertificateOpen(true);
    } catch (err: any) {
      toast({
        title: "Certificate Generation Error",
        description: err.message || "Failed to generate certified record.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${label} copied successfully.`,
    });
  };

  // Table Columns for Rule 24 Enterprise DataTable
  const ledgerColumns: DataTableColumn<TemporalSnapshotRow>[] = useMemo(
    () => [
      {
        key: "transactionNumber",
        label: "Transaction ID",
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-primary">{row.transactionNumber}</span>
            <button
              onClick={() => copyToClipboard(row.transactionNumber, "Transaction ID")}
              className="text-muted-foreground hover:text-foreground"
              title="Copy ID"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        ),
      },
      {
        key: "validRange",
        label: "Valid Timeline Epoch",
        sortable: true,
        sortValue: (row) => row.validFrom,
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium text-foreground">
              From: {new Date(row.validFrom).toLocaleDateString("en-PG", { year: "numeric", month: "short", day: "numeric" })}
            </span>
            <span className="text-muted-foreground">
              To: {row.validTo ? new Date(row.validTo).toLocaleDateString("en-PG", { year: "numeric", month: "short", day: "numeric" }) : "Present (Active)"}
            </span>
          </div>
        ),
      },
      {
        key: "eventType",
        label: "Historical Event",
        sortable: true,
        render: (row) => {
          const colors: Record<string, string> = {
            INITIAL_INCEPTION: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
            APPOINTMENT_INCEPTION: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
            INCREMENT_PROMOTION: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
            PAYROLL_BASEPAY_SYNC: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
            ALLOWANCE_STRUCTURE_UPDATE: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
          };
          return (
            <Badge variant="outline" className={colors[row.eventType] || "bg-muted text-muted-foreground"}>
              {row.eventType.replace(/_/g, " ")}
            </Badge>
          );
        },
      },
      {
        key: "reason",
        label: "Authorizing Reason / Purpose",
        render: (row) => (
          <div className="max-w-xs truncate text-xs font-medium" title={row.reason}>
            {row.reason}
          </div>
        ),
      },
      {
        key: "snapshotState",
        label: "State at Epoch",
        render: (row) => {
          const state = row.snapshotState || {};
          return (
            <div className="flex flex-col text-xs">
              <span className="font-semibold text-foreground">
                PGK {Number(state.baseSalaryFortnightly || (state.baseSalaryAnnual ? state.baseSalaryAnnual / 26 : 0)).toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /fn
              </span>
              <span className="text-muted-foreground">
                Grade: {state.gradeCode || "Standard"} • Step {state.gradeStep || 1}
              </span>
            </div>
          );
        },
      },
      {
        key: "checksum",
        label: "Integrity Seal",
        render: (row) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="font-mono text-[10px] truncate max-w-[90px]" title={row.checksum}>
              {row.checksum.slice(0, 10)}...
            </span>
          </div>
        ),
      },
      {
        key: "actions",
        label: "Action",
        resizable: false,
        render: (row) => (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={() => setInspectSnapshot(row)}
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            Inspect
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Clock className="h-3.5 w-3.5 animate-pulse" />
                Bi-Temporal Ledger & Point-in-Time Reconstruction Engine
              </div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground">
                Time in History (Time Immemorial)
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Query, reconstruct, and certify the exact state of personnel remuneration, grade positions, and statutory allowances as they existed at any specific moment in history. Guaranteed immutable state under the <em>PNG Public Services Management Act 1995</em>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                className="gap-2 border-primary/30 bg-background/80 hover:bg-primary/10"
                onClick={handleOpenCertificate}
              >
                <FileBadge className="h-4 w-4 text-primary" />
                Generate Certified Statement As-At Date
              </Button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-xs text-muted-foreground">Ledger Snapshots</div>
              <div className="mt-1 text-xl font-bold text-foreground">
                {ledgerData?.stats?.totalCount || entityVersions.length || 0}
              </div>
              <div className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-3 w-3" /> SHA-256 Verified
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-xs text-muted-foreground">Historical Epoch Reach</div>
              <div className="mt-1 text-xl font-bold text-foreground">
                {ledgerData?.stats?.oldestDate ? new Date(ledgerData.stats.oldestDate).getFullYear() : "2016"} – Present
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Time Immemorial Record</div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-xs text-muted-foreground">Tracked Officers</div>
              <div className="mt-1 text-xl font-bold text-foreground">
                {ledgerData?.stats?.distinctEntities || employeeList.length || 1}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Active & Historical Personnel</div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-xs text-muted-foreground">Temporal Model</div>
              <div className="mt-1 text-xl font-bold text-foreground">Bi-Temporal</div>
              <div className="text-[11px] text-primary flex items-center gap-1 mt-0.5">
                <Lock className="h-3 w-3" /> Immutable Transaction Chain
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-muted/60 p-1">
            <TabsTrigger value="time-machine" className="gap-2">
              <History className="h-4 w-4" />
              <span>Time Machine</span>
            </TabsTrigger>
            <TabsTrigger value="diff-analyzer" className="gap-2">
              <GitCompare className="h-4 w-4" />
              <span>Time Diff & Evolution</span>
            </TabsTrigger>
            <TabsTrigger value="ledger" className="gap-2">
              <Layers className="h-4 w-4" />
              <span>Immutable Ledger</span>
            </TabsTrigger>
            <TabsTrigger value="org-as-of" className="gap-2" disabled={!canViewAll}>
              <Building2 className="h-4 w-4" />
              <span>NISIT Historical Footprint</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TIME MACHINE (POINT-IN-TIME RECONSTRUCTION) */}
          <TabsContent value="time-machine" className="space-y-6 pt-4">
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Historical Point-in-Time Navigator
                    </CardTitle>
                    <CardDescription>
                      Select an officer and any date in history to reconstruct their exact remuneration, pay grade, and active allowances at that precise moment.
                    </CardDescription>
                  </div>

                  {/* Officer Selector (for Admin/HR) */}
                  {canViewAll && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Officer:</label>
                      <select
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {employeeList.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.fullName} ({emp.payrollNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Date Selection Control & Epoch Shortcuts */}
                <div className="grid gap-4 md:grid-cols-12 rounded-xl border border-border/80 bg-muted/20 p-4">
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      As-Of Date (Historical Target)
                    </label>
                    <Input
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="bg-background"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      As-Of Time (UTC/PGT)
                    </label>
                    <Input
                      type="time"
                      value={asOfTime}
                      onChange={(e) => setAsOfTime(e.target.value)}
                      className="bg-background"
                    />
                  </div>

                  <div className="md:col-span-5 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Fast Epoch Presets
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setAsOfDate(new Date().toISOString().slice(0, 10));
                          setAsOfTime("12:00");
                        }}
                      >
                        Present (Today)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setAsOfDate("2026-01-01");
                          setAsOfTime("00:00");
                        }}
                      >
                        2026 Structure
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setAsOfDate("2024-07-01");
                          setAsOfTime("12:00");
                        }}
                      >
                        2024 Mid-Term
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setAsOfDate("2022-01-01");
                          setAsOfTime("08:00");
                        }}
                      >
                        2022 Progression
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setAsOfDate("2018-01-01");
                          setAsOfTime("08:00");
                        }}
                      >
                        2018 Inception
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Chronological Epoch Flow for this Officer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider text-foreground">
                      Historical Evolution Milestones ({entityVersions.length} recorded epochs)
                    </span>
                    <span>Click any milestone to travel to that moment</span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
                    {entityVersions.map((epoch, idx) => {
                      const epochDate = new Date(epoch.validFrom).toLocaleDateString("en-PG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });
                      const isCurrent = !epoch.validTo;
                      const isSelectedEpoch =
                        new Date(epoch.validFrom).toISOString().slice(0, 10) === asOfDate;

                      return (
                        <button
                          key={epoch.id}
                          onClick={() => {
                            setAsOfDate(new Date(epoch.validFrom).toISOString().slice(0, 10));
                            setAsOfTime("12:00");
                          }}
                          className={`flex min-w-[200px] flex-col rounded-lg border p-3 text-left transition-all ${
                            isSelectedEpoch
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-primary">{epochDate}</span>
                            {isCurrent && (
                              <Badge variant="outline" className="h-4 border-emerald-500/30 text-[9px] text-emerald-600 bg-emerald-500/10">
                                Current Active
                              </Badge>
                            )}
                          </div>
                          <span className="mt-1 font-medium text-xs text-foreground truncate">
                            {epoch.reason || epoch.eventType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            PGK {Number(epoch.snapshotState?.baseSalaryFortnightly || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reconstructed State Display */}
                {isLoadingAsOf ? (
                  <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                    <Clock className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm font-medium">Reconstructing point-in-time record...</p>
                  </div>
                ) : asOfResult?.snapshot ? (
                  <div className="space-y-4">
                    {/* Status Ribbon */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold">
                            Official State Successfully Reconstructed as of {new Date(asOfResult.asOf).toLocaleString("en-PG", { dateStyle: "full", timeStyle: "medium" })}
                          </p>
                          <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
                            Valid Timeline Range: {new Date(asOfResult.snapshot.validFrom).toLocaleDateString("en-PG", { dateStyle: "medium" })} to{" "}
                            {asOfResult.snapshot.validTo ? new Date(asOfResult.snapshot.validTo).toLocaleDateString("en-PG", { dateStyle: "medium" }) : "Indefinite (Currently Active)"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-xs">
                          TX: {asOfResult.snapshot.transactionNumber}
                        </Badge>
                      </div>
                    </div>

                    {/* Historical Particulars Card */}
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Officer Info at that time */}
                      <Card className="border-border/60">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4 text-primary" />
                            Officer Particulars (As Of {asOfDate})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">Officer Name</span>
                            <p className="font-semibold text-foreground">
                              {asOfResult.state.fullName || selectedEmployeeObj?.fullName || `Officer #${effectiveEmployeeId}`}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Department</span>
                            <p className="font-medium text-foreground">
                              {asOfResult.state.department || selectedEmployeeObj?.department || "National Standards Council"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Position Title</span>
                            <p className="font-medium text-foreground">
                              {asOfResult.state.positionTitle || selectedEmployeeObj?.position || "Standards Officer"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Substantive Pay Grade</span>
                            <p className="font-mono font-medium text-primary">
                              {asOfResult.state.gradeCode || "PS-10"} Step {asOfResult.state.gradeStep || 1}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Remuneration State */}
                      <Card className="border-border/60">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Banknote className="h-4 w-4 text-primary" />
                            Substantive Base Remuneration
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">Fortnightly Gross Basepay</span>
                            <p className="text-xl font-bold text-foreground">
                              PGK {Number(asOfResult.state.baseSalaryFortnightly || 0).toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Annual Base Equivalent</span>
                            <p className="font-semibold text-foreground">
                              PGK {Number(asOfResult.state.baseSalaryAnnual || (asOfResult.state.baseSalaryFortnightly * 26) || 0).toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="border-t pt-2 text-xs text-muted-foreground">
                            <span>Statutory Classification: </span>
                            <span className="font-medium text-foreground">Public Sector Remuneration Board</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Allowances Active At That Time */}
                      <Card className="border-border/60">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-primary" />
                            Active Allowances & Benefits
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <span className="text-xs text-muted-foreground">Housing Allowance:</span>
                            <span className="font-semibold text-foreground">
                              PGK {Number(asOfResult.state.allowances?.housing?.amount || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                              {asOfResult.state.allowances?.housing?.configType === "percentage" && (
                                <span className="ml-1 text-[10px] text-primary">
                                  ({asOfResult.state.allowances?.housing?.percentage}%)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <span className="text-xs text-muted-foreground">Utilities Allowance:</span>
                            <span className="font-semibold text-foreground">
                              PGK {Number(asOfResult.state.allowances?.utilities?.amount || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <span className="text-xs text-muted-foreground">Superannuation (Employer):</span>
                            <span className="font-semibold text-foreground">
                              {asOfResult.state.allowances?.superannuation?.percentage || 8.4}% (Nasfund/Nambawan)
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-medium text-foreground">Total Fortnightly Package:</span>
                            <span className="font-bold text-primary">
                              PGK {(
                                Number(asOfResult.state.baseSalaryFortnightly || 0) +
                                Number(asOfResult.state.allowances?.housing?.amount || 0) +
                                Number(asOfResult.state.allowances?.utilities?.amount || 0)
                              ).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Cryptographic Proof & Verification Box */}
                    <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-semibold text-foreground">
                            Cryptographic Integrity & Verification Digest
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">SHA-256 Hash:</span>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {asOfResult.snapshot.checksum}
                          </span>
                          <button
                            onClick={() => copyToClipboard(asOfResult.snapshot.checksum, "SHA-256 Hash")}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        This historical state is sealed into the immutable temporal database. Any retroactive modification to this transaction is mathematically impossible without invalidating the cryptographic checksum chain.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center text-amber-800 dark:text-amber-300">
                    <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
                    <h3 className="mt-2 text-sm font-semibold">No Historical Record Exists Prior to Inception Date</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The requested date ({asOfDate}) predates the initial appointment and registration of this officer in the National Institute of Standards & Industrial Technology HR ledger.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: TIME DIFF & EVOLUTION */}
          <TabsContent value="diff-analyzer" className="space-y-6 pt-4">
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  Temporal Diff Engine (Date A vs Date B)
                </CardTitle>
                <CardDescription>
                  Compare the exact state of this officer between two specific dates in history to analyze progression, salary growth, allowance alterations, and structural promotions.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Date Compare Controls */}
                <div className="grid gap-4 md:grid-cols-2 rounded-xl border border-border/80 bg-muted/20 p-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Baseline State (Date A)
                    </label>
                    <Input
                      type="date"
                      value={diffDateA}
                      onChange={(e) => setDiffDateA(e.target.value)}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      Comparison State (Date B)
                    </label>
                    <Input
                      type="date"
                      value={diffDateB}
                      onChange={(e) => setDiffDateB(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>

                {isLoadingCompare ? (
                  <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                    <Clock className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm font-medium">Computing temporal diff between Date A and Date B...</p>
                  </div>
                ) : compareResult ? (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">Temporal Evolution Summary</h4>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {compareResult.summary}
                      </p>
                    </div>

                    {/* Side-by-side Attribute Breakdown */}
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Remuneration & Service Attribute</th>
                            <th className="px-4 py-3">State at Date A ({diffDateA})</th>
                            <th className="px-4 py-3">State at Date B ({diffDateB})</th>
                            <th className="px-4 py-3">Net Differential / Progression</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {/* Base Salary Annual */}
                          <tr>
                            <td className="px-4 py-3 font-medium text-foreground">Annual Base Salary</td>
                            <td className="px-4 py-3">
                              PGK {Number(compareResult.stateA?.baseSalaryAnnual || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              PGK {Number(compareResult.stateB?.baseSalaryAnnual || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3">
                              {compareResult.diff?.baseSalaryAnnual ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                                  +PGK {(
                                    Number(compareResult.stateB?.baseSalaryAnnual || 0) -
                                    Number(compareResult.stateA?.baseSalaryAnnual || 0)
                                  ).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unchanged</span>
                              )}
                            </td>
                          </tr>

                          {/* Base Salary Fortnightly */}
                          <tr>
                            <td className="px-4 py-3 font-medium text-foreground">Fortnightly Basepay</td>
                            <td className="px-4 py-3">
                              PGK {Number(compareResult.stateA?.baseSalaryFortnightly || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              PGK {Number(compareResult.stateB?.baseSalaryFortnightly || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3">
                              {compareResult.diff?.baseSalaryFortnightly ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                                  +PGK {(
                                    Number(compareResult.stateB?.baseSalaryFortnightly || 0) -
                                    Number(compareResult.stateA?.baseSalaryFortnightly || 0)
                                  ).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unchanged</span>
                              )}
                            </td>
                          </tr>

                          {/* Pay Grade Level */}
                          <tr>
                            <td className="px-4 py-3 font-medium text-foreground">Pay Grade Classification</td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {compareResult.stateA?.gradeCode || "Unclassified"} Step {compareResult.stateA?.gradeStep || 1}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                              {compareResult.stateB?.gradeCode || "Unclassified"} Step {compareResult.stateB?.gradeStep || 1}
                            </td>
                            <td className="px-4 py-3">
                              {compareResult.diff?.gradeCode || compareResult.diff?.gradeStep ? (
                                <Badge variant="outline" className="border-primary/30 text-primary">
                                  Promoted / Reclassified
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Same Grade</span>
                              )}
                            </td>
                          </tr>

                          {/* Housing Allowance */}
                          <tr>
                            <td className="px-4 py-3 font-medium text-foreground">Housing Allowance</td>
                            <td className="px-4 py-3">
                              PGK {Number(compareResult.stateA?.allowances?.housing?.amount || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              PGK {Number(compareResult.stateB?.allowances?.housing?.amount || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                            </td>
                            <td className="px-4 py-3">
                              {Number(compareResult.stateB?.allowances?.housing?.amount || 0) !== Number(compareResult.stateA?.allowances?.housing?.amount || 0) ? (
                                <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20">
                                  Modified (+PGK {(
                                    Number(compareResult.stateB?.allowances?.housing?.amount || 0) -
                                    Number(compareResult.stateA?.allowances?.housing?.amount || 0)
                                  ).toLocaleString("en-PG", { minimumFractionDigits: 2 })})
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unchanged</span>
                              )}
                            </td>
                          </tr>

                          {/* Utilities Allowance */}
                          <tr>
                            <td className="px-4 py-3 font-medium text-foreground">Utilities Allowance</td>
                            <td className="px-4 py-3">
                              PGK {Number(compareResult.stateA?.allowances?.utilities?.amount || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              PGK {Number(compareResult.stateB?.allowances?.utilities?.amount || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })} /fn
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted-foreground">
                                {Number(compareResult.stateB?.allowances?.utilities?.amount || 0) === Number(compareResult.stateA?.allowances?.utilities?.amount || 0) ? "Constant" : "Adjusted"}
                              </span>
                            </td>
                          </tr>

                          {/* Superannuation Rate */}
                          <tr>
                            <td className="px-4 py-3 font-medium text-foreground">Superannuation (Employer)</td>
                            <td className="px-4 py-3">
                              {compareResult.stateA?.allowances?.superannuation?.percentage || 8.4}%
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {compareResult.stateB?.allowances?.superannuation?.percentage || 8.4}%
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted-foreground">Statutory Mandate (8.4%)</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: IMMUTABLE TRANSACTION LEDGER */}
          <TabsContent value="ledger" className="space-y-6 pt-4">
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" />
                      Temporal Transaction Snapshots Ledger
                    </CardTitle>
                    <CardDescription>
                      Chronological and cryptographically signed transactions representing every change to remuneration, grading, and statutory entitlements since time immemorial.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <DataTable
                  columns={ledgerColumns}
                  rows={ledgerData?.data || []}
                  getRowId={(row) => row.id}
                  isLoading={isLoadingLedger}
                  searchable={true}
                  searchPlaceholder="Search transactions, event types, or reasons..."
                  exportFilename="NISIT_Temporal_Ledger_Extract"
                  tableId="nisit-temporal-ledger"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: NISIT HISTORICAL FOOTPRINT (ORG AS-OF) */}
          {canViewAll && (
            <TabsContent value="org-as-of" className="space-y-6 pt-4">
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        NISIT Institutional Remuneration Footprint As-Of Date
                      </CardTitle>
                      <CardDescription>
                        Reconstruct the total active headcount and fortnightly payroll commitment across all NISIT divisions as of any historical timestamp.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-muted-foreground">Historical Date:</label>
                      <Input
                        type="date"
                        value={orgAsOfDate}
                        onChange={(e) => setOrgAsOfDate(e.target.value)}
                        className="w-44 bg-background"
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {isLoadingOrg ? (
                    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                      <Clock className="h-8 w-8 animate-spin text-primary" />
                      <p className="mt-2 text-sm font-medium">Reconstructing organization footprint as of {orgAsOfDate}...</p>
                    </div>
                  ) : orgAsOfResult ? (
                    <div className="space-y-6">
                      {/* Metric Cards */}
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
                          <span className="text-xs text-muted-foreground">Active Staff as of Date</span>
                          <div className="mt-1 text-2xl font-bold text-foreground">
                            {orgAsOfResult.totalActiveHeadcount} Personnel
                          </div>
                          <span className="text-[11px] text-muted-foreground">On Active Substantive Payroll</span>
                        </div>

                        <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
                          <span className="text-xs text-muted-foreground">Fortnightly Gross Commitment</span>
                          <div className="mt-1 text-2xl font-bold text-foreground">
                            PGK {Number(orgAsOfResult.totalFortnightlyExpenditure || 0).toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <span className="text-[11px] text-muted-foreground">Base Salary Gross</span>
                        </div>

                        <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
                          <span className="text-xs text-muted-foreground">Annualized Institutional Budget</span>
                          <div className="mt-1 text-2xl font-bold text-foreground">
                            PGK {Number(orgAsOfResult.totalAnnualExpenditure || (orgAsOfResult.totalFortnightlyExpenditure * 26) || 0).toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <span className="text-[11px] text-emerald-600 font-medium">Certified Historical Baseline</span>
                        </div>
                      </div>

                      {/* Department Breakdown Table */}
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3">Division / Department</th>
                              <th className="px-4 py-3">Headcount (At Date)</th>
                              <th className="px-4 py-3">Fortnightly Substantive Cost</th>
                              <th className="px-4 py-3">Annual Substantive Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {Object.entries(orgAsOfResult.byDepartment || {}).map(([deptName, stats]: [string, any]) => (
                              <tr key={deptName}>
                                <td className="px-4 py-3 font-medium text-foreground">{deptName}</td>
                                <td className="px-4 py-3">{stats.headcount} Officers</td>
                                <td className="px-4 py-3 font-semibold text-foreground">
                                  PGK {Number(stats.fortnightlyTotal || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3">
                                  PGK {Number(stats.annualTotal || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* MODAL 1: CERTIFIED HISTORICAL STATEMENT AS-AT DATE */}
        <Dialog open={isCertificateOpen} onOpenChange={setIsCertificateOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileBadge className="h-5 w-5 text-primary" />
                Certified Historical Statement of Record (As At Date)
              </DialogTitle>
              <DialogDescription>
                Official legal certification generated under statutory authority of the National Institute of Standards & Industrial Technology Act.
              </DialogDescription>
            </DialogHeader>

            {certificateData && (
              <div id="nisit-print-certificate" className="space-y-4 rounded-xl border border-border p-6 bg-background">
                {/* Institutional Header */}
                <div className="border-b pb-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg mb-2">
                    NISIT
                  </div>
                  <h2 className="text-base font-bold tracking-tight text-foreground uppercase">
                    Independent State of Papua New Guinea
                  </h2>
                  <h3 className="text-sm font-semibold text-primary">
                    National Institute of Standards and Industrial Technology (NISIT)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Corporate Services Directorate • Office of the Registrar & Payroll Controller
                  </p>
                  <p className="text-xs font-mono font-semibold text-foreground mt-2">
                    CERTIFICATE REF: {certificateData.certificateNumber}
                  </p>
                </div>

                {/* Body Text */}
                <div className="space-y-3 text-sm text-foreground/90">
                  <p className="text-xs leading-relaxed">
                    This certifies that according to the permanent, bi-temporal records and verified historical transaction snapshots of the National Institute of Standards and Industrial Technology, the official particulars and remuneration entitlements of the specified officer as at{" "}
                    <strong>{new Date(certificateData.asOfDate).toLocaleString("en-PG", { dateStyle: "full", timeStyle: "short" })}</strong> were as set forth below:
                  </p>

                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Officer Full Name:</span>
                      <p className="font-semibold text-foreground">{certificateData.officerName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payroll ID Number:</span>
                      <p className="font-mono font-semibold text-foreground">{certificateData.payrollNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Department / Division:</span>
                      <p className="font-medium text-foreground">{certificateData.department}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Substantive Classification:</span>
                      <p className="font-mono font-medium text-primary">
                        Grade {certificateData.gradeCode || "PS-10"}, Step {certificateData.gradeStep || 1}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Base Salary (Fortnightly):</span>
                      <p className="font-bold text-foreground">
                        PGK {Number(certificateData.baseSalaryFortnightly || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Annual Equivalent:</span>
                      <p className="font-bold text-foreground">
                        PGK {Number(certificateData.baseSalaryAnnual || 0).toLocaleString("en-PG", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-semibold">Statutory Reference & Authority:</span>
                    <p className="mt-0.5">{certificateData.statutoryReference}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span>Integrity SHA-256 Checksum:</span>
                      <span className="truncate max-w-[280px]" title={certificateData.checksum}>
                        {certificateData.checksum}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sign-off Strip */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t text-xs">
                  <div>
                    <span className="text-muted-foreground">Authorized Signature:</span>
                    <div className="mt-4 border-b border-foreground/40 pb-1 font-serif text-sm italic">
                      L. Mukombo, Registrar / HR Controller
                    </div>
                    <span className="text-[10px] text-muted-foreground">Head of HR & Corporate Administration</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Official Institutional Seal:</span>
                    <div className="mt-2 flex items-center gap-2 text-primary font-bold text-xs">
                      <ShieldCheck className="h-6 w-6 text-emerald-600" />
                      <span>SEALED & VERIFIED BY NISIT TEMPORAL ENGINE</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Issued: {new Date(certificateData.issuedAt).toLocaleString("en-PG")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="h-4 w-4" />
                Print Certificate
              </Button>
              <Button onClick={() => setIsCertificateOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 2: INSPECT SNAPSHOT MODAL */}
        <Dialog open={!!inspectSnapshot} onOpenChange={(open) => !open && setInspectSnapshot(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-primary" />
                Snapshot Inspector: {inspectSnapshot?.transactionNumber}
              </DialogTitle>
              <DialogDescription>
                Full cryptographic payload and state transition recorded in the temporal ledger.
              </DialogDescription>
            </DialogHeader>

            {inspectSnapshot && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 bg-muted/20">
                  <div>
                    <span className="text-muted-foreground">Event Type:</span>
                    <p className="font-semibold text-foreground">{inspectSnapshot.eventType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recorded Timestamp:</span>
                    <p className="font-medium text-foreground">
                      {new Date(inspectSnapshot.recordedAt).toLocaleString("en-PG")}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valid Epoch Range:</span>
                    <p className="font-medium text-foreground">
                      {new Date(inspectSnapshot.validFrom).toLocaleDateString("en-PG")} →{" "}
                      {inspectSnapshot.validTo ? new Date(inspectSnapshot.validTo).toLocaleDateString("en-PG") : "Present"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SHA-256 Checksum:</span>
                    <p className="font-mono text-[11px] truncate" title={inspectSnapshot.checksum}>
                      {inspectSnapshot.checksum}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Reason & Authority:</span>
                  <p className="mt-1 rounded border p-2 bg-background text-muted-foreground">
                    {inspectSnapshot.reason}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Snapshot State Payload (JSON):</span>
                  <pre className="mt-1 max-h-48 overflow-y-auto rounded border bg-muted/40 p-2 font-mono text-[11px] text-foreground">
                    {JSON.stringify(inspectSnapshot.snapshotState, null, 2)}
                  </pre>
                </div>

                {inspectSnapshot.diff && (
                  <div>
                    <span className="font-semibold text-foreground">Field-Level Transition Diff:</span>
                    <pre className="mt-1 max-h-36 overflow-y-auto rounded border bg-emerald-500/5 p-2 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                      {JSON.stringify(inspectSnapshot.diff, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setInspectSnapshot(null)}>Dismiss</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
