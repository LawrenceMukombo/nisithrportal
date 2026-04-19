import { useState, useEffect, useCallback, useMemo } from "react";
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
import { getToken } from "@/lib/api-config";
import { DataTable } from "@/components/ui/data-table";
import type { DataTableColumn, DataTableBulkAction } from "@/components/ui/data-table";
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

const SKIPPED_REASON_LABELS: Record<"not_found" | "access_denied", string> = {
  not_found: "not found",
  access_denied: "access denied",
};

// Format the bulk-update skipped list into a one-line breakdown for the toast,
// e.g. "2 access denied (#12, #14), 1 not found (#9)". Keeps the message
// actionable without dumping every ID when the list is long.
function describeSkipped(
  skipped: { id: number; reason: "not_found" | "access_denied" }[],
): string | undefined {
  if (skipped.length === 0) return undefined;
  const byReason: Record<string, number[]> = {};
  for (const s of skipped) (byReason[s.reason] ??= []).push(s.id);
  const parts: string[] = [];
  for (const reason of ["access_denied", "not_found"] as const) {
    const ids = byReason[reason];
    if (!ids?.length) continue;
    const sample = ids.slice(0, 3).map((i) => `#${i}`).join(", ");
    const more = ids.length > 3 ? `, +${ids.length - 3} more` : "";
    parts.push(`${ids.length} ${SKIPPED_REASON_LABELS[reason]} (${sample}${more})`);
  }
  return parts.join("; ");
}

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

  // Backend total for the active filter set. Powers the select-all-results banner so the
  // count remains accurate independent of how many rows are currently loaded on the client.
  // If pagination is added to the rows query later, the banner will still report the true
  // total across all pages without any change here.
  const countParams = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (search.trim()) p.set("search", search.trim());
    return p.toString();
  }, [statusFilter, search]);
  const [totalMatchingResults, setTotalMatchingResults] = useState<number | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    // Clear the previous total at the start of every fetch so a failed or in-flight
    // request never leaves a stale count from a different filter set on screen.
    setTotalMatchingResults(undefined);
    const url = `/api/applications/count${countParams ? `?${countParams}` : ""}`;
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { total?: number } | null) => {
        if (cancelled || !body || typeof body.total !== "number") return;
        setTotalMatchingResults(body.total);
      })
      .catch(() => { /* non-blocking — banner just falls back to client count */ });
    return () => { cancelled = true; };
  }, [countParams]);

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

  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  // Confirmation state for filter-based bulk actions. We surface a live match count from
  // the server before running the update so recruiters can see exactly how many records
  // they're about to change — guarding against accidental wide-reaching updates when the
  // backend total is larger than the rows currently visible on screen. Per-id (partial)
  // selections still fire immediately; only the filter-based path requires confirmation.
  const [filterBulkConfirm, setFilterBulkConfirm] = useState<{
    action: string;
    label: string;
    count: number | null;
    countError: boolean;
    resolve: (result: { confirmed: boolean; count: number }) => void;
  } | null>(null);

  const runFilterBulkUpdate = useCallback(async (action: string, actionLabel: string, count: number) => {
    setBulkProgress({ done: 0, total: count });
    try {
      const token = getToken();
      const res = await fetch("/api/applications/bulk-status-by-filter", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          filters: {
            status: statusFilter !== "all" ? statusFilter : null,
            search: search.trim() || null,
          },
          status: action,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null) as { error?: string } | null;
        toast({
          title: "Bulk update failed",
          description: errBody?.error ?? undefined,
          variant: "destructive",
        });
        return;
      }
      const { updated, skipped = [] } = await res.json() as {
        updated: number;
        skipped?: { id: number; reason: "not_found" | "access_denied" }[];
      };
      setBulkProgress({ done: count, total: count });
      await queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
      const skippedDescription = describeSkipped(skipped);
      toast({
        title: `${updated} application${updated !== 1 ? "s" : ""} updated to "${actionLabel}"${skipped.length > 0 ? ` — ${skipped.length} skipped` : ""}`,
        description: skippedDescription,
        variant: skipped.length > 0 ? "destructive" : undefined,
      });
    } finally {
      setBulkProgress(null);
    }
  }, [queryClient, toast, statusFilter, search]);

  const handleBulkAction = useCallback(async (
    ids: number[],
    action: string,
    meta: { allSelected: boolean; totalRows: number },
  ) => {
    const actionLabel = BULK_ACTIONS.find((a) => a.value === action)?.label ?? action;

    // When the recruiter has selected every row in the current filter view (including
    // the explicit select-all-results mode), switch to the filter-based endpoint so the
    // server resolves the target set itself — no ID list crosses the wire and the
    // update runs as one atomic query. This keeps bulk actions correct even once the
    // applications list becomes paginated server-side. Before invoking, we fetch the
    // live server-side match count and present it in a confirm dialog so the recruiter
    // sees the true blast radius (which can exceed the loaded row count) before any
    // change is made.
    const useFilterMode = meta.allSelected && meta.totalRows > 0;
    if (useFilterMode) {
      const { confirmed, count } = await new Promise<{ confirmed: boolean; count: number }>((resolve) => {
        setFilterBulkConfirm({ action, label: actionLabel, count: null, countError: false, resolve });
        // Fetch the live server-side match count in parallel so the dialog updates from
        // a loading state to the real number without blocking the dialog from opening.
        const url = `/api/applications/count${countParams ? `?${countParams}` : ""}`;
        fetch(url, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("count fetch failed"))))
          .then((body: { total?: number }) => {
            if (typeof body.total !== "number") throw new Error("invalid count");
            setFilterBulkConfirm((prev) =>
              prev && prev.resolve === resolve ? { ...prev, count: body.total ?? 0 } : prev,
            );
          })
          .catch(() => {
            // Fall back to the cached banner count so the recruiter still gets a number to
            // confirm against rather than being blocked by a transient network blip.
            setFilterBulkConfirm((prev) =>
              prev && prev.resolve === resolve
                ? { ...prev, count: totalMatchingResults ?? meta.totalRows, countError: true }
                : prev,
            );
      });
      setFilterBulkConfirm(null);
      if (!confirmed) return;
      await runFilterBulkUpdate(action, actionLabel, count);
      return;
    }

    // Per-id mode: process the selected id set in chunks so the user sees real-time
    // progress ("Updated X / N") rather than a long, opaque "Updating…" pause when
    // bulk actions are applied to hundreds or thousands of applications.
    const BATCH_SIZE = 25;
    const total = ids.length;
    setBulkProgress({ done: 0, total });
    let updatedTotal = 0;
    const skippedAll: { id: number; reason: "not_found" | "access_denied" }[] = [];
    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const token = getToken();
        const res = await fetch("/api/applications/bulk-status", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ ids: chunk, status: action }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null) as { error?: string } | null;
          toast({
            title: "Bulk update failed",
            description: errBody?.error ?? `Updated ${updatedTotal} of ${total} before failing`,
            variant: "destructive",
          });
          return;
        }
        const { updated, skipped = [] } = (await res.json()) as {
          updated: number;
          skipped?: { id: number; reason: "not_found" | "access_denied" }[];
        };
        updatedTotal += updated;
        skippedAll.push(...skipped);
        setBulkProgress({ done: Math.min(i + chunk.length, total), total });
      }
      await queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
      const skippedDescription = describeSkipped(skippedAll);
      toast({
        title: `${updatedTotal} application${updatedTotal !== 1 ? "s" : ""} updated to "${actionLabel}"${skippedAll.length > 0 ? ` — ${skippedAll.length} skipped` : ""}`,
        description: skippedDescription,
        variant: skippedAll.length > 0 ? "destructive" : undefined,
      });
    } finally {
      setBulkProgress(null);
    }
  }, [queryClient, toast, countParams, totalMatchingResults, runFilterBulkUpdate]);

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
          bulkProgress={bulkProgress}
          exportFilename="applications"
          totalMatchingResults={totalMatchingResults}
          filterToken={countParams}
          tableId="applications"
          data-testid="table-applications"
          emptyState="No applications found"
        />
      </div>

      <AlertDialog
        open={filterBulkConfirm != null}
        onOpenChange={(open) => {
          if (!open) filterBulkConfirm?.resolve({ confirmed: false, count: 0 });
        }}
      >
        <AlertDialogContent data-testid="dialog-bulk-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply "{filterBulkConfirm?.label}" to all matching applications?</AlertDialogTitle>
            <AlertDialogDescription>
              {filterBulkConfirm?.count == null ? (
                <span data-testid="text-bulk-confirm-loading">Checking how many applications match the current filters…</span>
              ) : (
                <>
                  <span data-testid="text-bulk-confirm-count">
                    You're about to update {filterBulkConfirm.count} application
                    {filterBulkConfirm.count === 1 ? "" : "s"} that match the current filters.
                  </span>
                  {filterBulkConfirm.countError && (
                    <span className="block text-xs text-muted-foreground mt-1">
                      (Could not refresh the live count — showing the last known total.)
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => filterBulkConfirm?.resolve({ confirmed: false, count: 0 })}
              data-testid="button-bulk-confirm-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={filterBulkConfirm?.count == null}
              onClick={(e) => {
                e.preventDefault();
                if (filterBulkConfirm?.count != null) {
                  filterBulkConfirm.resolve({ confirmed: true, count: filterBulkConfirm.count });
                }
              }}
              data-testid="button-bulk-confirm-apply"
            >
              {filterBulkConfirm?.count == null
                ? "Loading…"
                : `Update ${filterBulkConfirm.count} application${filterBulkConfirm.count === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
