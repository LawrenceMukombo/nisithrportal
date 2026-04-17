import { useState } from "react";
import { useGetDashboardSummary, useGetDashboardRecruitmentPipeline, useGetDashboardContractExpiries, useGetDashboardWorkforceGaps, useAiPredictWorkforce, getGetDashboardSummaryQueryKey, getGetDashboardRecruitmentPipelineQueryKey, getGetDashboardContractExpiriesQueryKey, getGetDashboardWorkforceGapsQueryKey, getAiPredictWorkforceQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Briefcase, Users, FileText, UserCheck, ScrollText, TrendingUp, AlertTriangle, Clock, Brain, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth } from "@/contexts/auth-context";
import { useRole } from "@/contexts/auth-context";

function StatCard({ label, value, icon: Icon, delta }: { label: string; value: number | string; icon: React.ComponentType<{className?: string}>; delta?: string }) {
  return (
    <Card data-testid={`card-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
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
  const { agencyId } = useAuth();
  const { isAdmin, isHR, isExecutive } = useRole();
  const [predictEnabled, setPredictEnabled] = useState(false);

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

  const s = summary.data;

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
              <StatCard label="Open Jobs" value={s?.openVacancies ?? 0} icon={Briefcase} />
              <StatCard label="Total Jobs" value={s?.totalJobs ?? 0} icon={Users} />
              <StatCard label="Applications" value={s?.totalApplications ?? 0} icon={FileText} />
              <StatCard label="Active Employees" value={s?.activeEmployees ?? 0} icon={UserCheck} />
              <StatCard label="Expiring Contracts" value={s?.contractsExpiringIn30Days ?? 0} icon={ScrollText} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
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

          <Card>
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

        <Card>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-contract-expiries">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium">Employee</th>
                      <th className="text-left py-2 pr-4 font-medium">Contract Type</th>
                      <th className="text-left py-2 pr-4 font-medium">Expires</th>
                      <th className="text-left py-2 font-medium">Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiries.data.map((e, i) => (
                      <tr key={i} className="border-b border-border last:border-0" data-testid={`row-expiry-${i}`}>
                        <td className="py-2 pr-4 font-medium">{e.employeeName}</td>
                        <td className="py-2 pr-4 text-muted-foreground capitalize">{e.contractType}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{e.endDate}</td>
                        <td className="py-2">
                          <Badge variant={(e.daysUntilExpiry ?? 999) <= 30 ? "destructive" : "secondary"}>
                            {e.daysUntilExpiry ?? "?"}d
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      </div>
    </AppLayout>
  );
}
