import { useState } from "react";
import { useGetMyApplications, useGetJobs } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ClipboardList, Calendar, ArrowRight, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

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

export default function MyApplicationsPage() {
  const [filter, setFilter] = useState<string>("all");

  const { data: allApplications = [], isLoading } = useGetMyApplications();
  const { data: jobs = [] } = useGetJobs({});

  const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j]));

  const myApplications = allApplications.filter((app) => {
    if (filter !== "all" && app.status !== filter) return false;
    return true;
  });

  const statusCounts = allApplications.reduce(
    (acc, app) => ({ ...acc, [app.status]: (acc[app.status] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  const activeCount = allApplications.filter((a) => !["rejected", "withdrawn"].includes(a.status)).length;

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
          {["all", "applied", "screening", "interview", "offer", "hired", "rejected"].map((s) => (
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

                    <div className="mt-3 pt-3 border-t">
                      <ApplicationProgressBar status={app.status} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const PIPELINE_STEPS = ["applied", "screening", "interview", "offer", "hired"];

function ApplicationProgressBar({ status }: { status: string }) {
  if (status === "rejected" || status === "withdrawn") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <XCircle className="h-3.5 w-3.5 text-destructive" />
        <span className="capitalize text-destructive font-medium">{status === "rejected" ? "Not selected for this position" : "Application withdrawn"}</span>
      </div>
    );
  }

  const currentIdx = PIPELINE_STEPS.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const current = idx === currentIdx;
        const config = STATUS_CONFIG[step];
        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-0.5 flex-1">
              <div className={`h-1.5 w-full rounded-full ${done || current ? "bg-primary" : "bg-muted"}`} />
              {current && (
                <span className="text-xs font-medium text-primary whitespace-nowrap hidden sm:block">{config?.label}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
