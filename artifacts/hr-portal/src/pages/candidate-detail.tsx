import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Mail, Phone, Star, FileText } from "lucide-react";
import { useGetCandidate, useGetApplications, useGetAiScores, getGetCandidateQueryKey, getGetApplicationsQueryKey, getGetAiScoresQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";

export default function CandidateDetailPage() {
  const [match, params] = useRoute("/candidates/:id");
  const [, setLocation] = useLocation();
  const candidateId = match ? parseInt(params!.id) : 0;

  const { data: candidate, isLoading } = useGetCandidate(candidateId, {
    query: { enabled: !!candidateId, queryKey: getGetCandidateQueryKey(candidateId) },
  });

  const { data: applications } = useGetApplications(
    { candidate_id: candidateId },
    { query: { enabled: !!candidateId, queryKey: getGetApplicationsQueryKey({ candidate_id: candidateId }) } }
  );

  const { data: aiScores } = useGetAiScores(undefined, { query: { queryKey: getGetAiScoresQueryKey() } });
  const candidateScores = aiScores?.filter((s) => s.candidateId === candidateId);

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!candidate) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Candidate not found.</div></AppLayout>;
  }

  const initials = (candidate.name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  const parsedData = candidate.parsedData as Record<string, unknown> | null;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/candidates")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Candidates
        </Button>

        <div className="flex items-start gap-6">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-candidate-name">{candidate.name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{candidate.email}</span>
              {candidate.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{candidate.phone}</span>}
            </div>
          </div>
        </div>

        {parsedData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!!parsedData.education && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Education</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {String(typeof parsedData.education === "string" ? parsedData.education : JSON.stringify(parsedData.education, null, 2))}
                  </p>
                </CardContent>
              </Card>
            )}
            {Array.isArray(parsedData.skills) && (parsedData.skills as string[]).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm font-semibold">Skills</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(parsedData.skills as string[]).map((skill) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {applications && applications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Applications ({applications.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {applications.map((app) => {
                const score = candidateScores?.find((s) => s.jobId === app.jobId);
                return (
                  <div key={app.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0" data-testid={`row-application-${app.id}`}>
                    <div>
                      <Link href={`/applications/${app.id}`}>
                        <span className="text-sm font-medium text-primary hover:underline cursor-pointer">Application #{app.id}</span>
                      </Link>
                      <p className="text-xs text-muted-foreground">Job #{app.jobId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {score && (
                        <div className="flex items-center gap-2 text-sm">
                          <Star className="h-3.5 w-3.5 text-yellow-500" />
                          <span className="font-medium">{score.score}</span>
                          <Progress value={score.score ? parseFloat(score.score) : 0} className="w-20 h-1.5" />
                        </div>
                      )}
                      <Badge>{app.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
