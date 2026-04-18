import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Briefcase, ChevronRight, Calendar, Building2, MapPin, Clock, ArrowRight } from "lucide-react";
import { useGetJobs, useGetDepartments, getGetJobsQueryKey, getGetDepartmentsQueryKey } from "@workspace/api-client-react";
import type { Job } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";

const WORK_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  casual: "Casual",
};

const DEPT_ACCENT_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-orange-500",
];

function JobCard({ job, deptName, deptAccent }: { job: Job; deptName?: string; deptAccent: string }) {
  const daysLeft = job.closingDate
    ? Math.ceil((new Date(job.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const urgency = daysLeft !== null && daysLeft <= 7 ? "text-red-600" : "text-muted-foreground";
  const closingLabel = daysLeft !== null
    ? daysLeft < 0 ? "Closed" : daysLeft === 0 ? "Closes today" : `${daysLeft}d left`
    : null;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 overflow-hidden border border-border" data-testid={`card-job-${job.id}`}>
      <div className={`h-1 w-full ${deptAccent}`} />
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={`${deptAccent} rounded-lg p-2 shrink-0 mt-0.5`}>
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/jobs/${job.id}`}>
              <h3 className="font-semibold text-sm leading-snug hover:text-primary transition-colors cursor-pointer group-hover:text-primary" data-testid={`link-job-title-${job.id}`}>
                {job.title}
              </h3>
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {deptName && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" /> {deptName}
                </span>
              )}
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
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-xs py-0">Public Service</Badge>
                {job.closingDate && daysLeft !== null && daysLeft <= 14 && daysLeft >= 0 && (
                  <Badge variant="outline" className="text-xs py-0 text-amber-700 border-amber-300 bg-amber-50">Closing soon</Badge>
                )}
              </div>
              <Link href={`/jobs/${job.id}`}>
                <Button size="sm" className="h-7 text-xs gap-1 group-hover:gap-2 transition-all" data-testid={`button-view-job-${job.id}`}>
                  View & Apply <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NisitLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-8 h-8 shrink-0">
        <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(135deg, #0a0a0a 50%, #CE1126 50%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg" style={{ backgroundColor: "#FCD116" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-xs leading-none">N</span>
        </div>
      </div>
      <div>
        <p className="font-bold text-sm leading-none">PNG NISIT</p>
        <p className="text-muted-foreground text-xs leading-none mt-0.5">HR Portal</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("all");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

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
      const matchWorkType = workTypeFilter === "all";
      return matchSearch && matchDept && matchWorkType;
    });
  }, [jobs.data, search, deptFilter, workTypeFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <NisitLogo />
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
                <Link href="/register">
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
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
            style={{ backgroundColor: "#FCD116", color: "#0a0a0a" }}>
            Papua New Guinea Public Service
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-sm">
            Government Careers in Papua New Guinea
          </h1>
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
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-9 w-44 text-sm" data-testid="select-filter-dept">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {(depts.data ?? []).map(d => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {(search || deptFilter !== "all" || workTypeFilter !== "all") && (
            <Button size="sm" variant="ghost" className="h-9 text-sm" onClick={() => { setSearch(""); setDeptFilter("all"); setWorkTypeFilter("all"); }}>
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
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(""); setDeptFilter("all"); setWorkTypeFilter("all"); }}>
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
              />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <NisitLogo />
          <p className="text-sm text-muted-foreground mt-3">
            Papua New Guinea National Information Systems and Information Technology Department
          </p>
          <p className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} Government of Papua New Guinea</p>
        </div>
      </footer>
    </div>
  );
}
