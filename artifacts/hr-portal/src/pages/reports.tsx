import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Users,
  ScrollText,
  Calendar,
  Clock,
  Sparkles,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/api-config";

interface OverviewReport {
  headcount: number;
  openVacancies: number;
  totalApplicants: number;
  pendingLeaveRequests: number;
  pendingHousingRequests: number;
  trainingCompletedCount: number;
  departmentDistribution: Array<{ name: string; count: number }>;
}

interface ContractReportItem {
  id: number;
  employeeId: number;
  employeeName: string;
  positionTitle: string | null;
  departmentName: string | null;
  type: string;
  status: string;
  startDate: string;
  endDate: string | null;
  daysRemaining: number | null;
  expiryStatus: "normal" | "expiring_30_days" | "expiring_60_days" | "expiring_90_days" | "expired";
}

interface LeaveReportItem {
  leaveTypeId: number;
  leaveTypeName: string;
  status: string;
  totalRequests: number;
  totalDays: string;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch Overview Report
  const { data: overview, isLoading: isLoadingOverview } = useQuery<OverviewReport>({
    queryKey: ["/api/reports/overview"],
    queryFn: async () => {
      const res = await fetch("/api/reports/overview", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error("Failed to load overview report");
      return res.json();
    },
  });

  // Fetch Contracts Report
  const { data: contracts = [], isLoading: isLoadingContracts } = useQuery<ContractReportItem[]>({
    queryKey: ["/api/reports/contracts"],
    queryFn: async () => {
      const res = await fetch("/api/reports/contracts", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Leave Report
  const { data: leaveData = [], isLoading: isLoadingLeave } = useQuery<LeaveReportItem[]>({
    queryKey: ["/api/reports/leave"],
    queryFn: async () => {
      const res = await fetch("/api/reports/leave", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const exportCSV = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      toast({ title: "No Data", description: "No records to export", variant: "destructive" });
      return;
    }
    const headers = Object.keys(rows[0]).join(",");
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exported", description: `Report exported as ${filename}.csv` });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Workforce Analytics & Standard Reports</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Statutory Reporting
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Comprehensive headcount breakdown, contract renewals, leave utilisation, and statutory compliance metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </div>
        </div>

        {/* Top Level Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <Card className="bg-card border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Personnel</p>
              <p className="text-2xl font-bold mt-1">{isLoadingOverview ? "..." : overview?.headcount ?? 10}</p>
              <p className="text-[10px] text-muted-foreground">Active Officers</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Open Vacancies</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{isLoadingOverview ? "..." : overview?.openVacancies ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Active Recruitment</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Applicants</p>
              <p className="text-2xl font-bold mt-1">{isLoadingOverview ? "..." : overview?.totalApplicants ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">ATS Pool</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Pending Leave</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{isLoadingOverview ? "..." : overview?.pendingLeaveRequests ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Requires Approval</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Housing Scheme</p>
              <p className="text-2xl font-bold mt-1">{isLoadingOverview ? "..." : overview?.pendingHousingRequests ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">In Review</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-indigo-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Training Passed</p>
              <p className="text-2xl font-bold mt-1 text-indigo-600">{isLoadingOverview ? "..." : overview?.trainingCompletedCount ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Certified Staff</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 mr-1.5" /> Departmental Distribution
            </TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs font-semibold">
              <ScrollText className="w-3.5 h-3.5 mr-1.5" /> Contract Expiries & Lifecycle
            </TabsTrigger>
            <TabsTrigger value="leave" className="text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 mr-1.5" /> Leave Utilisation
            </TabsTrigger>
          </TabsList>

          {/* Department Distribution Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Staff Headcount by Division</CardTitle>
                  <CardDescription className="text-xs">
                    Current distribution of active statutory personnel across NISIT units
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => exportCSV("nisit_department_distribution", overview?.departmentDistribution || [])}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </CardHeader>

              <CardContent className="p-5 pt-2">
                <div className="h-72 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview?.departmentDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Officers" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Expiry Tab */}
          <TabsContent value="contracts" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Contract Lifecycle & Expiry Alerts</CardTitle>
                  <CardDescription className="text-xs">
                    Fixed-term contract tracking with 30/60/90 days early renewal notice
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => exportCSV("nisit_contracts_report", contracts)}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </CardHeader>

              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                    <tr>
                      <th className="p-3.5 pl-6">Officer Name</th>
                      <th className="p-3.5">Position & Division</th>
                      <th className="p-3.5">Tenure Type</th>
                      <th className="p-3.5">Start Date</th>
                      <th className="p-3.5">End Date</th>
                      <th className="p-3.5 pr-6">Expiry Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {contracts.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 pl-6 font-semibold text-foreground">{c.employeeName}</td>
                        <td className="p-3.5">
                          <p className="font-medium text-foreground">{c.positionTitle || "Officer"}</p>
                          <p className="text-[11px] text-muted-foreground">{c.departmentName}</p>
                        </td>
                        <td className="p-3.5 uppercase font-semibold text-[11px]">{c.type.replace("_", " ")}</td>
                        <td className="p-3.5 text-muted-foreground">{c.startDate}</td>
                        <td className="p-3.5 text-muted-foreground">{c.endDate || "Permanent Tenure"}</td>
                        <td className="p-3.5 pr-6">
                          {c.type === "permanent" ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">Permanent</Badge>
                          ) : c.expiryStatus === "expired" ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : c.expiryStatus === "expiring_30_days" ? (
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">Expires &lt;30d</Badge>
                          ) : c.expiryStatus === "expiring_60_days" ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Expires &lt;60d</Badge>
                          ) : (
                            <Badge variant="secondary">Active ({c.daysRemaining}d)</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Utilisation Tab */}
          <TabsContent value="leave" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Leave Utilisation Summary</CardTitle>
                  <CardDescription className="text-xs">
                    Aggregated leave days utilised by entitlement category
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => exportCSV("nisit_leave_utilisation", leaveData)}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </CardHeader>

              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                    <tr>
                      <th className="p-3.5 pl-6">Leave Category</th>
                      <th className="p-3.5">Approval Status</th>
                      <th className="p-3.5">Total Lodged Requests</th>
                      <th className="p-3.5 pr-6">Cumulative Working Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {leaveData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 pl-6 font-semibold text-foreground">{item.leaveTypeName || "Leave"}</td>
                        <td className="p-3.5 uppercase font-medium">{item.status}</td>
                        <td className="p-3.5 font-bold text-foreground">{item.totalRequests}</td>
                        <td className="p-3.5 pr-6 font-bold text-primary">{item.totalDays || 0} Days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
