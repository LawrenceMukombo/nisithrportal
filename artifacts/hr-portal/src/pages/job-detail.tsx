import { useRoute, useLocation, useSearch, Link } from "wouter";
import {
  ArrowLeft, Calendar, Building2, Send, Users2, ChevronRight, Sparkles, Loader2,
  MapPin, Briefcase, GraduationCap, Clock, DollarSign, FileCheck, Star,
  Monitor, CheckCircle2,
} from "lucide-react";
import { WORKFLOW_STAGES, STAGE_COLOR_MAP } from "@/lib/workflowStages";
import { useGetJob, useGetApplications, useAiRankCandidates, getGetJobQueryKey } from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth, useRole } from "@/contexts/auth-context";
import { ApplyWizard, DraftBanner, type ScreeningQuestion } from "@/components/apply-wizard";

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  screening: "bg-yellow-100 text-yellow-700",
  interview: "bg-purple-100 text-purple-700",
  offer: "bg-green-100 text-green-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  casual: "Casual",
};

const WORK_ARRANGEMENT_LABELS: Record<string, string> = {
  on_site: "On-Site",
  remote: "Remote",
  hybrid: "Hybrid",
};

function useScreeningQuestions(jobId: number, enabled: boolean) {
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  useEffect(() => {
    if (!enabled || !jobId) return;
    fetch(`/api/jobs/${jobId}/screening-questions`)
      .then(r => r.ok ? r.json() : [])
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, [jobId, enabled]);
  return questions;
}

type RankedCandidate = { applicationId: number; candidateId: number; candidateName: string; score: number; recommendation: string };

function ApplicationPipelineCard({ jobId }: { jobId: number }) {
  const { data: applications = [], isLoading } = useGetApplications({ job_id: jobId });
  const { toast } = useToast();
  const [rankings, setRankings] = useState<RankedCandidate[]>([]);
  const rankMutation = useAiRankCandidates();

  const handleRank = async () => {
    try {
      const result = await rankMutation.mutateAsync({ data: { jobId } });
      setRankings(result as RankedCandidate[]);
      toast({ title: "Candidates ranked by AI" });
    } catch {
      toast({ title: "Failed to rank candidates", variant: "destructive" });
    }
  };

  const byStatus = applications.reduce<Record<string, Application[]>>((acc, app) => {
    (acc[app.status] = acc[app.status] || []).push(app);
    return acc;
  }, {});

  return (
    <Card data-testid="card-pipeline">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Recruitment Pipeline</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{applications.length} application{applications.length !== 1 ? "s" : ""}</Badge>
            {applications.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRank}
                disabled={rankMutation.isPending}
                data-testid="button-ai-rank"
              >
                {rankMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Ranking...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1" /> AI Rank</>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No applications yet for this position.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1 min-w-max">
                {WORKFLOW_STAGES.map((stage) => {
                  const count = byStatus[stage.status]?.length ?? 0;
                  const colors = STAGE_COLOR_MAP[stage.color];
                  const Icon = stage.icon;
                  return (
                    <Link key={stage.id} href={`/applications?status=${stage.status}`}>
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                          count > 0 ? colors.bg : "bg-muted"
                        }`}
                        title={`${stage.label}: ${count} candidate${count !== 1 ? "s" : ""}`}
                      >
                        <Icon className={`h-3 w-3 ${count > 0 ? colors.text : "text-muted-foreground"}`} />
                        <span className={`text-xs font-medium whitespace-nowrap ${count > 0 ? colors.text : "text-muted-foreground"}`}>
                          {stage.label}
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${count > 0 ? colors.text : "text-muted-foreground/60"}`}>
                          {count}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <Separator />
            <div className="space-y-1">
              {applications.slice(0, 20).map((app) => (
                <Link key={app.id} href={`/applications/${app.id}`}>
                  <div
                    className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/60 cursor-pointer transition-colors"
                    data-testid={`pipeline-row-${app.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {app.status}
                      </span>
                      <span className="text-sm font-medium">Candidate #{app.candidateId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {app.createdAt && <span>{new Date(app.createdAt).toLocaleDateString()}</span>}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
              {applications.length > 20 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{applications.length - 20} more —{" "}
                  <Link href="/applications" className="text-primary hover:underline">view all applications</Link>
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
      {rankings.length > 0 && (
        <>
          <Separator />
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> AI Candidate Rankings
            </p>
            <div className="space-y-2">
              {rankings.map((r, i) => (
                <Link key={r.applicationId} href={`/applications/${r.applicationId}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/60 cursor-pointer transition-colors">
                    <span className="text-xs text-muted-foreground w-4">#{i + 1}</span>
                    <span className="flex-1 text-sm font-medium">{r.candidateName}</span>
                    <Badge variant={r.score >= 80 ? "default" : r.score >= 60 ? "secondary" : "outline"}>
                      {r.score}/100
                    </Badge>
                  </div>
                  {r.recommendation && (
                    <p className="text-xs text-muted-foreground ml-9 mb-1 line-clamp-1">{r.recommendation}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

type ExtJob = {
  id: number;
  title: string;
  description: string;
  status: string;
  departmentId?: number | null;
  closingDate?: string | null;
  createdAt?: string;
  referenceNumber?: string | null;
  country?: string | null;
  province?: string | null;
  officeSite?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workArrangement?: string | null;
  publishTarget?: string | null;
  autoExpire?: boolean | null;
  jobSummary?: string | null;
  responsibilities?: string[] | null;
  reportingLine?: string | null;
  minEducation?: string | null;
  yearsExperience?: number | null;
  technicalSkills?: string[] | null;
  softSkills?: string[] | null;
  certifications?: string[] | null;
  languageRequirements?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryVisibility?: string | null;
  gradeBand?: string | null;
  contractDuration?: string | null;
  openingDate?: string | null;
  requiredDocuments?: string[] | null;
  maxApplicants?: number | null;
  isFeatured?: boolean | null;
};

export default function JobDetailPage() {
  const [match, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { isAuthenticated } = useAuth();
  const { isAdmin, isHR, isHiringManager } = useRole();
  const [wizardOpen, setWizardOpen] = useState(() => new URLSearchParams(searchString).get("apply") === "1");

  const jobId = match ? parseInt(params!.id) : 0;
  const { data: rawJob, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) },
  });

  const job = rawJob as ExtJob | undefined;
  const isPublished = job?.status === "published";
  const screeningQuestions = useScreeningQuestions(jobId, isPublished);
  const canViewPipeline = isAuthenticated && (isAdmin || isHR || isHiringManager);

  const showSalary = job?.salaryVisibility === "public" && (job.salaryMin || job.salaryMax);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto text-center py-20">
          <p className="text-muted-foreground">Job not found.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/jobs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs
        </Button>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {job.isFeatured && (
                  <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-50 border-amber-200">
                    <Star className="h-3 w-3" /> Featured
                  </Badge>
                )}
                <Badge variant={job.status === "published" ? "default" : "secondary"}>{job.status}</Badge>
                {job.referenceNumber && (
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                    Ref: {job.referenceNumber}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold" data-testid="heading-job-title">{job.title}</h1>
              {job.gradeBand && <p className="text-sm text-muted-foreground">{job.gradeBand}</p>}

              {/* Key metadata chips */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                {job.departmentId && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> Dept #{job.departmentId}
                  </span>
                )}
                {(job.province || job.location) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[job.officeSite, job.province || job.location, job.country !== "Papua New Guinea" ? job.country : null].filter(Boolean).join(", ")}
                  </span>
                )}
                {job.employmentType && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" /> {EMPLOYMENT_LABELS[job.employmentType] ?? job.employmentType}
                  </span>
                )}
                {job.workArrangement && (
                  <span className="flex items-center gap-1">
                    <Monitor className="h-3.5 w-3.5" /> {WORK_ARRANGEMENT_LABELS[job.workArrangement] ?? job.workArrangement}
                  </span>
                )}
                {job.contractDuration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {job.contractDuration}
                  </span>
                )}
                {job.closingDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Closes {new Date(job.closingDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Salary */}
              {showSalary && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <DollarSign className="h-4 w-4" />
                  {job.salaryCurrency ?? "PGK"} {(job.salaryMin ?? 0).toLocaleString()}
                  {job.salaryMax ? ` – ${job.salaryMax.toLocaleString()}` : "+"} per annum
                </div>
              )}
              {job.salaryVisibility === "internal" && (
                <p className="text-sm text-muted-foreground italic">Salary on request</p>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {isPublished && (
                <Button size="lg" onClick={() => setWizardOpen(true)} data-testid="button-apply-now">
                  <Send className="h-4 w-4 mr-2" /> Apply Now
                </Button>
              )}
            </div>
          </div>

          {/* Draft resume banner */}
          {isPublished && (
            <DraftBanner jobId={jobId} onResume={() => setWizardOpen(true)} />
          )}

          <Separator />

          {/* Job Summary */}
          {job.jobSummary && (
            <Card>
              <CardHeader><CardTitle className="text-base">About the Role</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{job.jobSummary}</p>
              </CardContent>
            </Card>
          )}

          {/* Responsibilities */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Key Responsibilities</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {job.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
                {job.reportingLine && (
                  <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                    <span className="font-medium text-foreground">Reporting Line: </span>
                    {job.reportingLine}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          {(job.minEducation || job.yearsExperience || (job.technicalSkills && job.technicalSkills.length > 0) ||
            (job.softSkills && job.softSkills.length > 0) || (job.certifications && job.certifications.length > 0) ||
            job.languageRequirements) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {job.minEducation && (
                    <div>
                      <p className="font-medium text-foreground text-xs uppercase tracking-wide text-muted-foreground mb-1">Minimum Education</p>
                      <p>{job.minEducation}</p>
                    </div>
                  )}
                  {job.yearsExperience != null && (
                    <div>
                      <p className="font-medium text-foreground text-xs uppercase tracking-wide text-muted-foreground mb-1">Experience Required</p>
                      <p>{job.yearsExperience} year{job.yearsExperience !== 1 ? "s" : ""}</p>
                    </div>
                  )}
                  {job.languageRequirements && (
                    <div>
                      <p className="font-medium text-foreground text-xs uppercase tracking-wide text-muted-foreground mb-1">Languages</p>
                      <p>{job.languageRequirements}</p>
                    </div>
                  )}
                </div>

                {job.technicalSkills && job.technicalSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Technical Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.technicalSkills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                )}

                {job.softSkills && job.softSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Soft Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.softSkills.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                    </div>
                  </div>
                )}

                {job.certifications && job.certifications.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Certifications / Licences</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.certifications.map(c => <Badge key={c} variant="outline" className="text-primary">{c}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Full description */}
          {job.description && job.description.trim() && job.description.trim() !== " " && (
            <Card>
              <CardHeader><CardTitle className="text-base">Additional Details</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-job-description">
                  {job.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Required Documents */}
          {job.requiredDocuments && job.requiredDocuments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" /> Required Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {job.requiredDocuments.map((doc, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {canViewPipeline && <ApplicationPipelineCard jobId={job.id} />}
        </div>

        {/* Apply Wizard */}
        <ApplyWizard
          jobId={job.id}
          jobTitle={job.title}
          screeningQuestions={screeningQuestions}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
        />
      </div>
    </AppLayout>
  );
}
