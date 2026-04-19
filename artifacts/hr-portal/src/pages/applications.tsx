import { useState, useEffect, useCallback } from "react";
import { Link, useSearch } from "wouter";
import { Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import type { DataTableColumn, DataTableBulkAction } from "@/components/ui/data-table";

const STATUS_OPTIONS = ["applied", "screening", "interview", "offer", "hired", "onboarding", "rejected", "withdrawn"];

const STATUS_LABELS: Record<string, string> = {
  applied: "Pending",
  screening: "Under Review",
  interview: "Shortlisted",
  offer: "Offer",
  hired: "Hired",
  onboarding: "Onboarding",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  applied: "bg-gray-100 text-gray-700 border-gray-200",
  screening: "bg-blue-50 text-blue-700 border-blue-200",
  interview: "bg-violet-50 text-violet-700 border-violet-200",
  offer: "bg-amber-50 text-amber-700 border-amber-200",
  hired: "bg-green-50 text-green-700 border-green-200",
  onboarding: "bg-teal-50 text-teal-700 border-teal-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  withdrawn: "bg-orange-50 text-orange-700 border-orange-200",
};

const BULK_ACTIONS: DataTableBulkAction[] = [
  { label: "Move to Review", value: "screening" },
  { label: "Shortlist", value: "interview" },
  { label: "Reject", value: "rejected", variant: "destructive" },
];

function StatusSelect({ app }: { app: Application }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useUpdateApplicationStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
        toast({ title: "Status updated" });
      },
    },
  });

  return (
    <Select
      value={app.status ?? "applied"}
      onValueChange={(v) => mutation.mutate({ id: app.id, data: { status: v } })}
    >
      <SelectTrigger className="w-36 h-7 text-xs" data-testid={`select-status-${app.id}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s] ?? s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ApplicationsPage() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlStatus = urlParams.get("status");
  const urlSearch = urlParams.get("search") ?? "";
  const initialStatus = urlStatus && STATUS_OPTIONS.includes(urlStatus) ? urlStatus : "all";
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [search, setSearch] = useState(urlSearch);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (urlStatus && STATUS_OPTIONS.includes(urlStatus)) setStatusFilter(urlStatus);
  }, [urlStatus]);

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  const applications = useGetApplications(
    { status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getGetApplicationsQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const { data: candidates = [] } = useGetCandidates({ query: { queryKey: getGetCandidatesQueryKey() } });
  const { data: jobs = [] } = useGetJobs(undefined, { query: { queryKey: getGetJobsQueryKey() } });
  const candidateMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const filtered = useMemo(() => {
    const data = applications.data ?? [];
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((a) => {
      const candidateName = candidateMap.get(a.candidateId)?.name?.toLowerCase() ?? "";
      const jobTitle = jobMap.get(a.jobId)?.title?.toLowerCase() ?? "";
      return (
        candidateName.includes(q) ||
        jobTitle.includes(q) ||
        String(a.id).includes(q) ||
        String(a.jobId).includes(q) ||
        String(a.candidateId).includes(q)
      );
    });
  }, [applications.data, search, candidateMap, jobMap]);

  const handleBulkAction = useCallback(async (ids: number[], action: string) => {
    const res = await fetch("/api/applications/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids, status: action }),
    });
    if (!res.ok) {
      toast({ title: "Bulk update failed", variant: "destructive" });
      return;
    }
    const { updated } = await res.json() as { updated: number };
    await queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
    const actionLabel = BULK_ACTIONS.find((a) => a.value === action)?.label ?? action;
    toast({ title: `${updated} application${updated !== 1 ? "s" : ""} updated to "${actionLabel}"` });
  }, [queryClient, toast]);

  const columns: DataTableColumn<Application>[] = [
    {
      key: "id",
      label: "ID",
      sortable: true,
      sortValue: (a) => a.id,
      exportValue: (a) => String(a.id),
      render: (a) => (
        <Link href={`/applications/${a.id}`}>
          <span className="text-primary hover:underline cursor-pointer font-medium" data-testid={`link-app-${a.id}`}>
            #{a.id}
          </span>
        </Link>
      ),
    },
    {
      key: "job",
      label: "Job",
      sortable: true,
      sortValue: (a) => jobMap.get(a.jobId)?.title ?? "",
      exportValue: (a) => jobMap.get(a.jobId)?.title ?? `Job #${a.jobId}`,
      render: (a) => (
        <Link href={`/jobs/${a.jobId}`}>
          <span className="hover:underline cursor-pointer text-muted-foreground">
            {jobMap.get(a.jobId)?.title ?? `Job #${a.jobId}`}
          </span>
        </Link>
      ),
    },
    {
      key: "candidate",
      label: "Candidate",
      sortable: true,
      sortValue: (a) => candidateMap.get(a.candidateId)?.name ?? "",
      exportValue: (a) => candidateMap.get(a.candidateId)?.name ?? `Candidate #${a.candidateId}`,
      render: (a) => (
        <Link href={`/candidates/${a.candidateId}`}>
          <span className="hover:underline cursor-pointer text-muted-foreground">
            {candidateMap.get(a.candidateId)?.name ?? `Candidate #${a.candidateId}`}
          </span>
        </Link>
      ),
    },
    {
      key: "created",
      label: "Created",
      sortable: true,
      sortValue: (a) => a.createdAt ?? "",
      exportValue: (a) => a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—",
      render: (a) => (
        <span className="text-muted-foreground">
          {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: (a) => a.status ?? "",
      exportValue: (a) => STATUS_LABELS[a.status ?? "applied"] ?? a.status ?? "",
      render: (a) => (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs ${STATUS_BADGE_CLASSES[a.status ?? "applied"] ?? ""}`}
            data-testid={`badge-status-${a.id}`}
          >
            {STATUS_LABELS[a.status ?? "applied"] ?? a.status}
          </Badge>
          <span className="print:hidden">
            <StatusSelect app={a} />
          </span>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-applications">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">{applications.data?.length ?? 0} applications</p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by candidate, job, or ID…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-applications"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="w-44" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(a) => a.id}
          isLoading={applications.isLoading}
          bulkActions={BULK_ACTIONS}
          onBulkAction={handleBulkAction}
          exportFilename="applications"
          data-testid="table-applications"
          emptyState="No applications found"
        />
      </div>
    </AppLayout>
  );
}
