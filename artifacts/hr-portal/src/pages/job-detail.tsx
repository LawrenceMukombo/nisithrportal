import { useRoute, useLocation, useSearch, Link } from "wouter";
import {
  ArrowLeft, Calendar, Building2, Send, Users2, ChevronRight, ChevronDown, Sparkles, Loader2,
  MapPin, Briefcase, GraduationCap, Clock, DollarSign, FileCheck, Star,
  Monitor, CheckCircle2, Medal, Trophy, Bookmark, BookmarkCheck, Share2, Check, Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSavedJobIds, useSaveJob, useUnsaveJob } from "@/hooks/use-saved-jobs";
import { WORKFLOW_STAGES, STAGE_COLOR_MAP, TERMINAL_STATUSES } from "@/lib/workflowStages";
import {
  useGetJob, useGetApplications, useAiRankCandidates, getGetJobQueryKey,
  useGetAiScores, getGetAiScoresQueryKey, useDeleteAiScoresByJob,
  useGetCandidates, getGetCandidatesQueryKey,
  useUpdateApplicationStatus, getGetApplicationsQueryKey,
  useGetMyApplications, getGetMyApplicationsQueryKey,
} from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth, useRole } from "@/contexts/use-auth";
import { ApplyWizard, DraftBanner, type ScreeningQuestion } from "@/components/apply-wizard";
import { shareJob } from "@/lib/share";

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  screening: "bg-yellow-100 text-yellow-700",
  interview: "bg-purple-100 text-purple-700",
  offer: "bg-green-100 text-green-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  casual: "Casual",
};

const WORK_ARRANGEMENT_LABELS: Record<string, string> = {
  on_site: "On-Site",
  remote: "Remote",
  hybrid: "Hybrid",
};

function useScreeningQuestions(jobId: number, enabled: boolean) {
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  useEffect(() => {
    if (!enabled || !jobId) return;
    fetch(`/api/jobs/${jobId}/screening-questions`)
      .then(r => r.ok ? r.json() : [])
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, [jobId, enabled]);
  return questions;
}

type RankedCandidate = {
  applicationId: number;
  candidateId: number;
  candidateName: string;
  score: number;
  recommendation: string;
  currentStatus: string;
};

function QuickMoveButton({
  applicationId,
  candidateName,
  currentStatus,
  jobId,
}: {
  applicationId: number;
  candidateName: string;
  currentStatus: string;
  jobId: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateApplicationStatus();

  const SHORT_LABELS: Record<string, string> = {
    screening:        "Review",
    assessment:       "Assessment",
    interview:        "Interview",
    evaluation:       "Evaluation",
    offer:            "Offer",
    background_check: "Hired",
    onboarding:       "Onboarding",
  };

  const currentIndex = WORKFLOW_STAGES.findIndex((s) => s.status === currentStatus);
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);
  const stageLabel =
    WORKFLOW_STAGES.find((s) => s.status === currentStatus)?.label ?? currentStatus;

  const targetsWithMeta = WORKFLOW_STAGES
    .filter((s) => s.id !== "applied")
    .map((s) => {
      const targetIndex = WORKFLOW_STAGES.findIndex((x) => x.id === s.id);
      const alreadyAtOrPast =
        currentIndex >= 0 && targetIndex >= 0 && currentIndex >= targetIndex;
      return {
        status: s.status,
        label: s.label,
        shortLabel: SHORT_LABELS[s.id] ?? s.label,
        stageId: s.id,
        targetIndex,
        alreadyAtOrPast,
      };
    });

  const defaultTarget =
    targetsWithMeta.find((t) => !t.alreadyAtOrPast) ?? targetsWithMeta[0];
  const allDisabled = isTerminal || targetsWithMeta.every((t) => t.alreadyAtOrPast);

  const moveTo = async (status: string, label: string) => {
    const previousStatus = currentStatus;
    const previousLabel =
      WORKFLOW_STAGES.find((s) => s.status === previousStatus)?.label ?? previousStatus;
    try {
      await update.mutateAsync({ id: applicationId, data: { status } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetApplicationsQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetApplicationsQueryKey({ job_id: jobId }) }),
      ]);

      const undo = async () => {
        try {
          await update.mutateAsync({ id: applicationId, data: { status: previousStatus } });
          await Promise.all([
            qc.invalidateQueries({ queryKey: getGetApplicationsQueryKey() }),
            qc.invalidateQueries({ queryKey: getGetApplicationsQueryKey({ job_id: jobId }) }),
          ]);
          toast({ title: `Reverted ${candidateName} to ${previousLabel}` });
        } catch {
          toast({ title: "Failed to undo move", variant: "destructive" });
        }
      };

      toast({
        title: `${candidateName} moved to ${label}`,
        duration: 6000,
        action: (
          <ToastAction
            altText={`Undo move to ${label}`}
            onClick={() => {
              void undo();
            }}
            data-testid={`btn-undo-move-${applicationId}`}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch {
      toast({ title: "Failed to move candidate", variant: "destructive" });
    }
  };

  const handlePrimary = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (allDisabled || defaultTarget.alreadyAtOrPast) return;
    void moveTo(defaultTarget.status, defaultTarget.label);
  };

  if (isTerminal) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs px-2 gap-1 shrink-0"
        disabled
        data-testid={`btn-move-review-${applicationId}`}
        title={`Candidate is ${stageLabel}`}
      >
        {stageLabel}
      </Button>
    );
  }

  if (allDisabled) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs px-2 gap-1 shrink-0"
        disabled
        data-testid={`btn-move-review-${applicationId}`}
        title={`Already at ${stageLabel}`}
      >
        ✓ {stageLabel}
      </Button>
    );
  }

  return (
    <div className="inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs px-2 gap-1 rounded-r-none border-r-0"
        onClick={handlePrimary}
        disabled={update.isPending || defaultTarget.alreadyAtOrPast}
        data-testid={`btn-move-review-${applicationId}`}
        title={`Move to ${defaultTarget.label}`}
      >
        {update.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>→ {defaultTarget.shortLabel}</>
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-1 rounded-l-none"
            disabled={update.isPending}
            data-testid={`btn-move-stage-menu-${applicationId}`}
            title="Choose target stage"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {targetsWithMeta.map((t) => (
            <DropdownMenuItem
              key={t.stageId}
              disabled={t.alreadyAtOrPast || update.isPending}
              onSelect={() => {
                if (t.alreadyAtOrPast) return;
                void moveTo(t.status, t.label);
              }}
              data-testid={`menu-move-${t.stageId}-${applicationId}`}
            >
              {t.alreadyAtOrPast ? `✓ ${t.label}` : `→ ${t.label}`}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatTimeAgo(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const ts = new Date(dateStr).getTime();
  if (!Number.isFinite(ts)) return null;
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ApplicationPipelineCard({ jobId, canManageJobs }: { jobId: number; canManageJobs: boolean }) {
  const { data: applications = [], isLoading } = useGetApplications({ job_id: jobId });
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rankings, setRankings] = useState<RankedCandidate[]>([]);
  const [lastRankedAt, setLastRankedAt] = useState<string | null>(null);
  const rankMutation = useAiRankCandidates();
  const clearMutation = useDeleteAiScoresByJob();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const aiScoresParams = { job_id: jobId };
  const { data: savedScores = [] } = useGetAiScores(aiScoresParams, {
    query: { queryKey: getGetAiScoresQueryKey(aiScoresParams) },
  });
  const { data: candidates = [] } = useGetCandidates({ query: { queryKey: getGetCandidatesQueryKey() } });
  const candidateNameMap = new Map(candidates.map((c) => [c.id, c.name ?? `Candidate #${c.id}`]));

  useEffect(() => {
    if (savedScores.length === 0) {
      setRankings([]);
      setLastRankedAt(null);
      return;
    }

    // Deduplicate: keep only the most recent row per candidateId (backend may
    // accumulate rows from multiple ranking runs for the same candidate+job).
    const latestPerCandidate = new Map<number, typeof savedScores[number]>();
    for (const s of savedScores) {
      const existing = latestPerCandidate.get(s.candidateId);
      if (!existing || (s.createdAt && (!existing.createdAt || s.createdAt > existing.createdAt))) {
        latestPerCandidate.set(s.candidateId, s);
      }
    }
    const deduped = Array.from(latestPerCandidate.values());

    const latestCreatedAt = deduped.reduce<string | null>((latest, s) => {
      if (!s.createdAt) return latest;
      return latest == null || s.createdAt > latest ? s.createdAt : latest;
    }, null);
    setLastRankedAt(latestCreatedAt);

    const mapped: RankedCandidate[] = deduped
      .map((s) => {
        const app = applications.find((a) => a.candidateId === s.candidateId);
        if (!app) return null;
        return {
          applicationId: app.id,
          candidateId: s.candidateId,
          candidateName: candidateNameMap.get(s.candidateId) ?? `Candidate #${s.candidateId}`,
          score: parseFloat(s.score ?? "0"),
          recommendation: s.recommendation ?? "",
          currentStatus: app.status,
        };
      })
      .filter(Boolean) as RankedCandidate[];
    if (mapped.length === 0) {
      setRankings([]);
      return;
    }
    setRankings((prev) => {
      const prevOrder = new Map(prev.map((r, i) => [r.candidateId, i]));
      const sorted = [...mapped].sort((a, b) => {
        const ai = prevOrder.get(a.candidateId);
        const bi = prevOrder.get(b.candidateId);
        if (ai != null && bi != null) return ai - bi;
        return b.score - a.score;
      });
      return sorted;
    });
  }, [savedScores, applications, candidates, jobId]);

  const handleRank = async () => {
    try {
      const result = await rankMutation.mutateAsync({ data: { jobId } });
      type RawRanked = { applicationId: number; candidateId: number; candidateName: string; score: number; recommendation: string };
      const sorted = [...(result as RawRanked[])]
        .sort((a, b) => b.score - a.score)
        .map((r) => {
          const app = applications.find((a) => a.id === r.applicationId);
          return { ...r, currentStatus: app?.status ?? "applied" };
        });
      setRankings(sorted);
      setLastRankedAt(new Date().toISOString());
      await qc.invalidateQueries({ queryKey: getGetAiScoresQueryKey(aiScoresParams) });
      toast({ title: "Candidates ranked by AI" });
    } catch {
      toast({ title: "Failed to rank candidates", variant: "destructive" });
    }
  };

  const handleClearRankings = async () => {
    try {
      await clearMutation.mutateAsync({ params: { job_id: jobId } });
      setRankings([]);
      setLastRankedAt(null);
      await qc.invalidateQueries({ queryKey: getGetAiScoresQueryKey(aiScoresParams) });
      toast({ title: "AI rankings cleared" });
    } catch {
      toast({ title: "Failed to clear rankings", variant: "destructive" });
    } finally {
      setClearDialogOpen(false);
    }
  };

  const byStatus = applications.reduce<Record<string, Application[]>>((acc, app) => {
    (acc[app.status] = acc[app.status] || []).push(app);
    return acc;
  }, {});

  return (
    <Card data-testid="card-pipeline">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Recruitment Pipeline</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{applications.length} application{applications.length !== 1 ? "s" : ""}</Badge>
            {canManageJobs && applications.length > 0 && (
              <Button
                size="sm"
                variant={rankings.length > 0 ? "default" : "outline"}
                onClick={handleRank}
                disabled={rankMutation.isPending}
                data-testid="button-ai-rank"
                className="gap-1.5"
              >
                {rankMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Ranking…</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Rank Candidates</>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No applications yet for this position.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1 min-w-max">
                {WORKFLOW_STAGES.map((stage) => {
                  const count = byStatus[stage.status]?.length ?? 0;
                  const colors = STAGE_COLOR_MAP[stage.color];
                  const Icon = stage.icon;
                  return (
                    <Link key={stage.id} href={`/applications?status=${stage.status}`}>
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                          count > 0 ? colors.bg : "bg-muted"
                        }`}
                        title={`${stage.label}: ${count} candidate${count !== 1 ? "s" : ""}`}
                      >
                        <Icon className={`h-3 w-3 ${count > 0 ? colors.text : "text-muted-foreground"}`} />
                        <span className={`text-xs font-medium whitespace-nowrap ${count > 0 ? colors.text : "text-muted-foreground"}`}>
                          {stage.label}
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${count > 0 ? colors.text : "text-muted-foreground/60"}`}>
                          {count}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <Separator />
            <div className="space-y-1">
              {applications.slice(0, 20).map((app) => (
                <Link key={app.id} href={`/applications/${app.id}`}>
                  <div
                    className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/60 cursor-pointer transition-colors"
                    data-testid={`pipeline-row-${app.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {app.status}
                      </span>
                      <span className="text-sm font-medium">Candidate #{app.candidateId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {app.createdAt && <span>{new Date(app.createdAt).toLocaleDateString()}</span>}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
              {applications.length > 20 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{applications.length - 20} more —{" "}
                  <Link href="/applications" className="text-primary hover:underline">view all applications</Link>
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
      {rankings.length > 0 && (
        <>
          <Separator />
          <div className="p-4 space-y-4" data-testid="section-ai-rankings">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> AI Ranked Shortlist
                </p>
                {lastRankedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="last-ranked-timestamp">
                    Last ranked {formatTimeAgo(lastRankedAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{rankings.length} candidate{rankings.length !== 1 ? "s" : ""} ranked</span>
                {canManageJobs && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setClearDialogOpen(true)}
                    disabled={clearMutation.isPending}
                    data-testid="button-clear-rankings"
                    className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    {clearMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Clearing…</>
                    ) : (
                      <><Trash2 className="h-3.5 w-3.5" /> Clear rankings</>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1" data-testid="table-rankings">
              {/* Header row */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-[2rem_1fr_9rem_4rem] gap-2 px-2.5 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                  <span>#</span>
                  <span>Candidate</span>
                  <span>Match Score</span>
                  <span className="text-right">View</span>
                </div>
                {canManageJobs && (
                  <div className="pr-2 pb-1 shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border w-[6rem] text-center">
                    Action
                  </div>
                )}
              </div>
              {rankings.map((r, i) => {
                const pct = Math.min(100, Math.max(0, r.score));
                const matchLabel = pct >= 80 ? "High Match" : pct >= 60 ? "Good Match" : pct >= 40 ? "Partial Match" : "Low Match";
                const matchColor = pct >= 80
                  ? "text-green-700 bg-green-50 border-green-200"
                  : pct >= 60
                  ? "text-blue-700 bg-blue-50 border-blue-200"
                  : pct >= 40
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-red-700 bg-red-50 border-red-200";
                const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
                const medalEl = i === 0
                  ? <Medal className="h-4 w-4 text-amber-500" />
                  : i === 1
                  ? <Medal className="h-4 w-4 text-slate-400" />
                  : i === 2
                  ? <Medal className="h-4 w-4 text-amber-700" />
                  : <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>;

                return (
                  <div key={r.applicationId ?? r.candidateId} className="group rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-1.5" data-testid={`ranking-row-${r.candidateId}`}>
                    <Link href={`/applications/${r.applicationId}`} className="flex-1 min-w-0">
                      <div className="grid grid-cols-[2rem_1fr_9rem_4rem] gap-2 items-center px-2.5 py-2.5 cursor-pointer">
                        <div className="flex items-center justify-center">
                          {medalEl}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.candidateName}</p>
                          {r.recommendation && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.recommendation}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-semibold tabular-nums w-7 text-right">{pct}%</span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${matchColor}`}>{matchLabel}</Badge>
                        </div>
                        <div className="flex justify-end">
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                    {canManageJobs && r.applicationId && (
                      <div className="pr-2 shrink-0 w-[6rem] flex justify-center">
                        <QuickMoveButton
                          applicationId={r.applicationId}
                          candidateName={r.candidateName}
                          currentStatus={r.currentStatus}
                          jobId={jobId}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent data-testid="dialog-clear-rankings">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear AI rankings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all saved AI scores for this job. The shortlist will disappear and you can re-rank candidates at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-clear-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearRankings}
              data-testid="button-clear-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear rankings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

type ExtJob = {
  id: number;
  title: string;
  description: string;
  status: string;
  departmentId?: number | null;
  closingDate?: string | null;
  createdAt?: string;
  referenceNumber?: string | null;
  country?: string | null;
  province?: string | null;
  officeSite?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workArrangement?: string | null;
  publishTarget?: string | null;
  autoExpire?: boolean | null;
  jobSummary?: string | null;
  responsibilities?: string[] | null;
  reportingLine?: string | null;
  minEducation?: string | null;
  yearsExperience?: number | null;
  technicalSkills?: string[] | null;
  softSkills?: string[] | null;
  certifications?: string[] | null;
  languageRequirements?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryVisibility?: string | null;
  gradeBand?: string | null;
  contractDuration?: string | null;
  openingDate?: string | null;
  requiredDocuments?: string[] | null;
  maxApplicants?: number | null;
  isFeatured?: boolean | null;
};

type ParsedSection = {
  title: string;
  items: string[];
  paragraphs: string[];
};

function parseJobMarkdown(text: string): ParsedSection[] {
  if (!text || !text.trim()) return [];
  const lines = text.split("\n");
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("## ") || line.startsWith("# ") || line.startsWith("### ")) {
      if (currentSection) sections.push(currentSection);
      const title = line.replace(/^#+\s*/, "").trim();
      currentSection = { title, items: [], paragraphs: [] };
    } else if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
      const item = line.replace(/^[-*•]\s*/, "").trim();
      if (!currentSection) {
        currentSection = { title: "Position Overview", items: [], paragraphs: [] };
      }
      currentSection.items.push(item);
    } else {
      if (!currentSection) {
        currentSection = { title: "Position Overview", items: [], paragraphs: [] };
      }
      currentSection.paragraphs.push(line);
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

function getSectionIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("responsibilit") || lower.includes("duties") || lower.includes("accountabilit")) {
    return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />;
  }
  if (lower.includes("qualification") || lower.includes("education") || lower.includes("requirement")) {
    return <GraduationCap className="h-4 w-4 text-primary shrink-0" />;
  }
  if (lower.includes("desirable") || lower.includes("attribute") || lower.includes("asset") || lower.includes("preferred")) {
    return <Star className="h-4 w-4 text-amber-600 shrink-0" />;
  }
  if (lower.includes("overview") || lower.includes("about") || lower.includes("context") || lower.includes("introduction")) {
    return <Building2 className="h-4 w-4 text-primary shrink-0" />;
  }
  if (lower.includes("competenc") || lower.includes("skill")) {
    return <Sparkles className="h-4 w-4 text-primary shrink-0" />;
  }
  return <FileCheck className="h-4 w-4 text-primary shrink-0" />;
}

export default function JobDetailPage() {
  const [match, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { isAuthenticated } = useAuth();
  const { isAdmin, isHR, isHiringManager, canManageJobs, isApplicant } = useRole();
  const [wizardOpen, setWizardOpen] = useState(() => new URLSearchParams(searchString).get("apply") === "1");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();
  const canBookmark = !isAuthenticated || isApplicant;
  const { data: savedJobIds } = useSavedJobIds(isAuthenticated && isApplicant);

  const jobId = match ? parseInt(params!.id) : 0;
  const { data: rawJob, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) },
  });

  const job = rawJob as ExtJob | undefined;
  const isPublished = job?.status === "published" || job?.status === "open";
  const screeningQuestions = useScreeningQuestions(jobId, isPublished);
  const canViewPipeline = isAuthenticated && (isAdmin || isHR || isHiringManager);

  const { data: myApplications = [] } = useGetMyApplications({
    query: {
      enabled: isAuthenticated && isApplicant && !!jobId,
      queryKey: getGetMyApplicationsQueryKey(),
    },
  });
  const existingApplication = myApplications.find(
    (a) => a.jobId === jobId && a.status !== "withdrawn",
  );

  const showSalary = job?.salaryVisibility === "public" && (job.salaryMin || job.salaryMax);
  const isSaved = savedJobIds?.includes(jobId) ?? false;

  const daysRemaining = job?.closingDate
    ? Math.ceil((new Date(job.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const parsedSections = useMemo(() => {
    return job?.description ? parseJobMarkdown(job.description) : [];
  }, [job?.description]);

  const handleSaveToggle = () => {
    if (!isAuthenticated) {
      setLocation(`/login?returnTo=/jobs/${jobId}`);
      return;
    }
    if (isSaved) {
      unsaveJob.mutate(jobId, {
        onSuccess: () => toast({ title: "Job removed from saved" }),
        onError: () => toast({ title: "Failed to unsave job", variant: "destructive" }),
      });
    } else {
      saveJob.mutate(jobId, {
        onSuccess: () => toast({ title: "Job saved!" }),
        onError: () => toast({ title: "Failed to save job", variant: "destructive" }),
      });
    }
  };

  const handleShare = async () => {
    if (!job) return;
    const url = `${window.location.origin}/jobs/${jobId}`;
    const result = await shareJob({
      url,
      title: job.title,
      text: `Check out this vacancy at NISIT: ${job.title}`,
    });
    if (result === "copied") {
      setCopied(true);
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } else if (result === "error") {
      toast({ title: "Could not share link", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto text-center py-20">
          <p className="text-muted-foreground">Vacancy not found or has been withdrawn.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/jobs")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Vacancies
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/jobs")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Vacancies
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleShare}
              title="Share vacancy link"
              data-testid="button-share-job"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
            </Button>
            {canBookmark && (
              <Button
                size="icon"
                variant="outline"
                className={`h-8 w-8 ${isSaved ? "text-primary border-primary bg-primary/5" : "text-muted-foreground hover:text-primary"}`}
                onClick={handleSaveToggle}
                title={isSaved ? "Remove from saved" : "Bookmark this vacancy"}
                data-testid="button-save-job"
                disabled={saveJob.isPending || unsaveJob.isPending}
              >
                {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* ── WHO / UNICEF STYLE VACANCY HEADER BANNER ──────── */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-primary via-amber-500 to-primary" />
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isPublished ? "default" : "secondary"} className="uppercase font-semibold tracking-wide text-xs">
                    {job.status === "published" || job.status === "open" ? "Active Vacancy" : job.status}
                  </Badge>
                  {job.isFeatured && (
                    <Badge variant="outline" className="gap-1 text-amber-700 bg-amber-50 border-amber-300">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured Position
                    </Badge>
                  )}
                  {job.referenceNumber && (
                    <span className="text-xs font-mono bg-muted text-muted-foreground px-2.5 py-1 rounded-md border border-border/60">
                      Ref: {job.referenceNumber}
                    </span>
                  )}
                  {daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7 && (
                    <Badge variant="destructive" className="text-xs">
                      Closes in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground" data-testid="heading-job-title">
                  {job.title}
                </h1>

                <p className="text-sm text-muted-foreground font-medium">
                  Papua New Guinea National Institute of Standards and Industrial Technology (NISIT)
                </p>
              </div>

              {/* Primary Call-to-action */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 justify-start">
                {isPublished && existingApplication ? (
                  <Link href="/my-applications">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-semibold"
                      data-testid="button-already-applied"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      View Submitted Application
                    </Button>
                  </Link>
                ) : isPublished ? (
                  <Button size="lg" className="w-full font-semibold shadow-sm text-base px-6 h-11" onClick={() => setWizardOpen(true)} data-testid="button-apply-now">
                    <Send className="h-4 w-4 mr-2" /> Apply for Position
                  </Button>
                ) : null}
              </div>
            </div>

            {/* ── UN / WHO STYLE VACANCY QUICK FACTS GRID ──────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-border/80 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <span className="text-muted-foreground font-medium block mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-primary" /> Duty Station
                </span>
                <span className="font-semibold text-foreground truncate block" title={job.province || job.location || "Port Moresby"}>
                  {job.province || job.location || "Port Moresby, PNG"}
                </span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <span className="text-muted-foreground font-medium block mb-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary" /> Department
                </span>
                <span className="font-semibold text-foreground truncate block">
                  {job.departmentId ? `Dept #${job.departmentId}` : "Standards & Metrology"}
                </span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <span className="text-muted-foreground font-medium block mb-1 flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-primary" /> Contract Modality
                </span>
                <span className="font-semibold text-foreground block">
                  {job.employmentType ? (EMPLOYMENT_LABELS[job.employmentType] ?? job.employmentType) : "Full-time"}
                </span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <span className="text-muted-foreground font-medium block mb-1 flex items-center gap-1">
                  <GraduationCap className="h-3 w-3 text-primary" /> Grade / Band
                </span>
                <span className="font-semibold text-foreground block">
                  {job.gradeBand || "Officer Grade"}
                </span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <span className="text-muted-foreground font-medium block mb-1 flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-600" /> Remuneration
                </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 block truncate">
                  {showSalary ? `${job.salaryCurrency ?? "PGK"} ${(job.salaryMin ?? 0).toLocaleString()} – ${(job.salaryMax ?? 0).toLocaleString()}` : "Public Service Scale"}
                </span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <span className="text-muted-foreground font-medium block mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-amber-600" /> Closing Date
                </span>
                <span className="font-semibold text-foreground block">
                  {job.closingDate ? new Date(job.closingDate).toLocaleDateString() : "Open until filled"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Draft resume banner */}
        {isPublished && !existingApplication && (
          <DraftBanner jobId={jobId} onResume={() => setWizardOpen(true)} />
        )}

        {/* ── PARSED STRUCTURED SECTIONS (WHO / UNICEF STYLE) ──── */}
        {parsedSections.length > 0 ? (
          <div className="space-y-6">
            {parsedSections.map((section, idx) => (
              <Card key={idx} className="shadow-xs border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/60 py-4 px-6">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                    {getSectionIcon(section.title)}
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {section.paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="text-sm text-foreground/90 leading-relaxed font-normal">
                      {p}
                    </p>
                  ))}

                  {section.items.length > 0 && (
                    <ul className="space-y-2.5 pt-1">
                      {section.items.map((item, iIdx) => (
                        <li key={iIdx} className="flex items-start gap-3 text-sm text-foreground/90 leading-relaxed">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Fallback when structured markdown is not present */
          <div className="space-y-6">
            {job.jobSummary && (
              <Card className="shadow-xs">
                <CardHeader className="bg-muted/30 border-b py-4 px-6">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Building2 className="h-4 w-4 text-primary" /> Position Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-sm text-foreground/90 leading-relaxed">{job.jobSummary}</p>
                </CardContent>
              </Card>
            )}

            {job.description && (
              <Card className="shadow-xs">
                <CardHeader className="bg-muted/30 border-b py-4 px-6">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <FileCheck className="h-4 w-4 text-primary" /> Key Responsibilities & Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Requirements Badges (if configured in columns) */}
        {(job.minEducation || job.yearsExperience || (job.technicalSkills && job.technicalSkills.length > 0) ||
          (job.softSkills && job.softSkills.length > 0) || (job.certifications && job.certifications.length > 0) ||
          job.languageRequirements) && (
          <Card className="shadow-xs border-border">
            <CardHeader className="bg-muted/30 border-b py-4 px-6">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <GraduationCap className="h-4 w-4 text-primary" /> Minimum Eligibility & Competencies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                {job.minEducation && (
                  <div className="bg-muted/30 p-3.5 rounded-lg border border-border/60">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Education Level</p>
                    <p className="font-medium text-foreground">{job.minEducation}</p>
                  </div>
                )}
                {job.yearsExperience != null && (
                  <div className="bg-muted/30 p-3.5 rounded-lg border border-border/60">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Professional Experience</p>
                    <p className="font-medium text-foreground">{job.yearsExperience} Year{job.yearsExperience !== 1 ? "s" : ""}+ relevant practice</p>
                  </div>
                )}
                {job.languageRequirements && (
                  <div className="bg-muted/30 p-3.5 rounded-lg border border-border/60">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Working Languages</p>
                    <p className="font-medium text-foreground">{job.languageRequirements}</p>
                  </div>
                )}
              </div>

              {job.technicalSkills && job.technicalSkills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Technical Competencies</p>
                  <div className="flex flex-wrap gap-2">
                    {job.technicalSkills.map((s) => (
                      <Badge key={s} variant="secondary" className="px-2.5 py-1 text-xs font-medium">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {job.certifications && job.certifications.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Required Certifications & Accreditations</p>
                  <div className="flex flex-wrap gap-2">
                    {job.certifications.map((c) => (
                      <Badge key={c} variant="outline" className="px-2.5 py-1 text-xs border-primary/40 text-primary font-medium">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Required Documents */}
        {job.requiredDocuments && job.requiredDocuments.length > 0 && (
          <Card className="shadow-xs border-border">
            <CardHeader className="bg-muted/30 border-b py-4 px-6">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <FileCheck className="h-4 w-4 text-primary" /> Application Submission Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground mb-3">Applicants must prepare digital copies of the following documents in PDF format:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {job.requiredDocuments.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-3 rounded-lg border border-border/80 bg-background text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-medium text-foreground">{doc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── PUBLIC SERVICE & EQUAL OPPORTUNITY NOTICE (UN/WHO STYLE) ── */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800/40 p-5 space-y-2 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-bold flex items-center gap-1.5 text-sm text-amber-950 dark:text-amber-100">
            <Star className="h-4 w-4 text-amber-600 fill-amber-500" />
            Papua New Guinea Public Service — Equal Opportunity & Integrity Notice
          </p>
          <p className="leading-relaxed text-muted-foreground/90 dark:text-amber-200/80">
            The Papua New Guinea National Institute of Standards and Industrial Technology (NISIT) is committed to merit-based recruitment under the Public Service (Management) Act. All eligible Papua New Guinean citizens are encouraged to apply. NISIT does not charge fees at any stage of the recruitment process. Canvassing or interference will lead to automatic disqualification.
          </p>
        </div>

        {/* Admin Application Pipeline Card */}
        {canViewPipeline && <ApplicationPipelineCard jobId={job.id} canManageJobs={canManageJobs} />}

        {/* Bottom Call to Action for Applicants */}
        {isPublished && !existingApplication && (
          <div className="p-6 rounded-xl bg-muted/40 border border-border text-center space-y-3">
            <h3 className="text-lg font-bold text-foreground">Ready to submit your application?</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Complete your online profile, upload required credentials, and respond to screening criteria before the deadline.
            </p>
            <Button size="lg" className="font-semibold shadow-sm px-8" onClick={() => setWizardOpen(true)} data-testid="button-apply-now-bottom">
              <Send className="h-4 w-4 mr-2" /> Begin Application
            </Button>
          </div>
        )}

        {/* Apply Wizard */}
        {!existingApplication && (
          <ApplyWizard
            jobId={job.id}
            jobTitle={job.title}
            screeningQuestions={screeningQuestions}
            open={wizardOpen}
            onOpenChange={setWizardOpen}
          />
        )}
      </div>
    </AppLayout>
  );
}
