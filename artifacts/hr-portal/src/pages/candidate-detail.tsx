import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Mail, Phone, Star, FileText, GraduationCap, Briefcase,
  Globe, User, MapPin, Calendar, Award, Users, ChevronRight,
  DollarSign, ShieldCheck, Paperclip,
} from "lucide-react";
import {
  useGetCandidateProfile,
  useGetAiScores,
  useGetJobs,
  getGetCandidateProfileQueryKey,
  getGetAiScoresQueryKey,
  getGetJobsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800",
  shortlisted: "bg-yellow-100 text-yellow-800",
  interview: "bg-purple-100 text-purple-800",
  offered: "bg-orange-100 text-orange-800",
  hired: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-[140px] shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function CandidateDetailPage() {
  const [match, params] = useRoute("/candidates/:id");
  const [, setLocation] = useLocation();
  const candidateId = match ? parseInt(params!.id) : 0;

  const { data: profile, isLoading } = useGetCandidateProfile(candidateId, {
    query: { enabled: !!candidateId, queryKey: getGetCandidateProfileQueryKey(candidateId) },
  });

  const { data: aiScores } = useGetAiScores(undefined, { query: { queryKey: getGetAiScoresQueryKey() } });
  const candidateScores = aiScores?.filter((s) => s.candidateId === candidateId);

  const { data: jobs = [] } = useGetJobs(undefined, { query: { queryKey: getGetJobsQueryKey() } });
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="p-6 text-center py-20 text-muted-foreground">Candidate not found.</div>
      </AppLayout>
    );
  }

  const initials = (profile.name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const parsedData = profile.parsedData as Record<string, unknown> | null;
  const skillsFromParsed = Array.isArray(parsedData?.skills) ? (parsedData!.skills as string[]) : [];

  const hasPersonalExtended = profile.gender || profile.dateOfBirth || profile.nationality || profile.maritalStatus || profile.nationalId;
  const hasContactExtended = profile.alternativePhone || profile.physicalAddress || profile.city || profile.province;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/candidates")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Candidates
        </Button>

        {/* Header */}
        <div className="flex items-start gap-6 bg-card border rounded-xl p-6">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="heading-candidate-name">{profile.name}</h1>
            {profile.otherNames && <p className="text-muted-foreground text-sm">Also known as: {profile.otherNames}</p>}
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{profile.email}</span>
              {profile.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
              {profile.alternativePhone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{profile.alternativePhone}</span>}
              {(profile.city || profile.province) && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[profile.city, profile.province].filter(Boolean).join(", ")}</span>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Badge variant="outline">{profile.applications?.length ?? 0} application{(profile.applications?.length ?? 0) !== 1 ? "s" : ""}</Badge>
              {profile.cvUrl && (
                <a href={profile.cvUrl} target="_blank" rel="noopener noreferrer">
                  <Badge variant="secondary" className="cursor-pointer"><FileText className="h-3 w-3 mr-1" />View CV</Badge>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: personal + contact */}
          <div className="space-y-4">
            {hasPersonalExtended && (
              <SectionCard icon={User} title="Personal Information">
                <div className="space-y-2">
                  <InfoRow label="Gender" value={profile.gender} />
                  <InfoRow label="Date of Birth" value={profile.dateOfBirth} />
                  <InfoRow label="Nationality" value={profile.nationality} />
                  <InfoRow label="National ID" value={profile.nationalId} />
                  <InfoRow label="Marital Status" value={profile.maritalStatus} />
                </div>
              </SectionCard>
            )}

            {hasContactExtended && (
              <SectionCard icon={MapPin} title="Address">
                <div className="space-y-2">
                  <InfoRow label="Physical Address" value={profile.physicalAddress} />
                  <InfoRow label="City" value={profile.city} />
                  <InfoRow label="District" value={profile.district} />
                  <InfoRow label="Province" value={profile.province} />
                  <InfoRow label="Postal Address" value={profile.postalAddress} />
                </div>
              </SectionCard>
            )}

            {profile.languages && profile.languages.length > 0 && (
              <SectionCard icon={Globe} title="Languages">
                <div className="space-y-2">
                  {profile.languages.map((lang) => (
                    <div key={lang.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{lang.language}</span>
                      {lang.proficiency && <Badge variant="outline" className="text-xs">{lang.proficiency}</Badge>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {profile.technicalSkills && profile.technicalSkills.length > 0 && (
              <SectionCard icon={Award} title="Technical Skills">
                <div className="flex flex-wrap gap-1.5">
                  {profile.technicalSkills.map((s) => (
                    <Badge key={s.id} variant="secondary" className="text-xs">{s.skill}</Badge>
                  ))}
                </div>
              </SectionCard>
            )}

            {profile.softSkills && profile.softSkills.length > 0 && (
              <SectionCard icon={Users} title="Soft Skills">
                <div className="flex flex-wrap gap-1.5">
                  {profile.softSkills.map((s) => (
                    <Badge key={s.id} variant="outline" className="text-xs">{s.skill}</Badge>
                  ))}
                </div>
              </SectionCard>
            )}

            {skillsFromParsed.length > 0 && (
              <SectionCard icon={Award} title="AI-Parsed Skills">
                <div className="flex flex-wrap gap-1.5">
                  {skillsFromParsed.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Right column: education, experience, referees, applications */}
          <div className="lg:col-span-2 space-y-4">
            {profile.education && profile.education.length > 0 && (
              <SectionCard icon={GraduationCap} title={`Education (${profile.education.length})`}>
                <div className="space-y-4">
                  {profile.education.map((edu, idx) => (
                    <div key={edu.id}>
                      {idx > 0 && <Separator className="mb-4" />}
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">{edu.institution}</p>
                        {(edu.level || edu.qualification) && (
                          <p className="text-sm text-muted-foreground">
                            {[edu.level, edu.qualification].filter(Boolean).join(" — ")}
                          </p>
                        )}
                        {edu.fieldOfStudy && <p className="text-xs text-muted-foreground">Field: {edu.fieldOfStudy}</p>}
                        {(edu.startDate || edu.endDate) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {edu.startDate ?? "?"} – {edu.current ? "Present" : (edu.endDate ?? "?")}
                          </p>
                        )}
                        {edu.certifications && <p className="text-xs mt-1 text-muted-foreground">Certs: {edu.certifications}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {profile.experience && profile.experience.length > 0 && (
              <SectionCard icon={Briefcase} title={`Work Experience (${profile.experience.length})`}>
                <div className="space-y-4">
                  {profile.experience.map((exp, idx) => (
                    <div key={exp.id}>
                      {idx > 0 && <Separator className="mb-4" />}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between">
                          <p className="font-semibold text-sm">{exp.employer}</p>
                          {exp.current && <Badge variant="outline" className="text-xs">Current</Badge>}
                        </div>
                        {exp.jobTitle && <p className="text-sm text-muted-foreground">{exp.jobTitle}</p>}
                        {(exp.startDate || exp.endDate) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {exp.startDate ?? "?"} – {exp.current ? "Present" : (exp.endDate ?? "?")}
                          </p>
                        )}
                        {exp.responsibilities && (
                          <p className="text-xs mt-2 text-muted-foreground whitespace-pre-line line-clamp-3">{exp.responsibilities}</p>
                        )}
                        {exp.keyAchievements && (
                          <p className="text-xs mt-1 text-green-700 line-clamp-2">✓ {exp.keyAchievements}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {profile.referees && profile.referees.length > 0 && (
              <SectionCard icon={Users} title={`Referees (${profile.referees.length})`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.referees.map((ref) => (
                    <div key={ref.id} className="border rounded-lg p-3 space-y-1 text-sm">
                      <p className="font-semibold">{ref.name}</p>
                      {ref.relationship && <p className="text-muted-foreground text-xs">{ref.relationship}</p>}
                      {ref.organisation && <p className="text-xs">{ref.organisation}</p>}
                      {ref.email && (
                        <a href={`mailto:${ref.email}`} className="text-xs text-primary hover:underline block">
                          {ref.email}
                        </a>
                      )}
                      {ref.phone && <p className="text-xs text-muted-foreground">{ref.phone}</p>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {profile.applications && profile.applications.length > 0 && (
              <SectionCard icon={FileText} title={`Applications (${profile.applications.length})`}>
                <div className="divide-y">
                  {profile.applications.map((app) => {
                    const score = candidateScores?.find((s) => s.jobId === app.jobId);
                    const appDocuments = app.documents;
                    const appAnswers = app.screeningAnswers;
                    const job = jobMap.get(app.jobId);
                    return (
                      <div key={app.id} className="py-2.5 space-y-2" data-testid={`row-application-${app.id}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <Link href={`/applications/${app.id}`}>
                              <span className="text-sm font-medium text-primary hover:underline cursor-pointer flex items-center gap-1">
                                Application #{app.id} <ChevronRight className="h-3 w-3" />
                              </span>
                            </Link>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                              <Link href={`/jobs/${app.jobId}`}>
                                <span className="hover:underline cursor-pointer" data-testid={`job-title-${app.id}`}>
                                  {job?.title ?? `Job #${app.jobId}`}
                                </span>
                              </Link>
                              {app.createdAt && <span>· {new Date(app.createdAt).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {score && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Star className="h-3.5 w-3.5 text-yellow-500" />
                                <span className="font-medium text-xs">{score.score}</span>
                                <Progress value={score.score ? parseFloat(score.score) : 0} className="w-16 h-1.5" />
                              </div>
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? "bg-gray-100 text-gray-700"}`}>
                              {app.status}
                            </span>
                          </div>
                        </div>
                        {appDocuments && appDocuments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-2">
                            {appDocuments.map((doc) => (
                              <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Badge variant="outline" className="text-xs flex items-center gap-1 cursor-pointer hover:bg-muted">
                                  <Paperclip className="h-2.5 w-2.5" />{doc.documentType}: {doc.fileName ?? "file"}
                                </Badge>
                              </a>
                            ))}
                          </div>
                        )}
                        {appAnswers && appAnswers.length > 0 && (
                          <div className="pl-2 space-y-1">
                            {appAnswers.map((ans) => (
                              <div key={ans.id} className="text-xs">
                                <span className="text-muted-foreground">{ans.question ?? `Q${ans.questionId}`}: </span>
                                <span className="font-medium">{ans.answer}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Compensation & declarations from most recent application */}
            {(() => {
              const sorted = [...(profile.applications ?? [])].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
              const latest = sorted[0];
              if (!latest) return null;
              const hasCompensation = latest.expectedSalary || latest.currentSalary || latest.noticePeriod;
              const hasDeclarations = latest.declarationAgreed != null || latest.backgroundCheckConsent != null;
              return (
                <>
                  {hasCompensation && (
                    <SectionCard icon={DollarSign} title="Compensation">
                      <div className="space-y-2">
                        <InfoRow label="Expected Salary" value={latest.expectedSalary} />
                        <InfoRow label="Current Salary" value={latest.currentSalary} />
                        <InfoRow label="Notice Period" value={latest.noticePeriod} />
                      </div>
                    </SectionCard>
                  )}
                  {hasDeclarations && (
                    <SectionCard icon={ShieldCheck} title="Declaration Status">
                      <div className="space-y-1.5">
                        {([
                          { label: "Declaration Agreed", value: latest.declarationAgreed },
                          { label: "Background Check Consent", value: latest.backgroundCheckConsent },
                          { label: "Conflict of Interest Declared", value: latest.conflictOfInterest },
                          { label: "Criminal Record Declared", value: latest.criminalRecord },
                          { label: "Data Privacy Consent", value: latest.dataPrivacyConsent },
                        ] as Array<{ label: string; value: boolean | null | undefined }>).filter(({ value }) => value != null).map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <Badge variant={value ? "default" : "destructive"} className="text-xs">
                              {value ? "Yes" : "No"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
