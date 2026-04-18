import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMyApplications, useGetJobs, getGetMyApplicationsQueryKey } from "@workspace/api-client-react";
import { getToken } from "@/lib/api-config";
import { AppLayout } from "@/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Link } from "wouter";
import { ClipboardList, Calendar, ArrowRight, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, FileEdit, Trash2 } from "lucide-react";
import { ApplicationTimeline } from "@/components/application-timeline";
import { DRAFT_KEY_PREFIX } from "@/components/apply-wizard";

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  applied: { label: "Applied", variant: "secondary", icon: Clock, color: "text-blue-500" },
  screening: { label: "Under Review", variant: "default", icon: AlertCircle, color: "text-amber-500" },
  interview: { label: "Interview Scheduled", variant: "default", icon: AlertCircle, color: "text-purple-500" },
  offer: { label: "Offer Received", variant: "default", icon: CheckCircle2, color: "text-green-500" },
  hired: { label: "Hired", variant: "default", icon: CheckCircle2, color: "text-green-600" },
  rejected: { label: "Not Selected", variant: "destructive", icon: XCircle, color: "text-red-500" },
  withdrawn: { label: "Withdrawn", variant: "outline", icon: XCircle, color: "text-gray-400" },
};

const TERMINAL_STATUSES = ["rejected", "withdrawn", "hired"];

type LocalDraft = { jobId: number; savedAt: string | null; step: number };

function scanLocalDrafts(): LocalDraft[] {
  const drafts: LocalDraft[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DRAFT_KEY_PREFIX)) continue;
    const jobId = parseInt(key.slice(DRAFT_KEY_PREFIX.length), 10);
    if (isNaN(jobId)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { step?: number; savedAt?: string };
      drafts.push({ jobId, savedAt: parsed.savedAt ?? null, step: parsed.step ?? 0 });
    } catch {
      // Malformed entry — skip and continue scanning
    }
  }
  return drafts.sort((a, b) => {
    if (!a.savedAt && !b.savedAt) return 0;
    if (!a.savedAt) return 1;
    if (!b.savedAt) return -1;
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });
}

export default function MyApplicationsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [withdrawDialogId, setWithdrawDialogId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);

  const queryClient = useQueryClient();
  const { data: allApplications = [], isLoading } = useGetMyApplications();
  const { data: jobs = [] } = useGetJobs({});

  useEffect(() => {
    setDrafts(scanLocalDrafts());
  }, []);

  const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j]));

  const discardDraft = (jobId: number) => {
    localStorage.removeItem(`${DRAFT_KEY_PREFIX}${jobId}`);
    setDrafts((prev) => prev.filter((d) => d.jobId !== jobId));
  };

  const withdrawMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const token = getToken();
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: "withdrawn" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to withdraw application");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetMyApplicationsQueryKey() });
    },
  });

  const myApplications = allApplications.filter((app) => {
    if (filter !== "all" && app.status !== filter) return false;
    return true;
  });

  const statusCounts = allApplications.reduce(
    (acc, app) => ({ ...acc, [app.status]: (acc[app.status] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  const activeCount = allApplications.filter((a) => !["rejected", "withdrawn"].includes(a.status)).length;

  const toggleTimeline = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleWithdrawConfirm = () => {
    if (withdrawDialogId == null) return;
    withdrawMutation.mutate(withdrawDialogId, {
      onSettled: () => setWithdrawDialogId(null),
    });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="heading-my-applications">My Applications</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="cursor-pointer" onClick={() => setFilter("all")}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{allApplications.length}</p>
              <p className="text-xs text-muted-foreground">Total Applied</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setFilter("all")}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setFilter("offer")}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-purple-600">{(statusCounts["offer"] ?? 0) + (statusCounts["hired"] ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Offers</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setFilter("interview")}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-600">{statusCounts["interview"] ?? 0}</p>
              <p className="text-xs text-muted-foreground">Interviews</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          {["all", "applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : (STATUS_CONFIG[s]?.label ?? s)}
              {s !== "all" && statusCounts[s] ? ` (${statusCounts[s]})` : ""}
            </button>
          ))}
        </div>

        {drafts.length > 0 && (
          <div data-testid="drafts-section">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
              <FileEdit className="h-4 w-4 text-primary" />
              Saved Drafts
              <span className="text-xs font-normal text-muted-foreground">({drafts.length})</span>
            </h2>
            <div className="space-y-3">
              {drafts.map((draft) => {
                const job = jobMap[draft.jobId];
                return (
                  <Card key={draft.jobId} className="border-dashed border-amber-300 bg-amber-50/40 dark:bg-amber-950/10" data-testid={`card-draft-${draft.jobId}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {job ? job.title : `Job #${draft.jobId}`}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {draft.savedAt
                              ? `Last saved ${new Date(draft.savedAt).toLocaleString()}`
                              : "Draft saved"}
                            {" · "}Step {draft.step + 1} of application
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/jobs/${draft.jobId}?apply=1`}>
                            <Button size="sm" className="h-7 text-xs gap-1.5" data-testid={`btn-resume-draft-${draft.jobId}`}>
                              <ArrowRight className="h-3 w-3" />
                              Resume
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => discardDraft(draft.jobId)}
                            data-testid={`btn-discard-draft-${draft.jobId}`}
                            title="Discard draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : myApplications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {filter === "all" ? "You haven't applied to any jobs yet." : `No applications with status "${filter}".`}
              </p>
              <Link href="/jobs">
                <span className="text-primary hover:underline text-sm cursor-pointer mt-2 block">Browse job vacancies →</span>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {myApplications.map((app) => {
              const job = jobMap[app.jobId];
              const config = STATUS_CONFIG[app.status] ?? { label: app.status, variant: "outline" as const, icon: Clock, color: "" };
              const Icon = config.icon;
              const isExpanded = expandedIds.has(app.id);
              const isTerminal = TERMINAL_STATUSES.includes(app.status);

              return (
                <Card key={app.id} className="hover:shadow-md transition-shadow" data-testid="card-application">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {job ? job.title : `Job #${app.jobId}`}
                        </h3>
                        {job?.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">{job.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={config.variant} className="flex items-center gap-1 whitespace-nowrap">
                          <Icon className={`h-3 w-3 ${config.color}`} />
                          {config.label}
                        </Badge>
                        <Link href={`/jobs/${app.jobId}`}>
                          <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                            View Job <ArrowRight className="h-3 w-3" />
                          </span>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!isTerminal && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setWithdrawDialogId(app.id)}
                            data-testid={`btn-withdraw-${app.id}`}
                          >
                            Withdraw
                          </Button>
                        )}
                      </div>
                      <button
                        onClick={() => toggleTimeline(app.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Hide timeline" : "Show timeline"}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                        data-testid={`btn-toggle-timeline-${app.id}`}
                      >
                        {isExpanded ? (
                          <>Hide <ChevronUp className="h-3.5 w-3.5" /></>
                        ) : (
                          <>View all stages <ChevronDown className="h-3.5 w-3.5" /></>
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-1" data-testid={`timeline-${app.id}`}>
                        <ApplicationTimeline status={app.status} statusHistory={app.statusHistory} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={withdrawDialogId != null}
        onOpenChange={(open) => { if (!open) setWithdrawDialogId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. Once withdrawn, your application will be removed from the recruitment process and cannot be reinstated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWithdrawConfirm}
              disabled={withdrawMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-withdraw"
            >
              {withdrawMutation.isPending ? "Withdrawing…" : "Yes, withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
