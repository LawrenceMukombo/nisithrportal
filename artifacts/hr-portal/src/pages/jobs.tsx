import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, Pencil, Trash2, CheckCircle, XCircle, MapPin, Briefcase, Download, Printer, ChevronsUpDown, ChevronUp, ChevronDown as ChevronDn, AlertTriangle, Check, Bookmark, BookmarkCheck, Share2 } from "lucide-react";
import { useGetJobs, useDeleteJob, usePublishJob, useCloseJob, useGetDepartments, getGetJobsQueryKey } from "@workspace/api-client-react";
import type { Job } from "@workspace/api-client-react";
import { DRAFT_KEY_PREFIX, isDraftExpired, draftRelativeTime } from "@/lib/draftKeys";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useRole } from "@/contexts/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/use-auth";
import { useSavedJobIds, useSaveJob, useUnsaveJob } from "@/hooks/use-saved-jobs";
import { shareJob } from "@/lib/share";
import { DataTable } from "@/components/ui/data-table";
import type { DataTableColumn } from "@/components/ui/data-table";

type SortKey = "title" | "dept" | "status" | null;
type SortDir = "asc" | "desc" | null;

function downloadJobsCSV(jobs: Job[], deptMap: Record<number, string>) {
  const header = ["ID", "Title", "Department", "Status", "Closing Date"];
  const rows = jobs.map(j => [
    j.id,
    j.title,
    j.departmentId ? (deptMap[j.departmentId] ?? `Dept #${j.departmentId}`) : "",
    j.status ?? "",
    j.closingDate ? new Date(j.closingDate).toLocaleDateString() : "",
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "jobs.csv"; a.click();
}

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  open: "default",
  published: "default",
  closed: "outline",
};

const WORK_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  casual: "Casual",
};

const WORK_TYPE_BADGE_CLASSES: Record<string, string> = {
  full_time: "bg-blue-50 text-blue-700 border-blue-200",
  part_time: "bg-violet-50 text-violet-700 border-violet-200",
  contract: "bg-amber-50 text-amber-700 border-amber-200",
  casual: "bg-orange-50 text-orange-700 border-orange-200",
};

const PNG_PROVINCES_JOBS = [
  "National Capital District", "Central", "Gulf", "Western", "Oro (Northern)",
  "Milne Bay", "Morobe", "Madang", "Eastern Highlands", "Western Highlands",
  "Jiwaka", "Chimbu (Simbu)", "Southern Highlands", "Hela", "Enga",
  "Sandaun (West Sepik)", "East Sepik", "Manus", "New Ireland",
  "East New Britain", "West New Britain", "Bougainville (AROB)",
];

const SALARY_BANDS_JOBS = [
  { value: "lt_20k", label: "< K20,000", max: 20000 },
  { value: "20k_40k", label: "K20,000 – K40,000", min: 20000, max: 40000 },
  { value: "40k_70k", label: "K40,000 – K70,000", min: 40000, max: 70000 },
  { value: "70k_100k", label: "K70,000 – K100,000", min: 70000, max: 100000 },
  { value: "gt_100k", label: "K100,000+", min: 100000 },
];


type ExtJob = Job & {
  employmentType?: string;
  workType?: string;
  province?: string;
  location?: string;
  workArrangement?: string;
  salaryMin?: number;
  salaryMax?: number;
};

function JobSaveShareCell({ job, savedJobIds, isAuthenticated, canBookmark }: {
  job: ExtJob;
  savedJobIds?: number[];
  isAuthenticated: boolean;
  canBookmark: boolean;
}) {
  const [, setLocationHref] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();

  const isSaved = savedJobIds?.includes(job.id) ?? false;

  const handleSaveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated) {
      setLocationHref(`/login?returnTo=/jobs/${job.id}`);
      return;
    }
    if (isSaved) {
      unsaveJob.mutate(job.id, {
        onSuccess: () => toast({ title: "Job removed from saved" }),
        onError: () => toast({ title: "Failed to unsave job", variant: "destructive" }),
      });
    } else {
      saveJob.mutate(job.id, {
        onSuccess: () => toast({ title: "Job saved!" }),
        onError: () => toast({ title: "Failed to save job", variant: "destructive" }),
      });
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}/jobs/${job.id}`;
    const result = await shareJob({
      url,
      title: job.title,
      text: `Check out this job: ${job.title}`,
    });
    if (result === "copied") {
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    } else if (result === "error") {
      toast({ title: "Could not share link", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-primary"
        onClick={handleShare}
        title="Share job"
        data-testid={`button-share-job-${job.id}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Share2 className="h-3.5 w-3.5" />}
      </Button>
      {canBookmark && (
        <Button
          size="icon"
          variant="ghost"
          className={`h-7 w-7 ${isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          onClick={handleSaveToggle}
          title={isSaved ? "Remove from saved" : "Save job"}
          data-testid={`button-save-job-${job.id}`}
          disabled={saveJob.isPending || unsaveJob.isPending}
        >
          {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}

function JobActionsCell({ job }: { job: ExtJob }) {
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
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string; missingFields?: string[] } | null };
        const data = e?.data ?? null;
        const missing = Array.isArray(data?.missingFields) ? data!.missingFields : undefined;
        const fieldLabels: Record<string, string> = {
          employmentType: "Employment Type",
          province: "Province",
        };
        const description = missing && missing.length > 0
          ? `Please fill in the following before publishing: ${missing.map((f) => fieldLabels[f] ?? f).join(", ")}.`
          : (data?.error ?? "Could not publish job.");
        toast({
          title: "Cannot publish job",
          description,
          variant: "destructive",
        });
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
      {(job.status === "published" || job.status === "open") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-orange-600"
          onClick={() => closeMutation.mutate({ id: job.id })}
          disabled={closeMutation.isPending}
          data-testid={`button-close-job-${job.id}`}
          title="Close job"
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
  );
}

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [workTypeFilter, setWorkTypeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [salaryFilter, setSalaryFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const { canManageJobs, isApplicant } = useRole();
  const { agencyId, isAuthenticated } = useAuth();
  const canBookmark = !isAuthenticated || isApplicant;
  const { data: savedJobIds } = useSavedJobIds(isApplicant);

  function handleSort(key: SortKey) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir(null); }
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40 inline-block" />;
    if (sortDir === "asc") return <ChevronUp className="h-3 w-3 ml-1 text-primary inline-block" />;
    return <ChevronDn className="h-3 w-3 ml-1 text-primary inline-block" />;
  }

  const { data: rawDepartments = [] } = useGetDepartments(
    { agency_id: agencyId ?? undefined },
    {}
  );
  const departments = Array.isArray(rawDepartments) ? rawDepartments : [];

  const deptMap = useMemo(() => {
    const m: Record<number, string> = {};
    departments.forEach(d => { m[d.id] = d.name; });
    return m;
  }, [departments]);

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

  const filtered = (jobs.data as ExtJob[] | undefined)?.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase());
    const jobWorkType = j.employmentType ?? j.workType ?? "";
    const matchWorkType = workTypeFilter === "all" || jobWorkType === workTypeFilter;
    const jobLocation = j.province || j.location || "";
    const matchLocation = locationFilter === "all" ||
      jobLocation.toLowerCase().includes(locationFilter.toLowerCase());
    let matchSalary = true;
    if (salaryFilter !== "all") {
      const band = SALARY_BANDS_JOBS.find(b => b.value === salaryFilter);
      if (band && (j.salaryMin !== undefined || j.salaryMax !== undefined)) {
        const mid = j.salaryMin ?? j.salaryMax ?? 0;
        matchSalary = (band.min === undefined || mid >= band.min) &&
                      (band.max === undefined || mid <= band.max);
      }
    }
    return matchSearch && matchWorkType && matchLocation && matchSalary;
  }) ?? [];

  const hasFilters = search || deptFilter !== "all" || workTypeFilter !== "all" || locationFilter !== "all" || statusFilter !== "all" || salaryFilter !== "all";
  const clearFilters = () => { setSearch(""); setDeptFilter("all"); setWorkTypeFilter("all"); setLocationFilter("all"); setStatusFilter("all"); setSalaryFilter("all"); };

  const sortedFiltered = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "title") { av = a.title.toLowerCase(); bv = b.title.toLowerCase(); }
      else if (sortKey === "dept") { av = a.departmentId ? (deptMap[a.departmentId] ?? "").toLowerCase() : ""; bv = b.departmentId ? (deptMap[b.departmentId] ?? "").toLowerCase() : ""; }
      else if (sortKey === "status") { av = a.status ?? ""; bv = b.status ?? ""; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, deptMap]);

  const { toast } = useToast();
  const [draftRefreshTick, setDraftRefreshTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDraftRefreshTick((t) => t + 1);
    }, 60_000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith(DRAFT_KEY_PREFIX)) {
        setDraftRefreshTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    const onDraftCleared = () => setDraftRefreshTick((t) => t + 1);
    window.addEventListener("draft_cleared", onDraftCleared);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("draft_cleared", onDraftCleared);
    };
  }, []);

  const draftMap = useMemo(() => {
    const map: Record<number, string> = {};
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      for (const key of keys) {
        if (!key.startsWith(DRAFT_KEY_PREFIX)) continue;
        const jobIdStr = key.slice(DRAFT_KEY_PREFIX.length);
        const jobId = parseInt(jobIdStr, 10);
        if (isNaN(jobId)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { savedAt?: string };
        if (!parsed.savedAt) continue;
        if (isDraftExpired(parsed.savedAt)) {
          localStorage.removeItem(key);
          continue;
        }
        map[jobId] = parsed.savedAt;
      }
    } catch { /* ignore */ }
    return map;
  }, [jobs.data, draftRefreshTick]);

  const columns: DataTableColumn<ExtJob>[] = [
    {
      key: "title",
      label: "Job Title",
      sortable: true,
      sortValue: (j) => j.title,
      exportValue: (j) => j.title,
      render: (job) => {
        const empType = job.employmentType ?? job.workType;
        const province = job.province || job.location;
        const draftSavedAt = draftMap[job.id];
        return (
          <div>
            <Link href={`/jobs/${job.id}`}>
              <span className="font-medium text-primary hover:underline cursor-pointer" data-testid={`link-job-${job.id}`}>
                {job.title}
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {empType && (() => {
                const label = WORK_TYPE_LABELS[empType] ?? empType;
                const cls = WORK_TYPE_BADGE_CLASSES[empType] ?? "bg-gray-50 text-gray-700 border-gray-200";
                const isActive = workTypeFilter === empType;
                const activeCls = "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30";
                return (
                  <Badge
                    variant="outline"
                    className={`text-xs py-0 gap-1 ${isActive ? activeCls : cls} cursor-pointer hover:opacity-70 transition-opacity`}
                    data-testid={`badge-work-type-${job.id}`}
                    aria-pressed={isActive}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isActive) {
                        setWorkTypeFilter("all");
                        toast({ title: `Cleared ${label} filter`, duration: 2000 });
                      } else {
                        setWorkTypeFilter(empType);
                        toast({ title: `Filtered by ${label}`, duration: 2000 });
                      }
                    }}
                    title={isActive ? `Clear ${label} filter` : `Filter by ${label}`}
                  >
                    {isActive ? <Check className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}{label}
                  </Badge>
                );
              })()}
              {province && (() => {
                const isActive = locationFilter === province;
                const baseCls = "bg-teal-50 text-teal-700 border-teal-200";
                const activeCls = "bg-teal-600 text-white border-teal-600 ring-2 ring-teal-300";
                return (
                  <Badge
                    variant="outline"
                    className={`text-xs py-0 gap-1 ${isActive ? activeCls : baseCls} cursor-pointer hover:opacity-70 transition-opacity`}
                    data-testid={`badge-province-${job.id}`}
                    aria-pressed={isActive}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isActive) {
                        setLocationFilter("all");
                        toast({ title: `Cleared ${province} filter`, duration: 2000 });
                      } else {
                        setLocationFilter(province);
                        toast({ title: `Filtered by ${province}`, duration: 2000 });
                      }
                    }}
                    title={isActive ? `Clear ${province} filter` : `Filter by ${province}`}
                  >
                    {isActive ? <Check className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{province}
                  </Badge>
                );
              })()}
              {job.workArrangement && (
                <Badge variant="outline" className="text-xs py-0 bg-slate-50 text-slate-600 border-slate-200">
                  {({ remote: "Remote", hybrid: "Hybrid", on_site: "On-Site", flexible: "Flexible" } as Record<string, string>)[job.workArrangement] ?? job.workArrangement}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Closes: {job.closingDate ? new Date(job.closingDate).toLocaleDateString() : "—"}
              </span>
              {draftSavedAt && (
                <Badge variant="outline" className="text-xs py-0 gap-1 bg-amber-50 text-amber-700 border-amber-200 font-normal" data-testid={`badge-draft-age-${job.id}`}>
                  In progress · {draftRelativeTime(draftSavedAt)}
                </Badge>
              )}
              {(!empType || !province) && (
                <Badge
                  variant="outline"
                  className="text-xs py-0 gap-1 bg-orange-50 text-orange-700 border-orange-200"
                  data-testid={`badge-incomplete-${job.id}`}
                  title={[!empType && "Employment type missing", !province && "Province missing"].filter(Boolean).join(", ")}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {!empType && !province ? "Type & location missing" : !empType ? "Type missing" : "Location missing"}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      sortValue: (j) => j.departmentId ? (deptMap[j.departmentId] ?? "") : "",
      exportValue: (j) => j.departmentId ? (deptMap[j.departmentId] ?? `Dept #${j.departmentId}`) : "—",
      render: (j) => (
        <span className="text-sm text-muted-foreground">
          {j.departmentId ? (deptMap[j.departmentId] ?? `Dept #${j.departmentId}`) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: (j) => j.status ?? "",
      exportValue: (j) => j.status ?? "—",
      render: (j) => (
        <Badge variant={STATUS_COLORS[j.status ?? "draft"] as "default" | "secondary" | "outline" | "destructive"}>
          {j.status}
        </Badge>
      ),
    },
    {
      key: "save-share",
      label: "",
      render: (job: ExtJob) => (
        <JobSaveShareCell
          job={job}
          savedJobIds={savedJobIds}
          isAuthenticated={isAuthenticated}
          canBookmark={canBookmark}
        />
      ),
    } satisfies DataTableColumn<ExtJob>,
    ...(canManageJobs ? [{
      key: "actions",
      label: "Actions",
      render: (job: ExtJob) => <JobActionsCell job={job} />,
    } satisfies DataTableColumn<ExtJob>] : []),
  ];

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
                <SearchableSelect
                  value={deptFilter}
                  onValueChange={setDeptFilter}
                  options={[
                    { value: "all", label: "All departments" },
                    ...departments.map((d) => ({ value: d.id.toString(), label: d.name })),
                  ]}
                  placeholder="Department"
                  searchPlaceholder="Search departments…"
                  triggerClassName="w-44"
                  data-testid="select-dept-filter"
                />
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
              <SearchableSelect
                value={locationFilter}
                onValueChange={setLocationFilter}
                options={[
                  { value: "all", label: "All Locations" },
                  ...PNG_PROVINCES_JOBS.map((p) => ({ value: p, label: p })),
                ]}
                placeholder="Location"
                searchPlaceholder="Search provinces…"
                triggerClassName="w-48"
                data-testid="select-location-filter"
              />
              <SearchableSelect
                value={salaryFilter}
                onValueChange={setSalaryFilter}
                options={[
                  { value: "all", label: "All Salary Ranges" },
                  ...SALARY_BANDS_JOBS.map((b) => ({ value: b.value, label: b.label })),
                ]}
                placeholder="Salary Range"
                searchPlaceholder="Search salary bands…"
                triggerClassName="w-48"
                data-testid="select-salary-filter"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
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

        <DataTable
          columns={columns}
          rows={sortedFiltered}
          getRowId={(j) => j.id}
          isLoading={jobs.isLoading}
          exportFilename="jobs"
          tableId="jobs"
          data-testid="table-jobs"
          emptyState={
            hasFilters ? (
              <div>
                <p>No jobs found matching your filters.</p>
                <button className="text-sm text-primary underline mt-2 cursor-pointer" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : "No jobs found"
          }
        />
      </div>
    </AppLayout>
  );
}
