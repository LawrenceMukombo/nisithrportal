import { useEffect, useState } from "react";
import { useGetDashboardSummary, useGetDashboardRecruitmentPipeline, useGetDashboardContractExpiries, useGetDashboardWorkforceGaps, useAiPredictWorkforce, getGetDashboardSummaryQueryKey, getGetDashboardRecruitmentPipelineQueryKey, getGetDashboardContractExpiriesQueryKey, getGetDashboardWorkforceGapsQueryKey, getAiPredictWorkforceQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Briefcase, Users, FileText, UserCheck, ScrollText, TrendingUp, AlertTriangle, Clock, Brain, Loader2, RefreshCw, ChevronRight, Database, Bookmark, Send, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth } from "@/contexts/use-auth";
import { useRole } from "@/contexts/use-auth";
import { useLocation } from "wouter";
import { DataTable } from "@/components/ui/data-table";
import type { DataTableColumn } from "@/components/ui/data-table";

type DrilldownMetric = "open_jobs" | "total_jobs" | "applications" | "active_employees" | "expiring_contracts" | "pipeline" | "department_capacity";
type DrilldownRecord = { id: number; primary: string; secondary: string; status: string | null; href: string };
type DrilldownResponse = { title: string; records: DrilldownRecord[] };

function StatCard({ label, value, icon: Icon, delta, onClick }: { label: string; value: number | string; icon: React.ComponentType<{className?: string}>; delta?: string; onClick?: () => void }) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}
      className={`transition-all ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
      data-testid={`card-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {delta && <p className="text-xs text-muted-foreground mt-1">{delta}</p>}
          </div>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── APPLICANT DASHBOARD VIEW ───────────────────────────────────────────────

function ApplicantDashboardView() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [openJobs, setOpenJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch("/api/applications/my", { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/saved-jobs", { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/jobs").then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([apps, saved, jobs]) => {
      setMyApplications(Array.isArray(apps) ? apps : []);
      setSavedJobs(Array.isArray(saved) ? saved : []);
      const published = Array.isArray(jobs) ? jobs.filter((j: any) => ["open", "published"].includes(j.status)) : [];
      setOpenJobs(published);
      setLoading(false);
    });
  }, [token]);

  const activeApps = myApplications.filter(a => !["rejected", "withdrawn"].includes(a.status));
  const offersCount = myApplications.filter(a => ["offer", "hired"].includes(a.status)).length;
  const interviewsCount = myApplications.filter(a => a.status === "interview").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 rounded-xl border border-primary/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              Candidate Hub
            </h1>
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
              Applicant Portal
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back{user?.name ? `, ${user.name}` : ""}. Track your job applications, saved vacancies, and public service opportunities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setLocation("/jobs")} className="gap-2">
            <Briefcase className="h-4 w-4" /> Browse Vacancies
          </Button>
          <Button variant="outline" onClick={() => setLocation("/my-applications")} className="gap-2">
            <FileText className="h-4 w-4" /> My Applications
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard
              label="Total Applied"
              value={myApplications.length}
              icon={Send}
              onClick={() => setLocation("/my-applications")}
            />
            <StatCard
              label="Active Applications"
              value={activeApps.length}
              icon={CheckCircle2}
              onClick={() => setLocation("/my-applications")}
            />
            <StatCard
              label="Saved Vacancies"
              value={savedJobs.length}
              icon={Bookmark}
              onClick={() => setLocation("/my-applications")}
            />
            <StatCard
              label="Open NISIT Jobs"
              value={openJobs.length}
              icon={Briefcase}
              onClick={() => setLocation("/jobs")}
            />
          </>
        )}
      </div>

      {/* Main Grid: Active Applications & Recommended Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Applications Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> My Recent Applications
              </CardTitle>
              <CardDescription>Status of your active submissions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/my-applications")} className="gap-1 text-xs">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : myApplications.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium">No applications submitted yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Explore open positions at NISIT and submit your application online.
                </p>
                <Button size="sm" onClick={() => setLocation("/jobs")} className="mt-4">
                  Find Vacancies
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myApplications.slice(0, 4).map((app: any) => (
                  <div
                    key={app.id}
                    onClick={() => setLocation("/my-applications")}
                    className="p-3.5 rounded-lg border hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{app.jobTitle ?? `Application #${app.id}`}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {app.departmentName ?? "NISIT"} · Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize shrink-0 text-xs font-semibold px-2.5 py-0.5">
                      {app.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommended Open Vacancies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" /> Featured NISIT Opportunities
              </CardTitle>
              <CardDescription>Explore open technical and administrative roles</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/jobs")} className="gap-1 text-xs">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : openJobs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No open vacancies at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {openJobs.slice(0, 4).map((job: any) => (
                  <div
                    key={job.id}
                    className="p-3.5 rounded-lg border hover:border-primary/50 hover:bg-muted/40 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {job.location ?? "Port Moresby"} · {job.employmentType ?? "Full-time"} {job.closingDate ? `· Closes ${new Date(job.closingDate).toLocaleDateString("en-PG", { day: "numeric", month: "short" })}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="default" onClick={() => setLocation(`/jobs/${job.id}?apply=1`)} className="shrink-0 text-xs h-8">
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD (ROLE-AWARE) ───────────────────────────────────────────

export default function DashboardPage() {
  const { agencyId, token } = useAuth();
  const { isAdmin, isHR, isExecutive, isHiringManager } = useRole();
  const [predictEnabled, setPredictEnabled] = useState(false);
  const [, setLocation] = useLocation();
  const [drilldown, setDrilldown] = useState<{ metric: DrilldownMetric; params?: Record<string, string | number> } | null>(null);
  const [drilldownData, setDrilldownData] = useState<DrilldownResponse | null>(null);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const isStaffRole = isAdmin || isHR || isExecutive || isHiringManager;

  const summary = useGetDashboardSummary(
    { agency_id: agencyId ?? undefined },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ agency_id: agencyId ?? undefined }), enabled: isStaffRole } }
  );

  const pipeline = useGetDashboardRecruitmentPipeline(
    { agency_id: agencyId ?? undefined },
    { query: { queryKey: getGetDashboardRecruitmentPipelineQueryKey({ agency_id: agencyId ?? undefined }), enabled: isStaffRole } }
  );

  const expiries = useGetDashboardContractExpiries(
    { agency_id: agencyId ?? undefined, days: 90 },
    { query: { queryKey: getGetDashboardContractExpiriesQueryKey({ agency_id: agencyId ?? undefined, days: 90 }), enabled: isStaffRole } }
  );

  const gaps = useGetDashboardWorkforceGaps(
    { agency_id: agencyId ?? undefined },
    { query: { queryKey: getGetDashboardWorkforceGapsQueryKey({ agency_id: agencyId ?? undefined }), enabled: isStaffRole } }
  );

  const predictions = useAiPredictWorkforce(
    agencyId != null ? { agency_id: agencyId } : undefined,
    {
      query: {
        queryKey: getAiPredictWorkforceQueryKey(agencyId != null ? { agency_id: agencyId } : undefined),
        enabled: predictEnabled && isStaffRole,
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const canViewPredictions = isAdmin || isHR || isExecutive;

  const expiryColumns: DataTableColumn<any>[] = [
    { key: "employee", label: "Employee", sortable: true, render: (row) => <span className="font-medium">{row.employeeName}</span>, sortValue: (row) => row.employeeName ?? "", exportValue: (row) => row.employeeName ?? "" },
    { key: "type", label: "Contract Type", sortable: true, render: (row) => <span className="capitalize text-muted-foreground">{row.contractType}</span>, sortValue: (row) => row.contractType ?? "", exportValue: (row) => row.contractType ?? "" },
    { key: "endDate", label: "Expires", sortable: true, render: (row) => <span className="text-muted-foreground">{row.endDate}</span>, sortValue: (row) => row.endDate ?? "", exportValue: (row) => row.endDate ?? "" },
    { key: "days", label: "Days Left", sortable: true, render: (row) => <Badge variant={(row.daysUntilExpiry ?? 999) <= 30 ? "destructive" : "secondary"}>{row.daysUntilExpiry ?? "?"}d</Badge>, sortValue: (row) => row.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER, exportValue: (row) => String(row.daysUntilExpiry ?? "") },
  ];

  const s = summary.data;
  const openDrilldown = (metric: DrilldownMetric, params?: Record<string, string | number>) => setDrilldown({ metric, params });

  useEffect(() => {
    if (!drilldown || !isStaffRole) return;
    const controller = new AbortController();
    const search = new URLSearchParams({ metric: drilldown.metric, ...(agencyId != null ? { agency_id: String(agencyId) } : {}) });
    Object.entries(drilldown.params ?? {}).forEach(([key, value]) => search.set(key, String(value)));
    setDrilldownLoading(true);
    setDrilldownError(null);
    setDrilldownData(null);
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const loadFallbackRecords = async (): Promise<DrilldownResponse> => {
      const read = async (url: string) => {
        const response = await fetch(url, { headers, signal: controller.signal });
        if (!response.ok) throw new Error(`Dashboard data request failed (${response.status}).`);
        return response.json() as Promise<any[]>;
      };
      if (drilldown.metric === "open_jobs" || drilldown.metric === "total_jobs") {
        const jobs = await read("/api/jobs");
        const filtered = drilldown.metric === "open_jobs" ? jobs.filter((job) => job.status === "published") : jobs;
        return { title: drilldown.metric === "open_jobs" ? "Open jobs" : "All jobs", records: filtered.map((job) => ({ id: job.id, primary: job.title, secondary: job.closingDate ? `Closes ${job.closingDate}` : "No closing date", status: job.status, href: `/jobs/${job.id}` })) };
      }
      if (drilldown.metric === "active_employees") {
        const employees = await read("/api/employees?status=active");
        return { title: "Active employees", records: employees.map((employee) => ({ id: employee.id, primary: employee.name, secondary: employee.employeeNumber ?? "Employee", status: employee.employmentType, href: `/employees/${employee.id}` })) };
      }
      if (drilldown.metric === "expiring_contracts") {
        const contracts = await read("/api/contracts?status=active");
        const employees = await read("/api/employees");
        const employeeNames = new Map(employees.map((employee) => [employee.id, employee.name]));
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 90);
        const eligible = contracts.filter((contract) => contract.endDate && new Date(`${contract.endDate}T00:00:00`) >= new Date() && new Date(`${contract.endDate}T00:00:00`) <= cutoff);
        return { title: "Contracts expiring in the next 90 days", records: eligible.map((contract) => ({ id: contract.id, primary: employeeNames.get(contract.employeeId) ?? `Employee #${contract.employeeId}`, secondary: `Ends ${contract.endDate}`, status: contract.type, href: `/contracts/${contract.id}` })) };
      }
      if (drilldown.metric === "department_capacity") {
        const [positions, departments] = await Promise.all([read("/api/positions"), read("/api/departments")]);
        const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
        return { title: "Workforce capacity by position", records: positions.map((position) => ({ id: position.id, primary: position.title, secondary: `${departmentNames.get(position.departmentId) ?? "Department"} · ${position.filledCount ?? 0} filled of ${position.totalCount ?? 0}`, status: `${Math.max(0, (position.totalCount ?? 0) - (position.filledCount ?? 0))} vacant`, href: "/departments" })) };
      }
      const applications = await read("/api/applications");
      const selected = drilldown.metric === "pipeline" && drilldown.params?.status ? applications.filter((application) => application.status === drilldown.params?.status) : applications;
      return { title: drilldown.metric === "pipeline" ? "Pipeline applications" : "All applications", records: selected.map((application) => ({ id: application.id, primary: `Application #${application.id}`, secondary: `Job #${application.jobId} · Candidate #${application.candidateId}`, status: application.status, href: `/applications/${application.id}` })) };
    };
    fetch(`/api/dashboard/drilldown?${search.toString()}`, {
      headers,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return loadFallbackRecords();
        return response.json() as Promise<DrilldownResponse>;
      })
      .then(setDrilldownData)
      .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") setDrilldownError(error instanceof Error ? error.message : "Unable to load the source records."); })
      .finally(() => { if (!controller.signal.aborted) setDrilldownLoading(false); });
    return () => controller.abort();
  }, [agencyId, drilldown, isStaffRole, token]);

  // Render role-tailored view for applicants
  if (!isStaffRole) {
    return (
      <AppLayout>
        <ApplicantDashboardView />
      </AppLayout>
    );
  }

  // Render enterprise workforce dashboard for HR / Admin / Execs
  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-dashboard">Executive Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Enterprise workforce, capacity, and recruitment metrics</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {summary.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard label="Open Jobs" value={s?.openVacancies ?? 0} icon={Briefcase} onClick={() => openDrilldown("open_jobs")} />
              <StatCard label="Total Jobs" value={s?.totalJobs ?? 0} icon={Users} onClick={() => openDrilldown("total_jobs")} />
              <StatCard label="Applications" value={s?.totalApplications ?? 0} icon={FileText} onClick={() => openDrilldown("applications")} />
              <StatCard label="Active Employees" value={s?.activeEmployees ?? 0} icon={UserCheck} onClick={() => openDrilldown("active_employees")} />
              <StatCard label="Expiring Contracts" value={s?.contractsExpiringIn30Days ?? 0} icon={ScrollText} onClick={() => openDrilldown("expiring_contracts")} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDrilldown("pipeline")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Recruitment Pipeline
              </CardTitle>
              <CardDescription>Applications by status</CardDescription>
            </CardHeader>
            <CardContent>
              {pipeline.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : pipeline.data && pipeline.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={pipeline.data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  No pipeline data
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDrilldown("department_capacity")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Filled vs. Vacant by Department
              </CardTitle>
              <CardDescription>Workforce capacity per department</CardDescription>
            </CardHeader>
            <CardContent>
              {gaps.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : gaps.data && gaps.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={gaps.data.map((g) => ({
                      dept: g.departmentName?.slice(0, 12) ?? "Dept",
                      Filled: (g.totalPositions ?? 0) - (g.gapCount ?? 0),
                      Vacant: g.gapCount ?? 0,
                    }))}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Filled" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Vacant" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  No workforce data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDrilldown("expiring_contracts")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-500" />
              Contract Expiries (Next 90 Days)
            </CardTitle>
            <CardDescription>Contracts expiring soon that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            {expiries.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : expiries.data && expiries.data.length > 0 ? (
              <DataTable
                columns={expiryColumns}
                rows={expiries.data}
                getRowId={(r) => r.id}
                searchPlaceholder="Filter expiring contracts..."
                exportFilename="contract-expiries"
              />
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                No contracts expiring in the next 90 days
              </div>
            )}
          </CardContent>
        </Card>

        {canViewPredictions && (
          <Card className="border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-indigo-700 dark:text-indigo-300">
                    <Brain className="h-4 w-4" /> AI Workforce Intelligence
                  </CardTitle>
                  <CardDescription>Predictive analytics for attrition risk, future vacancies, and hiring recommendations</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPredictEnabled(true)}
                  disabled={predictions.isFetching}
                  className="gap-1.5"
                >
                  {predictions.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {predictions.data ? "Refresh AI Insights" : "Run AI Analysis"}
                </Button>
              </div>
            </CardHeader>
            {predictions.isFetching && !predictions.data && (
              <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            )}
            {predictions.data && (
              <CardContent className="space-y-6">
                {predictions.data.attritionRisk && predictions.data.attritionRisk.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Attrition Risk by Department
                    </h4>
                    <div className="space-y-2">
                      {predictions.data.attritionRisk.map((r, i) => (
                        <div key={i} className="flex items-start justify-between gap-4 p-2.5 rounded-md bg-muted/40">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{r.departmentName}</p>
                            {r.reason && <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{r.staffAtRisk} at risk</span>
                            <Badge
                              variant={r.riskLevel === "high" ? "destructive" : r.riskLevel === "medium" ? "secondary" : "outline"}
                              className="capitalize"
                            >
                              {r.riskLevel}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {predictions.data.predictedVacancies && predictions.data.predictedVacancies.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> Predicted Vacancies
                    </h4>
                    <div className="space-y-2">
                      {predictions.data.predictedVacancies.map((v, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 p-2.5 rounded-md bg-muted/40">
                          <div>
                            <p className="text-sm font-medium">{v.departmentName}</p>
                            <p className="text-xs text-muted-foreground">{v.timeframe}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{v.predictedVacancies}</span>
                            <Badge variant="outline" className="capitalize text-xs">{v.confidence} confidence</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {predictions.data.recommendations && predictions.data.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1.5">
                      {predictions.data.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-indigo-500 mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}
        <Dialog open={drilldown != null} onOpenChange={(open) => { if (!open) setDrilldown(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-dashboard-drilldown">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> {drilldownData?.title ?? "Dashboard source records"}</DialogTitle>
              <DialogDescription>These are the live, tenant-scoped records used to calculate the selected dashboard value.</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto -mx-2 px-2 min-h-24">
              {drilldownLoading && <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
              {drilldownError && <p className="py-6 text-sm text-destructive text-center">{drilldownError}</p>}
              {!drilldownLoading && !drilldownError && drilldownData?.records.length === 0 && <p className="py-8 text-sm text-muted-foreground text-center">No seeded records currently match this metric.</p>}
              {!drilldownLoading && drilldownData && drilldownData.records.length > 0 && (
                <div className="space-y-2">
                  {drilldownData.records.map((record) => (
                    <button key={record.id} type="button" onClick={() => setLocation(record.href)} className="w-full rounded-md border p-3 text-left hover:bg-muted/60 hover:border-primary/40 transition-colors flex items-center gap-3">
                      <div className="min-w-0 flex-1"><p className="font-medium text-sm truncate">{record.primary}</p><p className="text-xs text-muted-foreground truncate mt-0.5">{record.secondary}</p></div>
                      {record.status && <Badge variant="outline" className="capitalize shrink-0">{record.status}</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
