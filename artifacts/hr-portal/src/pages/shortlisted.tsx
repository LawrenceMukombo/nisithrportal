import { useState } from "react";
import { Link } from "wouter";
import {
  useGetApplications,
  useGetJobs,
  useUpdateApplicationStatus,
  getGetApplicationsQueryKey,
} from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ChevronRight, Users2, Briefcase, ArrowRight } from "lucide-react";

const NEXT_STAGE: Record<string, { status: string; label: string; icon: React.ElementType }> = {
  screening: { status: "interview", label: "Move to Interview", icon: ArrowRight },
  interview: { status: "offer",     label: "Advance to Offer",  icon: CheckCircle },
};

const REVIEW_STATUSES = ["screening", "interview"] as const;

const STATUS_COLORS: Record<string, string> = {
  screening: "bg-yellow-100 text-yellow-700",
  interview: "bg-purple-100 text-purple-700",
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
      toast({ title: "Decision recorded", description: `Application moved to "${targetStatus}".` });
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

  const appsQuery = useGetApplications(
    {},
    { query: { queryKey: getGetApplicationsQueryKey() } }
  );

  const jobsQuery = useGetJobs({}, { query: { queryKey: ["jobs-list"] as const } });

  const jobMap = new Map(
    (jobsQuery.data ?? []).map((j) => [j.id, j.title])
  );

  const pending = (appsQuery.data ?? []).filter((a) =>
    REVIEW_STATUSES.includes(a.status as typeof REVIEW_STATUSES[number])
  );

  const filtered =
    selectedStatus === "all"
      ? pending
      : pending.filter((a) => a.status === selectedStatus);

  const byJob = filtered.reduce<Record<number, Application[]>>((acc, app) => {
    (acc[app.jobId] = acc[app.jobId] || []).push(app);
    return acc;
  }, {});

  const isLoading = appsQuery.isLoading || jobsQuery.isLoading;

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shortlisted Candidates</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Review candidates in screening or interview stage and make approval decisions.
            </p>
          </div>
          <Badge variant="secondary" className="mt-1">
            {pending.length} pending review
          </Badge>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", ...REVIEW_STATUSES] as string[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={selectedStatus === s ? "default" : "outline"}
              onClick={() => setSelectedStatus(s)}
              data-testid={`filter-${s}`}
            >
              {s === "all" ? "All Pending" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && Object.keys(byJob).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Users2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">No candidates pending review.</p>
            <p className="text-xs">Candidates appear here when moved to Screening or Interview stage.</p>
          </div>
        )}

        {!isLoading && Object.entries(byJob).map(([jobId, apps]) => (
          <Card key={jobId} data-testid={`job-group-${jobId}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">
                  {jobMap.get(Number(jobId)) ?? `Job #${jobId}`}
                </CardTitle>
              </div>
              <CardDescription>{apps.length} candidate(s) pending decision</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-3 space-y-3">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
                  data-testid={`row-app-${app.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">Candidate #{app.candidateId}</span>
                      <Badge
                        className={`text-xs ${STATUS_COLORS[app.status] ?? ""}`}
                        variant="outline"
                      >
                        {app.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        Applied {new Date(app.createdAt ?? "").toLocaleDateString()}
                      </span>
                      {app.score != null && (
                        <span className="text-xs text-muted-foreground">Score: {app.score}</span>
                      )}
                      <Link
                        href={`/applications/${app.id}`}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        data-testid={`link-app-detail-${app.id}`}
                      >
                        Full profile <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
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
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
