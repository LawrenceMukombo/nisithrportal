import { Link } from "wouter";
import {
  GitBranch,
  Users,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { WORKFLOW_STAGES, STAGE_COLOR_MAP, TERMINAL_STATUSES } from "@/lib/workflowStages";

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

function avgDays(apps: Application[]): number {
  if (apps.length === 0) return 0;
  const total = apps.reduce((sum, a) => sum + daysSince(a.createdAt), 0);
  return Math.round(total / apps.length);
}

function StageCard({
  stage,
  apps,
  totalActive,
  candidateMap,
  jobMap,
  avgDaysInStage,
  isSlowest,
}: {
  stage: typeof WORKFLOW_STAGES[number];
  apps: Application[];
  totalActive: number;
  candidateMap: Map<number, Candidate>;
  jobMap: Map<number, Job>;
  avgDaysInStage: number;
  isSlowest: boolean;
}) {
  const colors = STAGE_COLOR_MAP[stage.color];
  const Icon = stage.icon;

  const top5 = apps.slice(0, 5);
  const pct = totalActive > 0 ? Math.round((apps.length / totalActive) * 100) : 0;

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
            <Badge variant="secondary" className="tabular-nums">
              {apps.length}
            </Badge>
            {apps.length > 0 && (
              <span
                className={`text-xs font-semibold tabular-nums ${isSlowest ? "text-orange-500" : "text-muted-foreground"}`}
                data-testid={`avg-days-${stage.id}`}
                title="Average days applications have been in this stage"
              >
                avg {avgDaysInStage}d
              </span>
            )}
          </div>
        </div>
        {isSlowest && apps.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1 rounded-md bg-orange-50 dark:bg-orange-950/20 px-2 py-1 border border-orange-200 dark:border-orange-900/40">
            <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Slowest stage — possible bottleneck</p>
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
          <p className="text-xs text-muted-foreground text-center py-4">No candidates at this stage</p>
        ) : (
          <div className="space-y-1">
            {top5.map((app) => {
              const candidate = app.candidateId != null ? candidateMap.get(app.candidateId) : undefined;
              const job = jobMap.get(app.jobId);
              const name = candidate?.name ?? `Candidate #${app.candidateId}`;
              const position = job?.title ?? `Job #${app.jobId}`;
              return (
                <Link key={app.id} href={`/applications/${app.id}`}>
                  <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{position}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{daysSince(app.createdAt)}d</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              );
            })}
            {apps.length > 5 && (
              <Link href={`/applications?status=${stage.status}`}>
                <p className="text-xs text-primary hover:underline text-center pt-1 cursor-pointer">
                  +{apps.length - 5} more
                </p>
              </Link>
            )}
          </div>
        )}
      </CardContent>
      <div className="px-4 pb-4 pt-0">
        <Link href={`/applications?status=${stage.status}`}>
          <span className={`text-xs font-medium cursor-pointer hover:underline ${colors.text}`}>
            View all in {stage.label} →
          </span>
        </Link>
      </div>
    </Card>
  );
}

export default function RecruitmentWorkflowPage() {
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

  const stageAvgDays = WORKFLOW_STAGES.map((stage) => ({
    stage,
    apps: stageApps(stage),
    avg: avgDays(stageApps(stage)),
  }));

  const populatedStages = stageAvgDays.filter((s) => s.apps.length > 0);
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
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
                      avg <span className="font-semibold text-orange-500">{slowestEntry.avg}d</span> · {slowestEntry.apps.length} candidate{slowestEntry.apps.length !== 1 ? "s" : ""}
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

        <div>
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            Pipeline Stages
            <span className="text-xs text-muted-foreground font-normal">— {WORKFLOW_STAGES.length} stages</span>
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {WORKFLOW_STAGES.map((stage) => {
                const apps = stageApps(stage);
                const avg = avgDays(apps);
                const isSlowest = slowestEntry?.stage.id === stage.id && apps.length > 0;
                return (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    apps={apps}
                    totalActive={totalActive}
                    candidateMap={candidateMap}
                    jobMap={jobMap}
                    avgDaysInStage={avg}
                    isSlowest={isSlowest}
                  />
                );
              })}
            </div>
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
