import { useGetDashboardSummary, useGetDashboardRecruitmentPipeline, useGetDashboardContractExpiries, useGetDashboardWorkforceGaps, getGetDashboardSummaryQueryKey, getGetDashboardRecruitmentPipelineQueryKey, getGetDashboardContractExpiriesQueryKey, getGetDashboardWorkforceGapsQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Briefcase, Users, FileText, UserCheck, ScrollText, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth } from "@/contexts/auth-context";

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
                Workforce Gaps
              </CardTitle>
              <CardDescription>Positions with unfilled vacancies</CardDescription>
            </CardHeader>
            <CardContent>
              {gaps.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : gaps.data && gaps.data.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {gaps.data.map((gap, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0" data-testid={`row-gap-${i}`}>
                      <div>
                        <p className="text-sm font-medium">{gap.departmentName}</p>
                        <p className="text-xs text-muted-foreground">{gap.gapCount} gap(s) / {gap.totalPositions} total</p>
                      </div>
                      <Badge variant="destructive">{gap.gapCount} open</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  No workforce gaps detected
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
      </div>
    </AppLayout>
  );
}
