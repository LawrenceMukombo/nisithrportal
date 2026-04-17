import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Briefcase, ChevronRight, Shield, Calendar, Building2 } from "lucide-react";
import { useGetJobs, getGetJobsQueryKey } from "@workspace/api-client-react";
import type { Job } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";

function JobCard({ job }: { job: Job }) {
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-job-${job.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link href={`/jobs/${job.id}`}>
              <h3 className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer truncate" data-testid={`link-job-title-${job.id}`}>
                {job.title}
              </h3>
            </Link>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              {job.departmentId && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Dept #{job.departmentId}</span>}
              {job.closingDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(job.closingDate).toLocaleDateString()}
                </span>
              )}
            </div>
            {job.description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
            )}
          </div>
          <Link href={`/jobs/${job.id}`}>
            <Button size="sm" variant="outline" className="shrink-0" data-testid={`button-view-job-${job.id}`}>
              Apply <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const jobs = useGetJobs(
    { status: "published" },
    { query: { queryKey: getGetJobsQueryKey({ status: "published" }) } }
  );

  const filtered = jobs.data?.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-lg p-1.5">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-sm">PNG NISIT</span>
              <span className="text-muted-foreground text-xs ml-2">HR Portal</span>
            </div>
          </div>
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
      {/* Hero: PNG flag-inspired diagonal split — black & red with gold accent bar */}
      <section className="relative overflow-hidden py-20 px-6" style={{
        background: "linear-gradient(135deg, #0a0a0a 50%, #CE1126 50%)"
      }}>
        {/* Gold accent stripe along bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ backgroundColor: "#FCD116" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
            style={{ backgroundColor: "#FCD116", color: "#0a0a0a" }}>
            Papua New Guinea Public Service
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-sm">
            Government Careers in Papua New Guinea
          </h1>
          <p className="text-white/75 text-lg mb-8 max-w-2xl mx-auto">Explore current vacancies at NISIT. Start your career Journey here.</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-12 h-12 text-base bg-white border-0 shadow-lg"
              placeholder="Search job titles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-jobs"
            />
          </div>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" data-testid="heading-open-vacancies">Open Vacancies</h2>
            <p className="text-sm text-muted-foreground">{filtered.length} positions available</p>
          </div>
          <Link href="/jobs">
            <Button variant="outline" size="sm" data-testid="link-all-jobs">
              View all jobs <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {jobs.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No open vacancies found</p>
            <p className="text-sm mt-1">Check back soon for new opportunities</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </section>
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Papua New Guinea National Information Systems and Information Technology Department
          </p>
          <p className="text-xs text-muted-foreground mt-1">Government of Papua New Guinea</p>
        </div>
      </footer>
    </div>
  );
}
