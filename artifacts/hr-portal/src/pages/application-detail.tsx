import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Star, ClipboardEdit, MessageSquare, Loader2, User } from "lucide-react";
import {
  useGetApplication,
  useGetAiScores,
  useGetCandidate,
  useUpdateApplicationStatus,
  useCreateAiScore,
  useUpdateAiScore,
  useAiGenerateInterviewQuestions,
  getGetApplicationQueryKey,
  getGetAiScoresQueryKey,
  getGetApplicationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";

import { ALL_STATUS_OPTIONS } from "@/lib/workflowStages";

const STATUS_OPTIONS = ALL_STATUS_OPTIONS;

function InterviewEvaluationPanel({
  applicationId,
  candidateId,
  jobId,
  existingScoreId,
  existingScore,
  existingRecommendation,
}: {
  applicationId: number;
  candidateId?: number | null;
  jobId: number;
  existingScoreId?: number;
  existingScore?: string | null;
  existingRecommendation?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [score, setScore] = useState(existingScore ?? "");
  const [recommendation, setRecommendation] = useState(existingRecommendation ?? "");
  const [editing, setEditing] = useState(!existingScoreId);

  const createScore = useCreateAiScore();
  const updateScore = useUpdateAiScore();

  const handleSave = async () => {
    try {
      const numScore = parseFloat(score);
      if (isNaN(numScore) || numScore < 0 || numScore > 100) {
        toast({ title: "Score must be a number between 0 and 100", variant: "destructive" });
        return;
      }

      if (existingScoreId) {
        await updateScore.mutateAsync({
          id: existingScoreId,
          data: { score, recommendation },
        });
      } else {
        await createScore.mutateAsync({
          data: {
            candidateId: candidateId ?? 0,
            jobId,
            score,
            recommendation,
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: getGetAiScoresQueryKey() });
      toast({ title: "Evaluation saved" });
      setEditing(false);
    } catch {
      toast({ title: "Failed to save evaluation", variant: "destructive" });
    }
  };

  const isPending = createScore.isPending || updateScore.isPending;

  if (!editing && existingScoreId) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardEdit className="h-4 w-4 text-blue-500" /> Interview Evaluation
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold">{existingScore ?? "—"}</span>
            <Progress value={existingScore ? parseFloat(existingScore) : 0} className="flex-1 h-2" />
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
          {existingRecommendation && (
            <p className="text-sm text-muted-foreground">{existingRecommendation}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardEdit className="h-4 w-4 text-blue-500" /> Interview Evaluation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Score (0–100)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 85"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            data-testid="input-interview-score"
          />
        </div>
        <div className="space-y-1">
          <Label>Notes / Recommendation</Label>
          <Textarea
            placeholder="Interview notes, strengths, areas for improvement..."
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={4}
            data-testid="input-interview-notes"
          />
        </div>
        <div className="flex gap-2">
          {existingScoreId && (
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          )}
          <Button onClick={handleSave} disabled={isPending} data-testid="button-save-evaluation">
            {isPending ? "Saving..." : "Save Evaluation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InterviewQuestionsPanel({ jobId, candidateId }: { jobId: number; candidateId?: number | null }) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState<string>("");
  const generateMutation = useAiGenerateInterviewQuestions();

  const handleGenerate = async () => {
    if (!candidateId) {
      toast({ title: "No candidate linked to this application", variant: "destructive" });
      return;
    }
    try {
      const result = await generateMutation.mutateAsync({ data: { jobId, candidateId } });
      setQuestions(result.questions ?? []);
      setJobTitle(result.jobTitle ?? "");
      toast({ title: "Interview questions generated" });
    } catch {
      toast({ title: "Failed to generate interview questions", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-indigo-500" /> AI Interview Questions
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            data-testid="button-generate-questions"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating...</>
            ) : (
              "Generate Questions"
            )}
          </Button>
        </div>
      </CardHeader>
      {questions.length > 0 && (
        <CardContent>
          {jobTitle && <p className="text-xs text-muted-foreground mb-3">For: {jobTitle}</p>}
          <ol className="space-y-2 list-decimal list-inside">
            {questions.map((q, i) => (
              <li key={i} className="text-sm text-foreground leading-relaxed">{q}</li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

export default function ApplicationDetailPage() {
  const [match, params] = useRoute("/applications/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isHiringManager, isAdmin, isHR } = useRole();
  const appId = match ? parseInt(params!.id) : 0;

  const { data: app, isLoading } = useGetApplication(appId, {
    query: { enabled: !!appId, queryKey: getGetApplicationQueryKey(appId) },
  });

  const { data: candidate } = useGetCandidate(app?.candidateId ?? 0, {
    query: { enabled: !!app?.candidateId },
  });

  const { data: aiScores } = useGetAiScores(undefined, { query: { queryKey: getGetAiScoresQueryKey() } });
  const score = aiScores?.find(
    (s) => app?.candidateId && s.candidateId === app.candidateId && s.jobId === app.jobId
  ) ?? aiScores?.find((s) => s.jobId === app?.jobId);

  const updateStatus = useUpdateApplicationStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(appId) });
        queryClient.invalidateQueries({ queryKey: getGetApplicationsQueryKey() });
        toast({ title: "Status updated" });
      },
    },
  });

  const canUpdateStatus = isAdmin || isHR || isHiringManager;
  const canEvaluate = isAdmin || isHR || isHiringManager;

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!app) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Application not found.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/applications")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
          </Button>
          {app.candidateId && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/candidates/${app.candidateId}`)} data-testid="button-view-candidate-profile">
              <User className="h-4 w-4 mr-1" />
              {candidate?.name ? `${candidate.name}'s Profile` : "Candidate Profile"}
            </Button>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-application">Application #{app.id}</h1>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              <Link href={`/jobs/${app.jobId}`}>
                <span className="hover:underline cursor-pointer">Job #{app.jobId}</span>
              </Link>
              {app.candidateId && (
                <Link href={`/candidates/${app.candidateId}`}>
                  <span className="hover:underline cursor-pointer flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {candidate?.name ?? `Candidate #${app.candidateId}`}
                  </span>
                </Link>
              )}
            </div>
          </div>
          {canUpdateStatus ? (
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select
                value={app.status ?? "applied"}
                onValueChange={(v) => updateStatus.mutate({ id: app.id, data: { status: v } })}
              >
                <SelectTrigger className="w-36" data-testid="select-app-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge variant="outline" className="capitalize">{app.status}</Badge>
          )}
        </div>

        {score && !canEvaluate && (
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

        {canEvaluate && (
          <InterviewEvaluationPanel
            applicationId={app.id}
            candidateId={app.candidateId}
            jobId={app.jobId}
            existingScoreId={score?.id}
            existingScore={score?.score}
            existingRecommendation={score?.recommendation}
          />
        )}

        {canEvaluate && (
          <InterviewQuestionsPanel jobId={app.jobId} candidateId={app.candidateId} />
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
          <CardHeader><CardTitle className="text-base">Application Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted</span>
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
