import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetApplications,
  useGetCandidates,
  useGetJobs,
  useUpdateApplicationStatus,
  getGetApplicationsQueryKey,
  getGetCandidatesQueryKey,
  getGetJobsQueryKey,
} from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  Users2,
  Briefcase,
  ArrowRight,
  Search,
  Mail,
  Phone,
  User,
  Star,
} from "lucide-react";

const REVIEW_STATUSES = [
  "shortlisted",
  "screening",
  "assessment",
  "interview",
  "interview_scheduled",
  "interview_completed",
  "evaluation",
] as const;

const NEXT_STAGE: Record<string, { status: string; label: string; icon: React.ElementType }> = {
  shortlisted: { status: "interview", label: "Schedule Interview", icon: ArrowRight },
  screening: { status: "shortlisted", label: "Move to Shortlist", icon: CheckCircle },
  assessment: { status: "interview", label: "Move to Interview", icon: ArrowRight },
  interview: { status: "offer", label: "Advance to Offer", icon: CheckCircle },
  interview_scheduled: { status: "interview_completed", label: "Mark Interview Done", icon: CheckCircle },
  interview_completed: { status: "offer", label: "Advance to Offer", icon: CheckCircle },
  evaluation: { status: "offer", label: "Advance to Offer", icon: CheckCircle },
};

const STATUS_LABELS: Record<string, string> = {
  shortlisted: "Shortlisted",
  screening: "Under Review / Screening",
  assessment: "Assessment",
  interview: "Interview",
  interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  evaluation: "Evaluation",
};

const STATUS_COLORS: Record<string, string> = {
  shortlisted: "bg-violet-100 text-violet-800 border-violet-300",
  screening: "bg-yellow-100 text-yellow-800 border-yellow-300",
  assessment: "bg-orange-100 text-orange-800 border-orange-300",
  interview: "bg-purple-100 text-purple-800 border-purple-300",
  interview_scheduled: "bg-indigo-100 text-indigo-800 border-indigo-300",
  interview_completed: "bg-teal-100 text-teal-800 border-teal-300",
  evaluation: "bg-pink-100 text-pink-800 border-pink-300",
};

function ActionButton({
  app,
  targetStatus,
  label,
  icon: Icon,
  variant,
}: {
  app: Application;
  targetStatus: string;
  label: string;
  icon: React.ElementType;
  variant: "default" | "destructive" | "outline";
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const update = useUpdateApplicationStatus();

  const handleClick = async () => {
    try {
      await update.mutateAsync({ id: app.id, data: { status: targetStatus } });
      await qc.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
      toast({ title: "Decision recorded", description: `Application #${app.id} moved to "${targetStatus}".` });
    } catch {
      toast({ title: "Action failed", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={update.isPending}
      onClick={handleClick}
      data-testid={`btn-${targetStatus}-${app.id}`}
    >
      <Icon className="h-3.5 w-3.5 mr-1.5" />
      {label}
    </Button>
  );
}

export default function ShortlistedPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const appsQuery = useGetApplications(
    {},
    { query: { queryKey: getGetApplicationsQueryKey() } }
  );

  const candidatesQuery = useGetCandidates({ query: { queryKey: getGetCandidatesQueryKey() } });
  const jobsQuery = useGetJobs(undefined, { query: { queryKey: getGetJobsQueryKey() } });

  const candidateMap = useMemo(
    () => new Map((candidatesQuery.data ?? []).map((c) => [c.id, c])),
    [candidatesQuery.data]
  );

  const jobMap = useMemo(
    () => new Map((jobsQuery.data ?? []).map((j) => [j.id, j])),
    [jobsQuery.data]
  );

  const allApps = appsQuery.data ?? [];
  const pending = useMemo(() => {
    return allApps.filter((a) =>
      REVIEW_STATUSES.includes(a.status as typeof REVIEW_STATUSES[number])
    );
  }, [allApps]);

  const filtered = useMemo(() => {
    let result = pending;
    if (selectedStatus !== "all") {
      result = result.filter((a) => a.status === selectedStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((a) => {
        const candidate = candidateMap.get(a.candidateId);
        const job = jobMap.get(a.jobId);
        return (
          candidate?.name?.toLowerCase().includes(q) ||
          candidate?.email?.toLowerCase().includes(q) ||
          candidate?.phone?.toLowerCase().includes(q) ||
          job?.title?.toLowerCase().includes(q) ||
          String(a.id).includes(q)
        );
      });
    }
    return result;
  }, [pending, selectedStatus, search, candidateMap, jobMap]);

  const byJob = useMemo(() => {
    return filtered.reduce<Record<number, Application[]>>((acc, app) => {
      (acc[app.jobId] = acc[app.jobId] || []).push(app);
      return acc;
    }, {});
  }, [filtered]);

  const isLoading = appsQuery.isLoading || jobsQuery.isLoading || candidatesQuery.isLoading;

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-shortlisted">
              Shortlisted Candidates
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Review shortlisted candidates across screening, assessments, and interviews to advance them towards hiring decisions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
              {pending.length} in pipeline
            </Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shortlisted candidates by name, job, or ID…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-shortlisted"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={selectedStatus === "all" ? "default" : "outline"}
              onClick={() => setSelectedStatus("all")}
              data-testid="filter-all"
            >
              All ({pending.length})
            </Button>
            {REVIEW_STATUSES.map((s) => {
              const count = pending.filter((a) => a.status === s).length;
              if (count === 0 && selectedStatus !== s) return null;
              return (
                <Button
                  key={s}
                  size="sm"
                  variant={selectedStatus === s ? "default" : "outline"}
                  onClick={() => setSelectedStatus(s)}
                  data-testid={`filter-${s}`}
                >
                  {STATUS_LABELS[s] ?? s} ({count})
                </Button>
              );
            })}
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && Object.keys(byJob).length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-center">
              <Users2 className="h-12 w-12 opacity-30 text-primary" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  {search ? "No matching shortlisted candidates found" : "No candidates currently pending review"}
                </p>
                <p className="text-xs max-w-md">
                  {search
                    ? "Try adjusting your search criteria or filter tabs."
                    : "Candidates moved to Shortlisted, Screening, Assessment, or Interview stages in the Applications list will appear here."}
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <Link href="/applications">
                  <Button variant="outline" size="sm">
                    View All Applications
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          Object.entries(byJob).map(([jobId, apps]) => {
            const job = jobMap.get(Number(jobId));
            return (
              <Card key={jobId} data-testid={`job-group-${jobId}`} className="shadow-sm">
                <CardHeader className="pb-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base font-semibold">
                        {job?.title ?? `Job #${jobId}`}
                      </CardTitle>
                    </div>
                    {job?.location && (
                      <Badge variant="outline" className="text-xs">
                        {job.location}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {apps.length} candidate{apps.length !== 1 ? "s" : ""} currently in recruitment review for this role
                  </CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-3 divide-y divide-border">
                  {apps.map((app) => {
                    const candidate = candidateMap.get(app.candidateId);
                    const candidateName = candidate?.name ?? `Candidate #${app.candidateId}`;
                    return (
                      <div
                        key={app.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1"
                        data-testid={`row-app-${app.id}`}
                      >
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/candidates/${app.candidateId}`}>
                              <span className="font-semibold text-foreground hover:text-primary hover:underline cursor-pointer flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                {candidateName}
                              </span>
                            </Link>
                            <Badge
                              className={`text-xs ${STATUS_COLORS[app.status] ?? ""}`}
                              variant="outline"
                            >
                              {STATUS_LABELS[app.status] ?? app.status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {candidate?.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {candidate.email}
                              </span>
                            )}
                            {candidate?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {candidate.phone}
                              </span>
                            )}
                            <span>
                              Applied: {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "—"}
                            </span>
                            {app.score != null && (
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                Match Score: {app.score}%
                              </span>
                            )}
                          </div>

                          <div>
                            <Link
                              href={`/applications/${app.id}`}
                              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 font-medium"
                              data-testid={`link-app-detail-${app.id}`}
                            >
                              View Full Application & Evaluation Dossier <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>

                        <div className="flex gap-2 shrink-0 self-start sm:self-center">
                          {(() => {
                            const next = NEXT_STAGE[app.status];
                            if (!next) return null;
                            return (
                              <ActionButton
                                app={app}
                                targetStatus={next.status}
                                label={next.label}
                                icon={next.icon}
                                variant="default"
                              />
                            );
                          })()}
                          <ActionButton
                            app={app}
                            targetStatus="rejected"
                            label="Reject"
                            icon={XCircle}
                            variant="outline"
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </AppLayout>
  );
}
