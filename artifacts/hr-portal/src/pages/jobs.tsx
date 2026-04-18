import { useState } from "react";
import { Link } from "wouter";
import { Plus, Search, Eye, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useGetJobs, useDeleteJob, usePublishJob, useCloseJob, useGetDepartments, getGetJobsQueryKey } from "@workspace/api-client-react";
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

const WORK_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  casual: "Casual",
};

const PNG_PROVINCES_JOBS = [
  "National Capital District", "Central", "Gulf", "Western", "Oro (Northern)",
  "Milne Bay", "Morobe", "Madang", "Eastern Highlands", "Western Highlands",
  "Jiwaka", "Chimbu (Simbu)", "Southern Highlands", "Hela", "Enga",
  "Sandaun (West Sepik)", "East Sepik", "Manus", "New Ireland",
  "East New Britain", "West New Britain", "Bougainville (AROB)",
];

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [workTypeFilter, setWorkTypeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const { canManageJobs } = useRole();
  const { agencyId } = useAuth();

  const { data: departments = [] } = useGetDepartments(
    { agency_id: agencyId ?? undefined },
    {}
  );

  const jobs = useGetJobs(
    {
      agency_id: agencyId ?? undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      department_id: deptFilter !== "all" ? parseInt(deptFilter) : undefined,
    },
    {
      query: {
        queryKey: getGetJobsQueryKey({
          agency_id: agencyId ?? undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          department_id: deptFilter !== "all" ? parseInt(deptFilter) : undefined,
        }),
      },
    }
  );

  const filtered = jobs.data?.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase());
    const jobWorkType = (j as Job & { workType?: string }).workType ?? "";
    const matchWorkType = workTypeFilter === "all" || jobWorkType === workTypeFilter;
    const jobLocation = (j as Job & { location?: string }).location ?? "";
    const matchLocation = locationFilter === "all" ||
      jobLocation.toLowerCase().includes(locationFilter.toLowerCase());
    return matchSearch && matchWorkType && matchLocation;
  }) ?? [];

  const hasFilters = search || deptFilter !== "all" || workTypeFilter !== "all" || locationFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => { setSearch(""); setDeptFilter("all"); setWorkTypeFilter("all"); setLocationFilter("all"); setStatusFilter("all"); };

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
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search job titles..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-jobs"
                />
              </div>
              {departments.length > 0 && (
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-44" data-testid="select-dept-filter">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
                <SelectTrigger className="w-44" data-testid="select-worktype-filter">
                  <SelectValue placeholder="Employment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-48" data-testid="select-location-filter">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {PNG_PROVINCES_JOBS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {hasFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear filters
                </Button>
              )}
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
                        <p>No jobs found matching your filters.</p>
                        {hasFilters && (
                          <button className="text-sm text-primary underline mt-2 cursor-pointer" onClick={clearFilters}>
                            Clear filters
                          </button>
                        )}
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
