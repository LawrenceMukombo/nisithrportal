import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Star } from "lucide-react";
import { useGetApplication, useGetAiScores, useUpdateApplicationStatus, getGetApplicationQueryKey, getGetAiScoresQueryKey, getGetApplicationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = ["submitted", "screening", "interview", "offered", "hired", "rejected"];

export default function ApplicationDetailPage() {
  const [match, params] = useRoute("/applications/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const appId = match ? parseInt(params!.id) : 0;

  const { data: app, isLoading } = useGetApplication(appId, {
    query: { enabled: !!appId, queryKey: getGetApplicationQueryKey(appId) },
  });

  const { data: aiScores } = useGetAiScores(undefined, { query: { queryKey: getGetAiScoresQueryKey() } });
  const score = aiScores?.find((s) => s.candidateId && s.jobId === app?.jobId);

  const updateStatus = useUpdateApplicationStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(appId) });
        queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
        toast({ title: "Status updated" });
      },
    },
  });

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!app) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Application not found.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/applications")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-application">Application #{app.id}</h1>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <Link href={`/jobs/${app.jobId}`}>
                <span className="hover:underline cursor-pointer">Job #{app.jobId}</span>
              </Link>
              <Link href={`/candidates/${app.candidateId}`}>
                <span className="hover:underline cursor-pointer">Candidate #{app.candidateId}</span>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select
              value={app.status ?? "submitted"}
              onValueChange={(v) => updateStatus.mutate({ id: app.id, data: { status: v } })}
            >
              <SelectTrigger className="w-36" data-testid="select-app-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {score && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 text-yellow-500" /> AI Score
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold">{score.score ?? "—"}</span>
                <Progress value={score.score ? parseFloat(score.score) : 0} className="flex-1 h-2" />
                <span className="text-muted-foreground text-sm">/ 100</span>
              </div>
              {score.recommendation && (
                <p className="text-sm text-muted-foreground">{score.recommendation}</p>
              )}
            </CardContent>
          </Card>
        )}

        {app.coverLetter && (
          <Card>
            <CardHeader><CardTitle className="text-base">Cover Letter</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-cover-letter">{app.coverLetter}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{app.createdAt ? new Date(app.createdAt).toLocaleString() : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Application ID</span>
              <span className="font-mono">#{app.id}</span>
            </div>
            {app.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span>{app.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
