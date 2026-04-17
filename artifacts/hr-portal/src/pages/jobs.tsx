import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Eye, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useGetJobs, useDeleteJob, usePublishJob, useCloseJob, getGetJobsQueryKey } from "@workspace/api-client-react";
import type { Job } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

function JobRow({ job, canManage }: { job: Job; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useDeleteJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
        toast({ title: "Job deleted" });
      },
    },
  });

  const publishMutation = usePublishJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
        toast({ title: "Job published" });
      },
    },
  });

  const closeMutation = useCloseJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
        toast({ title: "Job closed" });
      },
    },
  });

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-job-${job.id}`}>
      <td className="py-3 px-4">
        <Link href={`/jobs/${job.id}`}>
          <span className="font-medium text-primary hover:underline cursor-pointer" data-testid={`link-job-${job.id}`}>
            {job.title}
          </span>
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">
          Closes: {job.closingDate ? new Date(job.closingDate).toLocaleDateString() : "—"}
        </p>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{job.departmentId ? `Dept #${job.departmentId}` : "—"}</td>
      <td className="py-3 px-4">
        <Badge variant={STATUS_COLORS[job.status ?? "draft"] as "default" | "secondary" | "outline" | "destructive"}>
          {job.status}
        </Badge>
      </td>
      {canManage && (
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            <Link href={`/jobs/${job.id}/edit`}>
              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-edit-job-${job.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Link>
            {job.status === "draft" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600"
                onClick={() => publishMutation.mutate({ id: job.id })}
                disabled={publishMutation.isPending}
                data-testid={`button-publish-job-${job.id}`}
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {job.status === "published" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-orange-600"
                onClick={() => closeMutation.mutate({ id: job.id })}
                disabled={closeMutation.isPending}
                data-testid={`button-close-job-${job.id}`}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => { if (confirm("Delete this job?")) deleteMutation.mutate({ id: job.id }); }}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-job-${job.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { canManageJobs } = useRole();
  const { agencyId } = useAuth();

  const jobs = useGetJobs(
    { agency_id: agencyId ?? undefined, status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getGetJobsQueryKey({ agency_id: agencyId ?? undefined, status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const filtered = jobs.data?.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-jobs">Job Vacancies</h1>
            <p className="text-sm text-muted-foreground mt-1">{jobs.data?.length ?? 0} total vacancies</p>
          </div>
          {canManageJobs && (
            <Link href="/jobs/new">
              <Button data-testid="button-create-job">
                <Plus className="h-4 w-4 mr-2" /> Post Job
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search job titles..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-jobs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {jobs.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="table-jobs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Job Title</th>
                    <th className="text-left py-3 px-4 font-medium">Department</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    {canManageJobs && <th className="text-left py-3 px-4 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={canManageJobs ? 4 : 3} className="text-center py-12 text-muted-foreground">
                        No jobs found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((job) => (
                      <JobRow key={job.id} job={job} canManage={canManageJobs} />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
