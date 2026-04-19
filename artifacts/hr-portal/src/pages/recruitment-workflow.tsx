import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  GitBranch,
  Users,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  BarChart2,
  Download,
  Search,
  X,
} from "lucide-react";
import {
  useGetApplications,
  useGetCandidates,
  useGetJobs,
  getGetApplicationsQueryKey,
  getGetCandidatesQueryKey,
  getGetJobsQueryKey,
} from "@workspace/api-client-react";
import type { Application, Candidate, Job } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { WORKFLOW_STAGES, STAGE_COLOR_MAP, TERMINAL_STATUSES } from "@/lib/workflowStages";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const SHARED_STATUS_STAGES = new Set(
  WORKFLOW_STAGES.filter((s) =>
    WORKFLOW_STAGES.filter((o) => o.status === s.status).length > 1
  ).map((s) => s.id)
);

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

type StatusHistoryItem = NonNullable<Application["statusHistory"]>[number];

function sortedHistory(history: Application["statusHistory"]): StatusHistoryItem[] {
  return (history ?? [])
    .slice()
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
}

function lastEntryForStatus(history: Application["statusHistory"], status: string): StatusHistoryItem | undefined {
  return [...sortedHistory(history)].reverse().find((h) => h.status === status);
}

/**
 * Days a single application has been in its current stage.
 * Uses the most-recent statusHistory entry for that status,
 * falling back to createdAt when history is absent.
 */
function daysInStage(app: Application, stageStatus: string): number {
  const entry = lastEntryForStatus(app.statusHistory, stageStatus);
  if (entry) {
    return Math.max(0, Math.floor((Date.now() - new Date(entry.changedAt).getTime()) / (1000 * 60 * 60 * 24)));
  }
  return daysSince(app.createdAt);
}

/**
 * Compute avg days applications have been in their current stage using
 * exact stage-entry timestamps from statusHistory. Falls back to createdAt
 * for applications that have no history (shouldn't happen for new data).
 */
function avgDays(apps: Application[], stageStatus?: string): number {
  if (apps.length === 0) return 0;
  const now = Date.now();
  const total = apps.reduce((sum, a) => {
    if (stageStatus) {
      const entry = lastEntryForStatus(a.statusHistory, stageStatus);
      if (entry) {
        return sum + Math.max(0, Math.floor((now - new Date(entry.changedAt).getTime()) / (1000 * 60 * 60 * 24)));
      }
    }
    return sum + daysSince(a.createdAt);
  }, 0);
  return Math.round(total / apps.length);
}

/** Returns the Monday of the week that is `weeksAgo` weeks before the current week. */
function getWeekMonday(weeksAgo: number): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - daysToMonday - weeksAgo * 7);
  return monday;
}

/** Format a date as "Apr 7" */
function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Hex colours keyed by the Tailwind colour name used in STAGE_COLOR_MAP.
 * One entry per unique colour so the chart lines are visually distinct.
 */
const STAGE_COLOR_HEX: Record<string, string> = {
  blue:    "#3b82f6",
  yellow:  "#eab308",
  orange:  "#f97316",
  purple:  "#a855f7",
  indigo:  "#6366f1",
  green:   "#22c55e",
  teal:    "#14b8a6",
  emerald: "#10b981",
};

/**
 * Unique pipeline statuses derived from WORKFLOW_STAGES (first stage per status wins).
 * Keeps this list in sync with workflowStages.ts automatically.
 */
const TREND_STATUSES: Array<{ status: string; label: string; color: string }> = (() => {
  const seen = new Set<string>();
  return WORKFLOW_STAGES
    .filter((s) => { if (seen.has(s.status)) return false; seen.add(s.status); return true; })
    .map((s) => ({ status: s.status, label: s.label, color: STAGE_COLOR_HEX[s.color] ?? "#94a3b8" }));
})();

type TrendPoint = {
  week: string;
  weekStart: number;
  [key: string]: string | number | undefined;
};

/**
 * Builds 8-week trend data from applications using exact stage-entry timestamps.
 *
 * For each calendar week (Mon–Sun) and each pipeline stage status, we collect
 * every stage interval (entry → exit) whose exit time falls within that week.
 * The "exit" is the next history entry's changedAt, or now for the current stage.
 * We then average the exact time each application spent in that stage.
 *
 * This replaces the old updatedAt - createdAt proxy with precise per-stage durations.
 */
function buildTrendData(applications: Application[]): TrendPoint[] {
  const NUM_WEEKS = 8;
  const now = Date.now();
  const weeks: TrendPoint[] = [];

  const sortedHistories = applications.map((app) => ({ sorted: sortedHistory(app.statusHistory) }));

  for (let w = NUM_WEEKS - 1; w >= 0; w--) {
    const weekStart = getWeekMonday(w);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd.getTime();

    const point: TrendPoint = {
      week: formatWeekLabel(weekStart),
      weekStart: weekStartMs,
    };

    for (const { status } of TREND_STATUSES) {
      const durations: number[] = [];

      for (const { sorted: history } of sortedHistories) {
        for (let i = 0; i < history.length; i++) {
          if (history[i].status !== status) continue;
          const entryMs = new Date(history[i].changedAt).getTime();
          const exitMs = i + 1 < history.length
            ? new Date(history[i + 1].changedAt).getTime()
            : now;

          if (exitMs >= weekStartMs && exitMs < weekEndMs) {
            const days = Math.max(0, Math.floor((exitMs - entryMs) / (1000 * 60 * 60 * 24)));
            durations.push(days);
          }
        }
      }

      if (durations.length > 0) {
        point[status] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      }
    }

    weeks.push(point);
  }

  return weeks;
}

function exportTrendCSV(trendData: TrendPoint[]): void {
  const headers = ["Week", ...TREND_STATUSES.map((s) => s.label)];
  const rows = trendData.map((point) => [
    point.week,
    ...TREND_STATUSES.map(({ status }) => (point[status] !== undefined ? String(point[status]) : "")),
  ]);
  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pipeline-trends-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PipelineTrendChart({ applications, isLoading }: { applications: Application[]; isLoading: boolean }) {
  const trendData = buildTrendData(applications);

  const hasAnyData = trendData.some((point) =>
    TREND_STATUSES.some(({ status }) => point[status] !== undefined)
  );

  return (
    <Card data-testid="pipeline-trend-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Pipeline Bottleneck Trends</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => exportTrendCSV(trendData)}
            disabled={isLoading}
            data-testid="btn-export-trend-csv"
            title="Download 8-week trend data as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Avg. days applications spent in each stage, grouped by week they exited that stage — lower is faster, rising lines signal a worsening bottleneck
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : !hasAnyData ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            Not enough historical data to show trends yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <LineChart data={trendData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                unit="d"
                width={32}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--card-foreground))",
                }}
                formatter={(value: number, name: string) => {
                  const entry = TREND_STATUSES.find((s) => s.status === name);
                  return [`${value}d avg in stage`, entry?.label ?? name];
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) => {
                  const entry = TREND_STATUSES.find((s) => s.status === value);
                  return entry?.label ?? value;
                }}
              />
              {TREND_STATUSES.map(({ status, color }) => (
                <Line
                  key={status}
                  type="monotone"
                  dataKey={status}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function StageCard({
  stage,
  apps,
  totalCount,
  totalActive,
  candidateMap,
  jobMap,
  avgDaysInStage,
  isSlowest,
  staleCount,
  searchQuery,
}: {
  stage: typeof WORKFLOW_STAGES[number];
  apps: Application[];
  totalCount: number;
  totalActive: number;
  candidateMap: Map<number, Candidate>;
  jobMap: Map<number, Job>;
  avgDaysInStage: number;
  isSlowest: boolean;
  staleCount: number;
  searchQuery: string;
}) {
  const [, setLocation] = useLocation();
  const colors = STAGE_COLOR_MAP[stage.color];
  const Icon = stage.icon;

  const top5 = apps.slice(0, 5);
  const pct = totalActive > 0 ? Math.round((totalCount / totalActive) * 100) : 0;
  const moreHref = `/applications?status=${stage.status}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`;

  return (
    <Card
      className={`flex flex-col ${isSlowest ? "ring-2 ring-orange-400/70 ring-offset-1" : ""}`}
      data-testid={`stage-card-${stage.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold leading-tight">{stage.label}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{stage.timeframe}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              {staleCount > 0 && (
                <Badge
                  className="tabular-nums bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100"
                  data-testid={`stale-badge-${stage.id}`}
                  title={`${staleCount} application${staleCount !== 1 ? "s" : ""} stuck ≥${stage.staleDaysThreshold} days`}
                >
                  ⚠ {staleCount} stalled
                </Badge>
              )}
              <Badge variant="secondary" className="tabular-nums">
                {searchQuery ? `${apps.length}/${totalCount}` : apps.length}
              </Badge>
            </div>
            <span
              className={`text-xs font-semibold tabular-nums ${isSlowest && totalCount > 0 ? "text-orange-500" : "text-muted-foreground"}`}
              data-testid={`avg-days-${stage.id}`}
              title="Average days applications have been in this stage"
            >
              avg {avgDaysInStage}d
            </span>
          </div>
        </div>
        {isSlowest && totalCount > 0 && (
          <div className="flex items-center gap-1.5 mt-1 rounded-md bg-orange-50 dark:bg-orange-950/20 px-2 py-1 border border-orange-200 dark:border-orange-900/40">
            <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Slowest stage — possible bottleneck</p>
          </div>
        )}
        {staleCount > 0 && (
          <div className="flex items-center gap-1.5 mt-1 rounded-md bg-amber-50 dark:bg-amber-950/20 px-2 py-1 border border-amber-200 dark:border-amber-900/40" data-testid={`stale-banner-${stage.id}`}>
            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              {staleCount} {staleCount === 1 ? "application" : "applications"} stuck ≥{stage.staleDaysThreshold}d — needs attention
            </p>
          </div>
        )}
        {SHARED_STATUS_STAGES.has(stage.id) && (
          <p className="text-xs text-muted-foreground/70 italic mt-1">
            Count shared with paired stage at same status
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{stage.description}</p>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${colors.bg.replace("100", "400")}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {apps.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {searchQuery && totalCount > 0 ? `No matches in "${searchQuery}"` : "No candidates at this stage"}
          </p>
        ) : (
          <div className="space-y-1">
            {top5.map((app) => {
              const candidate = app.candidateId != null ? candidateMap.get(app.candidateId) : undefined;
              const job = jobMap.get(app.jobId);
              const name = candidate?.name ?? `Candidate #${app.candidateId}`;
              const position = job?.title ?? `Job #${app.jobId}`;
              const days = daysInStage(app, stage.status);
              const isStale = days >= stage.staleDaysThreshold;
              const entryItem = lastEntryForStatus(app.statusHistory, stage.status);
              const entryDate = entryItem
                ? new Date(entryItem.changedAt).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" })
                : app.createdAt
                  ? new Date(app.createdAt).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" })
                  : null;
              const enteredLabel = entryDate ? `Entered: ${entryDate}` : null;
              const stageTooltip = isStale
                ? `${enteredLabel ? `${enteredLabel} · ` : ""}Stalled — ${days} days in stage (threshold: ${stage.staleDaysThreshold}d)`
                : `${enteredLabel ? `${enteredLabel} · ` : ""}${days} day${days !== 1 ? "s" : ""} in this stage`;
              return (
                <div
                  key={app.id}
                  role="link"
                  tabIndex={0}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${isStale ? "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30" : "hover:bg-muted/60"}`}
                  onClick={() => setLocation(`/applications/${app.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation(`/applications/${app.id}`); }}
                  data-testid={`pipeline-app-${app.id}`}
                  data-stale={isStale ? "true" : undefined}
                >
                  <div className="flex-1 min-w-0">
                    {app.candidateId ? (
                      <Link
                        href={`/candidates/${app.candidateId}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs font-medium truncate text-primary hover:underline transition-colors">
                          {name}
                        </p>
                      </Link>
                    ) : (
                      <p className="text-xs font-medium truncate text-foreground">{name}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{position}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isStale ? (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" aria-label="Stalled" title={stageTooltip} />
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground" title={stageTooltip} />
                    )}
                    <span
                      className={`text-xs font-semibold tabular-nums ${isStale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                      title={stageTooltip}
                      data-testid={`days-badge-${app.id}`}
                    >
                      {days}d
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
            {apps.length > 5 && (
              <Link href={moreHref}>
                <p className="text-xs text-primary hover:underline text-center pt-1 cursor-pointer">
                  +{apps.length - 5} more
                </p>
              </Link>
            )}
          </div>
        )}
      </CardContent>
      <div className="px-4 pb-4 pt-0">
        <Link href={moreHref}>
          <span className={`text-xs font-medium cursor-pointer hover:underline ${colors.text}`}>
            View all in {stage.label} →
          </span>
        </Link>
      </div>
    </Card>
  );
}

export default function RecruitmentWorkflowPage() {
  const [search, setSearch] = useState("");

  const { data: applications = [], isLoading: appsLoading } = useGetApplications(
    {},
    { query: { queryKey: getGetApplicationsQueryKey({}) } }
  );
  const { data: candidates = [], isLoading: candidatesLoading } = useGetCandidates({
    query: { queryKey: getGetCandidatesQueryKey() },
  });
  const { data: jobs = [], isLoading: jobsLoading } = useGetJobs(
    undefined,
    { query: { queryKey: getGetJobsQueryKey() } }
  );

  const isLoading = appsLoading || candidatesLoading || jobsLoading;

  const candidateMap = new Map<number, Candidate>(candidates.map((c) => [c.id, c]));
  const jobMap = new Map<number, Job>(jobs.map((j) => [j.id, j]));

  const q = search.trim().toLowerCase();
  const matchesSearch = (app: Application): boolean => {
    if (!q) return true;
    const name = (candidateMap.get(app.candidateId ?? 0)?.name ?? "").toLowerCase();
    const title = (jobMap.get(app.jobId)?.title ?? "").toLowerCase();
    return name.includes(q) || title.includes(q);
  };

  const activeApps = applications.filter((a) => !TERMINAL_STATUSES.includes(a.status ?? ""));
  const totalActive = activeApps.length;
  const avgTimeDays = avgDays(activeApps);

  const byStatus = applications.reduce<Record<string, Application[]>>((acc, app) => {
    const s = app.status ?? "applied";
    (acc[s] = acc[s] || []).push(app);
    return acc;
  }, {});

  const stageApps = (stage: typeof WORKFLOW_STAGES[number]): Application[] => {
    return byStatus[stage.status] ?? [];
  };

  const activeStageCount = WORKFLOW_STAGES.filter((s) => (byStatus[s.status]?.length ?? 0) > 0).length;

  const stageAvgDays = WORKFLOW_STAGES.map((stage) => {
    const allApps = stageApps(stage);
    const filtered = allApps.filter(matchesSearch);
    const staleCount = allApps.filter((a) => daysInStage(a, stage.status) >= stage.staleDaysThreshold).length;
    return {
      stage,
      apps: filtered,
      totalCount: allApps.length,
      avg: avgDays(allApps, stage.status),
      staleCount,
    };
  });

  // De-duplicate: build a status → threshold map (first stage per status wins)
  // so shared-status stages (screening/assessment, interview/evaluation) don't double-count.
  const thresholdByStatus: Record<string, number> = {};
  for (const stage of WORKFLOW_STAGES) {
    if (!(stage.status in thresholdByStatus)) thresholdByStatus[stage.status] = stage.staleDaysThreshold;
  }
  const totalStalled = activeApps.filter((app) => {
    const threshold = thresholdByStatus[app.status ?? ""];
    if (threshold === undefined) return false;
    return daysInStage(app, app.status ?? "") >= threshold;
  }).length;

  useEffect(() => {
    if (isLoading || applications.length === 0) return;
    fetch("/api/applications/check-stalled", { method: "POST", credentials: "include" }).catch(() => {});
  }, [isLoading]);

  const populatedStages = stageAvgDays.filter((s) => s.totalCount > 0);
  const slowestEntry = populatedStages.length > 0
    ? populatedStages.reduce((a, b) => (a.avg >= b.avg ? a : b))
    : null;

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-workflow">
            <GitBranch className="h-6 w-6 text-primary" />
            Recruitment Workflow
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end pipeline view from application to onboarding
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Candidates</span>
                </div>
                <p className="text-3xl font-bold">{totalActive}</p>
                <p className="text-xs text-muted-foreground mt-1">in the pipeline</p>
              </CardContent>
            </Card>
            <Card className="bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg. Time in Pipeline</span>
                </div>
                <p className="text-3xl font-bold">{avgTimeDays}</p>
                <p className="text-xs text-muted-foreground mt-1">days average</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-100 dark:bg-green-950/20 dark:border-green-900/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Applications</span>
                </div>
                <p className="text-3xl font-bold">{applications.length}</p>
                <p className="text-xs text-muted-foreground mt-1">all time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Stages</span>
                </div>
                <p className="text-3xl font-bold">{activeStageCount}</p>
                <p className="text-xs text-muted-foreground mt-1">of {WORKFLOW_STAGES.filter((s) => s.status != null).length} trackable stages</p>
              </CardContent>
            </Card>
            <Card
              className={`${slowestEntry ? "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/30" : ""}`}
              data-testid="slowest-stage-card"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={`h-4 w-4 ${slowestEntry ? "text-orange-500" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Slowest Stage</span>
                </div>
                {slowestEntry ? (
                  <>
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400 leading-tight truncate" title={slowestEntry.stage.label}>
                      {slowestEntry.stage.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      avg <span className="font-semibold text-orange-500">{slowestEntry.avg}d</span> · {slowestEntry.totalCount} candidate{slowestEntry.totalCount !== 1 ? "s" : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-muted-foreground">—</p>
                    <p className="text-xs text-muted-foreground mt-1">no active candidates</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <PipelineTrendChart applications={applications} isLoading={isLoading} />

        <div>
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Pipeline Stages
              <span className="text-xs text-muted-foreground font-normal">— {WORKFLOW_STAGES.length} stages</span>
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                data-testid="btn-export-full-pipeline"
                disabled={isLoading}
                title="Download one row per active application"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
                  const header = "Candidate Name,Job Title,Current Stage,Days in Stage,Status,Applied Date";
                  const rows = activeApps.map((app) => {
                    const cand = app.candidateId != null ? candidateMap.get(app.candidateId) : undefined;
                    const job = jobMap.get(app.jobId);
                    const status = app.status ?? "";
                    const stage = WORKFLOW_STAGES.find((s) => s.status === status);
                    const days = stage ? daysInStage(app, status) : daysSince(app.createdAt);
                    const appliedDate = app.createdAt ? new Date(app.createdAt).toISOString().slice(0, 10) : "";
                    return [
                      esc(cand?.name ?? `Candidate #${app.candidateId}`),
                      esc(job?.title ?? `Job #${app.jobId}`),
                      esc(stage?.label ?? status),
                      days,
                      esc(status),
                      appliedDate,
                    ].join(",");
                  });
                  const csv = [header, ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `pipeline-detail-${today}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export Full Pipeline
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                data-testid="btn-export-pipeline-csv"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
                  const header = "Application ID,Candidate Name,Job Title,Current Stage,Days in Stage,Stage Entry Date,Stalled,Expected Salary";
                  const rows = applications.map((app) => {
                    const cand = app.candidateId != null ? candidateMap.get(app.candidateId) : undefined;
                    const job = jobMap.get(app.jobId);
                    const status = app.status ?? "";
                    const stage = WORKFLOW_STAGES.find((s) => s.status === status);
                    const days = stage ? daysInStage(app, status) : daysSince(app.createdAt);
                    const isStale = stage ? days >= stage.staleDaysThreshold : false;
                    const entryItem = stage ? lastEntryForStatus(app.statusHistory, status) : undefined;
                    const entryDate = entryItem ? new Date(entryItem.changedAt).toISOString().slice(0, 10)
                      : app.createdAt ? new Date(app.createdAt).toISOString().slice(0, 10) : "";
                    return [
                      app.id,
                      esc(cand?.name ?? `Candidate #${app.candidateId}`),
                      esc(job?.title ?? `Job #${app.jobId}`),
                      esc(stage?.label ?? status),
                      days,
                      entryDate,
                      isStale ? "Yes" : "No",
                      app.expectedSalary ?? "",
                    ].join(",");
                  });
                  const csv = [header, ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `pipeline-applications-${today}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export Applications
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                data-testid="btn-export-snapshot"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const header = "Stage Name,Candidate Count,Avg Days in Stage,Slowest";
                  const rows = stageAvgDays.map(({ stage, totalCount, avg }) => {
                    const isSlowest = slowestEntry?.stage.id === stage.id && totalCount > 0;
                    return [
                      `"${stage.label}"`,
                      totalCount,
                      avg,
                      isSlowest ? "Yes" : "No",
                    ].join(",");
                  });
                  const csv = [header, ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `pipeline-snapshot-${today}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export Snapshot
              </Button>
              <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by candidate or job title..."
                className="pl-9 pr-8 h-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-pipeline-search"
              />
              {search && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              </div>
            </div>
          </div>
          {search && !isLoading && (() => {
            const totalMatches = stageAvgDays.reduce((sum, s) => sum + s.apps.length, 0);
            return (
              <p className="text-xs text-muted-foreground mb-3">
                Showing results for <span className="font-medium text-foreground">"{search}"</span>
                {" "}— {totalMatches} match{totalMatches !== 1 ? "es" : ""} across all stages
              </p>
            );
          })()}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
          ) : (
            <>
            {totalStalled > 0 && (
              <div className="flex items-start gap-2 mb-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-3" data-testid="stalled-summary-banner">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {totalStalled} stalled application{totalStalled !== 1 ? "s" : ""} across the pipeline
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    These applications have exceeded their stage threshold and require attention. HR managers have been notified.
                  </p>
                </div>
              </div>
            )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stageAvgDays.map(({ stage, apps, totalCount, avg, staleCount }) => {
                const isSlowest = slowestEntry?.stage.id === stage.id && totalCount > 0;
                return (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    apps={apps}
                    totalCount={totalCount}
                    totalActive={totalActive}
                    candidateMap={candidateMap}
                    jobMap={jobMap}
                    avgDaysInStage={avg}
                    isSlowest={isSlowest}
                    staleCount={staleCount}
                    searchQuery={search}
                  />
                );
              })}
            </div>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline Stage Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {WORKFLOW_STAGES.map((stage, i) => {
                const colors = STAGE_COLOR_MAP[stage.color];
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{i + 1}.</span>
                    <div className={`h-5 w-5 rounded flex items-center justify-center ${colors.bg}`}>
                      <Icon className={`h-3 w-3 ${colors.text}`} />
                    </div>
                    <span className="text-xs font-medium">{stage.label}</span>
                    {i < WORKFLOW_STAGES.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground ml-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
