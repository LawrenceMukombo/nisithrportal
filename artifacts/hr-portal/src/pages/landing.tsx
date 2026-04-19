import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Briefcase, ChevronRight, Calendar, Building2, MapPin, Clock, ArrowRight, Bookmark, BookmarkCheck, Share2, Check } from "lucide-react";
import { useGetJobs, useGetDepartments, getGetJobsQueryKey, getGetDepartmentsQueryKey } from "@workspace/api-client-react";
import type { Job } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth, useRole } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useSavedJobIds, useSaveJob, useUnsaveJob } from "@/hooks/use-saved-jobs";
import { shareJob } from "@/lib/share";

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

const DEPT_ACCENT_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-orange-500",
];

const PNG_PROVINCES = [
  "National Capital District",
  "Central",
  "Gulf",
  "Western",
  "Oro (Northern)",
  "Milne Bay",
  "Morobe",
  "Madang",
  "Eastern Highlands",
  "Western Highlands",
  "Jiwaka",
  "Chimbu (Simbu)",
  "Southern Highlands",
  "Hela",
  "Enga",
  "Sandaun (West Sepik)",
  "East Sepik",
  "Manus",
  "New Ireland",
  "East New Britain",
  "West New Britain",
  "Bougainville (AROB)",
];

function JobCard({ job, deptName, deptAccent, onLocationClick, onWorkTypeClick, activeLocation, activeWorkType, savedJobIds, isAuthenticated, canBookmark }: {
  job: Job;
  deptName?: string;
  deptAccent: string;
  onLocationClick?: (province: string) => void;
  onWorkTypeClick?: (workType: string) => void;
  activeLocation?: string;
  activeWorkType?: string;
  savedJobIds?: number[];
  isAuthenticated: boolean;
  canBookmark: boolean;
}) {
  const [, setLocationHref] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();

  const daysLeft = job.closingDate
    ? Math.ceil((new Date(job.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const urgency = daysLeft !== null && daysLeft <= 7 ? "text-red-600" : "text-muted-foreground";
  const closingLabel = daysLeft !== null
    ? daysLeft < 0 ? "Closed" : daysLeft === 0 ? "Closes today" : `${daysLeft}d left`
    : null;

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
    <div className="relative group" data-testid={`card-job-${job.id}`}>
      <Link href={`/jobs/${job.id}`} className="absolute inset-0 z-0" aria-label={`View ${job.title}`} />
      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden border border-border pointer-events-none">
        <div className={`h-1 w-full ${deptAccent}`} />
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className={`${deptAccent} rounded-lg p-2 shrink-0 mt-0.5`}>
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors" data-testid={`link-job-title-${job.id}`}>
                {job.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {deptName && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {deptName}
                  </span>
                )}
                {(() => {
                  const province = (job as Job & { province?: string; location?: string }).province
                    || (job as Job & { location?: string }).location;
                  if (!province) return null;
                  const isActive = !!onLocationClick && activeLocation === province;
                  const baseCls = "bg-teal-50 text-teal-700 border-teal-200";
                  const activeCls = "bg-teal-600 text-white border-teal-600 ring-2 ring-teal-300";
                  return (
                    <Badge
                      variant="outline"
                      className={`text-xs py-0 gap-1 pointer-events-auto ${isActive ? activeCls : baseCls} ${onLocationClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                      data-testid={`badge-province-${job.id}`}
                      aria-pressed={onLocationClick ? isActive : undefined}
                      onClick={onLocationClick ? (e) => { e.stopPropagation(); e.preventDefault(); onLocationClick(province); } : undefined}
                      title={onLocationClick ? (isActive ? `Clear ${province} filter` : `Filter by ${province}`) : undefined}
                    >
                      {isActive ? <Check className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{province}
                    </Badge>
                  );
                })()}
                {job.closingDate && closingLabel && (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${urgency}`}>
                    <Clock className="h-3 w-3" /> {closingLabel}
                  </span>
                )}
              </div>
              {job.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{job.description}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1.5 flex-wrap">
                  {(() => {
                    const empType = (job as Job & { employmentType?: string; workType?: string }).employmentType ??
                      (job as Job & { workType?: string }).workType;
                    const label = empType ? (WORK_TYPE_LABELS[empType] ?? empType) : "Public Service";
                    const cls = empType
                      ? (WORK_TYPE_BADGE_CLASSES[empType] ?? "bg-gray-50 text-gray-700 border-gray-200")
                      : "bg-blue-50 text-blue-700 border-blue-200";
                    const clickable = !!(onWorkTypeClick && empType);
                    const isActive = clickable && activeWorkType === empType;
                    const activeCls = "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30";
                    return (
                      <Badge
                        variant="outline"
                        className={`text-xs py-0 gap-1 pointer-events-auto ${isActive ? activeCls : cls} ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                        data-testid={`badge-work-type-${job.id}`}
                        aria-pressed={clickable ? isActive : undefined}
                        onClick={clickable ? (e) => { e.stopPropagation(); e.preventDefault(); onWorkTypeClick!(empType!); } : undefined}
                        title={clickable ? (isActive ? `Clear ${label} filter` : `Filter by ${label}`) : undefined}
                      >
                        {isActive ? <Check className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}{label}
                      </Badge>
                    );
                  })()}
                  {(() => {
                    const arr = (job as Job & { workArrangement?: string }).workArrangement;
                    if (!arr) return null;
                    const label = { remote: "Remote", hybrid: "Hybrid", on_site: "On-Site", flexible: "Flexible" }[arr] ?? arr;
                    return <Badge variant="outline" className="text-xs py-0">{label}</Badge>;
                  })()}
                  {(() => {
                    const j = job as Job & { salaryMin?: number; salaryMax?: number; salaryCurrency?: string; salaryVisibility?: string };
                    if (j.salaryVisibility === "public" && (j.salaryMin || j.salaryMax)) {
                      return (
                        <Badge variant="outline" className="text-xs py-0 text-emerald-700 border-emerald-300 bg-emerald-50">
                          {j.salaryCurrency ?? "PGK"} {(j.salaryMin ?? 0).toLocaleString()}{j.salaryMax ? `–${j.salaryMax.toLocaleString()}` : "+"}
                        </Badge>
                      );
                    }
                    if (j.salaryVisibility === "internal") {
                      return <Badge variant="outline" className="text-xs py-0">Salary on request</Badge>;
                    }
                    return null;
                  })()}
                  {job.closingDate && daysLeft !== null && daysLeft <= 14 && daysLeft >= 0 && (
                    <Badge variant="outline" className="text-xs py-0 text-amber-700 border-amber-300 bg-amber-50">Closing soon</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 pointer-events-auto">
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
                  <Button size="sm" className="h-7 text-xs gap-1 group-hover:gap-2 transition-all" data-testid={`button-view-job-${job.id}`} asChild>
                    <Link href={`/jobs/${job.id}`}>
                      View & Apply <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NisitLogo({ size = "default", asLink = false }: { size?: "default" | "large"; asLink?: boolean }) {
  const imgSize = size === "large" ? "w-12 h-12" : "w-8 h-8";
  const inner = (
    <div className="flex items-center gap-2.5">
      <img
        src="/nisit-logo.png"
        alt="PNG NISIT Logo"
        className={`${imgSize} object-contain rounded-md shrink-0`}
      />
      <div>
        <p className={`font-bold leading-none ${size === "large" ? "text-base" : "text-sm"}`}>PNG NISIT</p>
        <p className="text-muted-foreground text-xs leading-none mt-0.5">HR Portal</p>
      </div>
    </div>
  );
  if (asLink) {
    return <Link href="/" className="hover:opacity-80 transition-opacity">{inner}</Link>;
  }
  return inner;
}

const SALARY_BANDS = [
  { value: "lt_20k", label: "< K20,000", max: 20000 },
  { value: "20k_40k", label: "K20,000 – K40,000", min: 20000, max: 40000 },
  { value: "40k_70k", label: "K40,000 – K70,000", min: 40000, max: 70000 },
  { value: "70k_100k", label: "K70,000 – K100,000", min: 70000, max: 100000 },
  { value: "gt_100k", label: "K100,000+", min: 100000 },
];

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [salaryFilter, setSalaryFilter] = useState("all");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { isApplicant } = useRole();
  const canBookmark = !isAuthenticated || isApplicant;
  const { data: savedJobIds } = useSavedJobIds(isApplicant);

  const jobs = useGetJobs(
    { status: "published" },
    { query: { queryKey: getGetJobsQueryKey({ status: "published" }) } }
  );

  const depts = useGetDepartments(undefined, { query: { enabled: true, queryKey: getGetDepartmentsQueryKey() } });
  const deptMap = useMemo(() => {
    const m: Record<number, string> = {};
    (depts.data ?? []).forEach(d => { m[d.id] = d.name; });
    return m;
  }, [depts.data]);

  const deptAccentMap = useMemo(() => {
    const m: Record<number, string> = {};
    (depts.data ?? []).forEach((d, i) => { m[d.id] = DEPT_ACCENT_COLORS[i % DEPT_ACCENT_COLORS.length]; });
    return m;
  }, [depts.data]);

  const filtered = useMemo(() => {
    return (jobs.data ?? []).filter(j => {
      const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) ||
        (j.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchDept = deptFilter === "all" || j.departmentId === parseInt(deptFilter);
      const jobWorkType = (j as Job & { employmentType?: string; workType?: string }).employmentType ?? (j as Job & { workType?: string }).workType ?? "";
      const matchWorkType = workTypeFilter === "all" || jobWorkType === workTypeFilter;
      const jobLocation = (j as Job & { province?: string; location?: string }).province ?? (j as Job & { location?: string }).location ?? "";
      const matchLocation = locationFilter === "all" ||
        jobLocation.toLowerCase().includes(locationFilter.toLowerCase());
      let matchSalary = true;
      if (salaryFilter !== "all") {
        const band = SALARY_BANDS.find(b => b.value === salaryFilter);
        const jobSalaryMin = (j as Job & { salaryMin?: number }).salaryMin;
        const jobSalaryMax = (j as Job & { salaryMax?: number }).salaryMax;
        if (band && (jobSalaryMin !== undefined || jobSalaryMax !== undefined)) {
          const mid = jobSalaryMin ?? jobSalaryMax ?? 0;
          matchSalary = (band.min === undefined || mid >= band.min) &&
                        (band.max === undefined || mid <= band.max);
        }
      }
      return matchSearch && matchDept && matchWorkType && matchLocation && matchSalary;
    });
  }, [jobs.data, search, deptFilter, workTypeFilter, locationFilter, salaryFilter]);

  const hasFilters = search || deptFilter !== "all" || workTypeFilter !== "all" || locationFilter !== "all" || salaryFilter !== "all";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <NisitLogo asLink />
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button onClick={() => setLocation("/dashboard")} data-testid="button-go-to-dashboard">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="link-login">Sign in</Button>
                </Link>
                <Link href="/applicant-register">
                  <Button size="sm" data-testid="link-register">Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <section className="relative overflow-hidden py-20 px-6" style={{
        background: "linear-gradient(135deg, #0a0a0a 50%, #CE1126 50%)"
      }}>
        <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ backgroundColor: "#FCD116" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-6">
            <img
              src="/nisit-logo.png"
              alt="PNG NISIT Logo"
              className="w-20 h-20 object-contain rounded-xl shadow-lg border-2 border-white/20"
            />
          </div>
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
            style={{ backgroundColor: "#FCD116", color: "#0a0a0a" }}>
            Papua New Guinea Public Service
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-sm">NISIT Job Portal</h1>
          <p className="text-white/75 text-lg mb-8 max-w-2xl mx-auto">
            Explore current vacancies at NISIT. Build your public service career today.
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-12 h-12 text-base bg-white border-0 shadow-lg"
              placeholder="Search job titles or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-jobs"
            />
          </div>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <MapPin className="h-4 w-4" /> Filter:
          </div>
          <SearchableSelect
            value={deptFilter}
            onValueChange={setDeptFilter}
            options={[
              { value: "all", label: "All Departments" },
              ...(depts.data ?? []).map(d => ({ value: String(d.id), label: d.name })),
            ]}
            placeholder="All Departments"
            searchPlaceholder="Search departments…"
            triggerClassName="h-9 w-44 text-sm"
            data-testid="select-filter-dept"
          />
          <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
            <SelectTrigger className="h-9 w-44 text-sm" data-testid="select-filter-worktype">
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
              ...PNG_PROVINCES.map(p => ({ value: p, label: p })),
            ]}
            placeholder="All Locations"
            searchPlaceholder="Search provinces…"
            triggerClassName="h-9 w-48 text-sm"
            data-testid="select-filter-location"
          />
          <SearchableSelect
            value={salaryFilter}
            onValueChange={setSalaryFilter}
            options={[
              { value: "all", label: "All Salary Ranges" },
              ...SALARY_BANDS.map(b => ({ value: b.value, label: b.label })),
            ]}
            placeholder="Salary Range"
            searchPlaceholder="Search salary bands…"
            triggerClassName="h-9 w-48 text-sm"
            data-testid="select-filter-salary"
          />
          {hasFilters && (
            <Button size="sm" variant="ghost" className="h-9 text-sm" onClick={() => { setSearch(""); setDeptFilter("all"); setWorkTypeFilter("all"); setLocationFilter("all"); setSalaryFilter("all"); }}>
              Clear filters
            </Button>
          )}
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" data-testid="heading-open-vacancies">Open Vacancies</h2>
            <p className="text-sm text-muted-foreground">
              {jobs.isLoading ? "Loading..." : `${filtered.length} position${filtered.length !== 1 ? "s" : ""} available`}
            </p>
          </div>
          <Link href="/jobs">
            <Button variant="outline" size="sm" data-testid="link-all-jobs">
              View all <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {jobs.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><div className="h-1 bg-muted" /><CardContent className="p-5"><Skeleton className="h-28 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">No vacancies match your filters</p>
            <p className="text-sm mt-1">Try adjusting your search or clearing the filters</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(""); setDeptFilter("all"); setWorkTypeFilter("all"); setLocationFilter("all"); setSalaryFilter("all"); }}>
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                deptName={job.departmentId ? deptMap[job.departmentId] : undefined}
                deptAccent={job.departmentId ? (deptAccentMap[job.departmentId] ?? DEPT_ACCENT_COLORS[0]) : DEPT_ACCENT_COLORS[0]}
                onLocationClick={(p) => {
                  if (locationFilter === p) {
                    setLocationFilter("all");
                    toast({ title: `Cleared ${p} filter`, duration: 2000 });
                  } else {
                    setLocationFilter(p);
                    toast({ title: `Filtered by ${p}`, duration: 2000 });
                  }
                }}
                onWorkTypeClick={(w) => {
                  const label = WORK_TYPE_LABELS[w] ?? w;
                  if (workTypeFilter === w) {
                    setWorkTypeFilter("all");
                    toast({ title: `Cleared ${label} filter`, duration: 2000 });
                  } else {
                    setWorkTypeFilter(w);
                    toast({ title: `Filtered by ${label}`, duration: 2000 });
                  }
                }}
                activeLocation={locationFilter}
                activeWorkType={workTypeFilter}
                savedJobIds={savedJobIds}
                isAuthenticated={isAuthenticated}
                canBookmark={canBookmark}
              />
            ))}
          </div>
        )}
      </section>
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <div className="flex justify-center">
            <NisitLogo />
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Papua New Guinea National Institute of Standards and Industrial Technology
          </p>
          <p className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} Government of Papua New Guinea</p>
        </div>
      </footer>
    </div>
  );
}
