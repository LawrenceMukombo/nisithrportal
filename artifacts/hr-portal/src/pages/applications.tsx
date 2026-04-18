import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Search } from "lucide-react";
import { useGetApplications, useUpdateApplicationStatus, getGetApplicationsQueryKey } from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/layouts/app-layout";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = ["applied", "screening", "interview", "offer", "hired", "onboarding", "rejected", "withdrawn"];

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
      value={app.status ?? "submitted"}
      onValueChange={(v) => mutation.mutate({ id: app.id, data: { status: v } })}
    >
      <SelectTrigger className="w-32 h-7 text-xs" data-testid={`select-status-${app.id}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ApplicationsPage() {
  const searchString = useSearch();
  const urlStatus = new URLSearchParams(searchString).get("status");
  const initialStatus = urlStatus && STATUS_OPTIONS.includes(urlStatus) ? urlStatus : "all";
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (urlStatus && STATUS_OPTIONS.includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
  }, [urlStatus]);

  const applications = useGetApplications(
    { status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getGetApplicationsQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const filtered = applications.data?.filter((a) =>
    search ? String(a.jobId).includes(search) || String(a.candidateId).includes(search) : true
  ) ?? [];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-applications">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">{applications.data?.length ?? 0} applications</p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by job or candidate ID..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-applications"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">No applications found</td>
                    </tr>
                  ) : (
                    filtered.map((app) => (
                      <tr key={app.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-application-${app.id}`}>
                        <td className="py-3 px-4">
                          <Link href={`/applications/${app.id}`}>
                            <span className="text-primary hover:underline cursor-pointer font-medium">#{app.id}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <Link href={`/jobs/${app.jobId}`}>
                            <span className="hover:underline cursor-pointer">Job #{app.jobId}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <Link href={`/candidates/${app.candidateId}`}>
                            <span className="hover:underline cursor-pointer">Candidate #{app.candidateId}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <StatusSelect app={app} />
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
