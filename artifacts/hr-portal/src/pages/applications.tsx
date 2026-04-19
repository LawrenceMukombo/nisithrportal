import { useState, useMemo, useEffect } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { Search } from "lucide-react";
import { getToken } from "@/lib/api-config";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn, type BulkAction } from "@/components/ui/data-table";

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

const BULK_ACTIONS: BulkAction[] = [
  { label: "Move to Review", value: "screening" },
  { label: "Shortlist", value: "interview" },
  { label: "Reject", value: "rejected" },
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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [, setLocation] = useLocation();

  // select-all-results state: null = not active, array = backend-fetched full ID set
  const [allResultIds, setAllResultIds] = useState<number[] | null>(null);
  const [allResultsLoading, setAllResultsLoading] = useState(false);
  // mirror of DataTable's current selection, updated via onSelectionChange
  const [tableSelectedIds, setTableSelectedIds] = useState<(number | string)[]>([]);

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

  const filteredIds = useMemo(() => filtered.map((a) => a.id), [filtered]);

  // Reset select-all-results mode whenever filters change
  useEffect(() => {
    setAllResultIds(null);
    setTableSelectedIds([]);
  }, [statusFilter, search]);

  // Whether all visible rows are currently selected in the DataTable
  const allVisibleSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => tableSelectedIds.includes(id));

  async function fetchAllResultIds() {
    setAllResultsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const token = getToken();
      const res = await fetch(`/api/applications/ids?${params.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error("Failed to fetch all matching IDs");
      const { ids } = await res.json() as { ids: number[]; total: number };
      setAllResultIds(ids);
    } catch {
      toast({ title: "Could not select all results. Please try again.", variant: "destructive" });
    } finally {
      setAllResultsLoading(false);
    }
  }

  async function handleBulkAction(ids: (number | string)[], action: string) {
    // If in select-all-results mode, use the backend-resolved IDs instead
    const targetIds: (number | string)[] = allResultIds !== null ? allResultIds : ids;
    if (targetIds.length === 0) return;
    setBulkLoading(true);
    try {
      const token = getToken();
      const BATCH = 500;
      let totalUpdated = 0;
      for (let i = 0; i < targetIds.length; i += BATCH) {
        const chunk = targetIds.slice(i, i + BATCH);
        const res = await fetch("/api/applications/bulk-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ids: chunk, status: action }),
        });
        if (!res.ok) throw new Error("Bulk update failed");
        const { updated } = await res.json() as { updated: number };
        totalUpdated += updated;
      }
      await queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
      setAllResultIds(null);
      setTableSelectedIds([]);
      const actionLabel = BULK_ACTIONS.find((a) => a.value === action)?.label ?? action;
      toast({ title: `${totalUpdated} application${totalUpdated !== 1 ? "s" : ""} updated to "${actionLabel}"` });
    } catch {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  }

  const columns: DataTableColumn<Application>[] = useMemo(() => [
    {
      key: "id",
      label: "ID",
      sortable: true,
      csvValue: (a) => a.id,
      renderCell: (a) => (
        <Link href={`/applications/${a.id}`}>
          <span className="text-primary hover:underline cursor-pointer font-medium">#{a.id}</span>
        </Link>
      ),
    },
    {
      key: "job",
      label: "Job",
      sortable: true,
      csvValue: (a) => jobMap.get(a.jobId)?.title ?? `Job #${a.jobId}`,
      renderCell: (a) => (
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
      csvValue: (a) => candidateMap.get(a.candidateId)?.name ?? `Candidate #${a.candidateId}`,
      renderCell: (a) => (
        <Link href={`/candidates/${a.candidateId}`}>
          <span className="hover:underline cursor-pointer text-muted-foreground">
            {candidateMap.get(a.candidateId)?.name ?? `Candidate #${a.candidateId}`}
          </span>
        </Link>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      csvValue: (a) => a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "",
      renderCell: (a) => (
        <span className="text-muted-foreground">
          {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      csvValue: (a) => STATUS_LABELS[a.status ?? "applied"] ?? (a.status ?? ""),
      renderCell: (a) => (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs ${STATUS_BADGE_CLASSES[a.status ?? "applied"] ?? ""}`}
            data-testid={`badge-status-${a.id}`}
          >
            {STATUS_LABELS[a.status ?? "applied"] ?? a.status}
          </Badge>
          <StatusSelect app={a} />
        </div>
      ),
    },
  ], [candidateMap, jobMap]);

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

        {/* select-all-results banners */}
        {allVisibleSelected && !allResultIds && filteredIds.length > 0 && (
          <div
            className="flex items-center justify-center gap-2 py-2 px-3 bg-primary/5 border border-primary/20 rounded-lg text-sm"
            data-testid="select-all-results-banner"
          >
            <span className="text-muted-foreground">
              All {filteredIds.length} rows on this page are selected.
            </span>
            <Button
              size="sm"
              variant="link"
              className="h-auto p-0 text-primary font-medium"
              onClick={fetchAllResultIds}
              disabled={allResultsLoading}
              data-testid="button-select-all-results"
            >
              {allResultsLoading ? "Loading…" : `Select all ${filteredIds.length} applications in this filter`}
            </Button>
          </div>
        )}
        {allResultIds !== null && (
          <div
            className="flex items-center justify-center gap-2 py-2 px-3 bg-primary/5 border border-primary/20 rounded-lg text-sm"
            data-testid="all-results-selected-banner"
          >
            <span className="text-muted-foreground">
              All {allResultIds.length} applications in this filter are selected.
            </span>
            <Button
              size="sm"
              variant="link"
              className="h-auto p-0 text-muted-foreground font-medium"
              onClick={() => setAllResultIds(null)}
              data-testid="button-clear-all-results"
            >
              Clear selection
            </Button>
          </div>
        )}

        {applications.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            getRowId={(a) => a.id}
            emptyMessage="No applications found."
            onRowClick={(a) => setLocation(`/applications/${a.id}`)}
            bulkActions={BULK_ACTIONS}
            onBulkAction={handleBulkAction}
            onSelectionChange={setTableSelectedIds}
            isBulkLoading={bulkLoading}
            data-testid="table-applications"
          />
        )}
      </div>
    </AppLayout>
  );
}
