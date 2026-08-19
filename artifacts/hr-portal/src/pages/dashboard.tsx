import { useEffect, useState } from "react";
import { useGetDashboardSummary, useGetDashboardRecruitmentPipeline, useGetDashboardContractExpiries, useGetDashboardWorkforceGaps, useAiPredictWorkforce, getGetDashboardSummaryQueryKey, getGetDashboardRecruitmentPipelineQueryKey, getGetDashboardContractExpiriesQueryKey, getGetDashboardWorkforceGapsQueryKey, getAiPredictWorkforceQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Briefcase, Users, FileText, UserCheck, ScrollText, TrendingUp, AlertTriangle, Clock, Brain, Loader2, RefreshCw, ChevronRight, Database } from "lucide-react";
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

function StatCard({ label, value, icon: Icon, delta, onClick }: { label: string; value: number | string; icon: React.ComponentType<{className?: string}>; delta?: string; onClick: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } }}
      className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

const PIPELINE_COLORS = ["#3b4fa8", "#d4a017", "#22c55e", "#ef4444", "#6366f1"];

export default function DashboardPage() {
  const { agencyId, token } = useAuth();
  const { isAdmin, isHR, isExecutive } = useRole();
  const [predictEnabled, setPredictEnabled] = useState(false);
  const [, setLocation] = useLocation();
  const [drilldown, setDrilldown] = useState<{ metric: DrilldownMetric; params?: Record<string, string | number> } | null>(null);
  const [drilldownData, setDrilldownData] = useState<DrilldownResponse | null>(null);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const summary = useGetDashboardSummary(
    { agency_id: agencyId ?? undefined },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ agency_id: agencyId ?? undefined }) } }
  );

  const pipeline = useGetDashboardRecruitmentPipeline(
    { agency_id: agencyId ?? undefined },
    { query: { queryKey: getGetDashboardRecruitmentPipelineQueryKey({ agency_id: agencyId ?? undefined }) } }
  );

  const expiries = useGetDashboardContractExpiries(
    { agency_id: agencyId ?? undefined, days: 90 },
    { query: { queryKey: getGetDashboardContractExpiriesQueryKey({ agency_id: agencyId ?? undefined, days: 90 }) } }
  );

  const gaps = useGetDashboardWorkforceGaps(
    { agency_id: agencyId ?? undefined },
    { query: { queryKey: getGetDashboardWorkforceGapsQueryKey({ agency_id: agencyId ?? undefined }) } }
  );

  const predictions = useAiPredictWorkforce(
    agencyId != null ? { agency_id: agencyId } : undefined,
    {
      query: {
        queryKey: getAiPredictWorkforceQueryKey(agencyId != null ? { agency_id: agencyId } : undefined),
        enabled: predictEnabled,
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
    if (!drilldown) return;
    const controller = new AbortController();
    const search = new URLSearchParams({ metric: drilldown.metric, ...(agencyId != null ? { agency_id: String(agencyId) } : {}) });
    Object.entries(drilldown.params ?? {}).forEach(([key, value]) => search.set(key, String(value)));
    setDrilldownLoading(true);
    setDrilldownError(null);
    setDrilldownData(null);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
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
  }, [agencyId, drilldown, token]);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-dashboard">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Workforce and recruitment overview</p>
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
              <Clock className="h-4 w-4 text-secondary" />
              Contract Expiries (Next 90 Days)
            </CardTitle>
            <CardDescription>Contracts expiring soon that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            {expiries.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : expiries.data && expiries.data.length > 0 ? (
              <DataTable columns={expiryColumns} rows={expiries.data} getRowId={(row) => row.id ?? row.employeeId} tableId="dashboard-contract-expiries" exportFilename="contract-expiries" searchPlaceholder="Search expiring contracts…" data-testid="table-contract-expiries" />
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">No contracts expiring in the next 90 days</p>
            )}
          </CardContent>
        </Card>
        {canViewPredictions && (
          <Card data-testid="card-ai-predictions">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4 text-indigo-500" />
                    AI Workforce Predictions
                  </CardTitle>
                  <CardDescription>AI-powered attrition risk and vacancy forecasts</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (predictEnabled) {
                      predictions.refetch();
                    } else {
                      setPredictEnabled(true);
                    }
                  }}
                  disabled={predictions.isFetching}
                  data-testid="button-run-predictions"
                >
                  {predictions.isFetching ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Analysing...</>
                  ) : predictions.data ? (
                    <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</>
                  ) : (
                    <><Brain className="h-3.5 w-3.5 mr-1" /> Run AI Analysis</>
                  )}
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
