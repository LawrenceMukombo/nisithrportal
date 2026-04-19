import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Search, ChevronDown, CheckSquare } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const BULK_ACTIONS: { label: string; status: string }[] = [
  { label: "Move to Review", status: "screening" },
  { label: "Shortlist", status: "interview" },
  { label: "Reject", status: "rejected" },
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (urlStatus && STATUS_OPTIONS.includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
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
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  const filtered = applications.data?.filter((a) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const candidateName = candidateMap.get(a.candidateId)?.name?.toLowerCase() ?? "";
    const jobTitle = jobMap.get(a.jobId)?.title?.toLowerCase() ?? "";
    return (
      candidateName.includes(q) ||
      jobTitle.includes(q) ||
      String(a.id).includes(q) ||
      String(a.jobId).includes(q) ||
      String(a.candidateId).includes(q)
    );
  }) ?? [];

  const filteredIds = filtered.map((a) => a.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someSelected = filteredIds.some((id) => selectedIds.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkAction(status: string) {
    const ids = Array.from(selectedIds).filter((id) => filteredIds.includes(id));
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/applications/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, status }),
      });
      if (!res.ok) throw new Error("Bulk update failed");
      const { updated } = await res.json() as { updated: number };
      await queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
      setSelectedIds(new Set());
      const actionLabel = BULK_ACTIONS.find((a) => a.status === status)?.label ?? status;
      toast({ title: `${updated} application${updated !== 1 ? "s" : ""} updated to "${actionLabel}"` });
    } catch {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  }

  const selectedCount = Array.from(selectedIds).filter((id) => filteredIds.includes(id)).length;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-applications">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">{applications.data?.length ?? 0} applications</p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by candidate name, job title, or ID..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-applications"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelectedIds(new Set()); }}>
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

        {selectedCount > 0 && (
          <div className="flex items-center gap-3 p-3 bg-muted/60 rounded-lg border border-border" data-testid="bulk-action-bar">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedCount} selected
            </span>
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkLoading}
                  data-testid="button-bulk-action"
                  className="gap-1"
                >
                  {bulkLoading ? "Updating…" : "Bulk Action"} <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {BULK_ACTIONS.map((action) => (
                  <DropdownMenuItem
                    key={action.status}
                    onSelect={() => handleBulkAction(action.status)}
                    data-testid={`bulk-action-${action.status}`}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground text-xs"
            >
              Clear
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {applications.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="table-applications">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 px-4 w-10">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium">ID</th>
                    <th className="text-left py-3 px-4 font-medium">Job</th>
                    <th className="text-left py-3 px-4 font-medium">Candidate</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">No applications found</td>
                    </tr>
                  ) : (
                    filtered.map((app) => (
                      <tr
                        key={app.id}
                        className={`border-b border-border last:border-0 transition-colors ${selectedIds.has(app.id) ? "bg-primary/5" : "hover:bg-muted/30"}`}
                        data-testid={`row-application-${app.id}`}
                      >
                        <td className="py-3 px-4">
                          <Checkbox
                            checked={selectedIds.has(app.id)}
                            onCheckedChange={() => toggleRow(app.id)}
                            aria-label={`Select application #${app.id}`}
                            data-testid={`checkbox-app-${app.id}`}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/applications/${app.id}`}>
                            <span className="text-primary hover:underline cursor-pointer font-medium">#{app.id}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <Link href={`/jobs/${app.jobId}`}>
                            <span className="hover:underline cursor-pointer">
                              {jobMap.get(app.jobId)?.title ?? `Job #${app.jobId}`}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <Link href={`/candidates/${app.candidateId}`}>
                            <span className="hover:underline cursor-pointer">
                              {candidateMap.get(app.candidateId)?.name ?? `Candidate #${app.candidateId}`}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${STATUS_BADGE_CLASSES[app.status ?? "applied"] ?? ""}`}
                              data-testid={`badge-status-${app.id}`}
                            >
                              {STATUS_LABELS[app.status ?? "applied"] ?? app.status}
                            </Badge>
                            <StatusSelect app={app} />
                          </div>
                        </td>
                      </tr>
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
