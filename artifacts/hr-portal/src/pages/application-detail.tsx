import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Star, ClipboardEdit, MessageSquare, Loader2, User, MapPin, Briefcase, DollarSign, ShieldCheck, Award, HelpCircle, FileText, ExternalLink, FileDown, UserPlus, Clock, Mail, Upload, Trash2, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { PdfPreviewDialog } from "@/components/pdf-preview-dialog";
import { getToken } from "@/lib/api-config";
import {
  useGetApplication,
  useGetAiScores,
  useGetCandidate,
  useGetJob,
  useUpdateApplicationStatus,
  useCreateAiScore,
  useUpdateAiScore,
  useAiGenerateInterviewQuestions,
  getGetApplicationQueryKey,
  getGetAiScoresQueryKey,
  getGetApplicationsQueryKey,
  getGetCandidateQueryKey,
  getGetJobQueryKey,
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
import { useRole } from "@/contexts/use-auth";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ALL_STATUS_OPTIONS } from "@/lib/workflowStages";
import { ApplicationTimeline } from "@/components/application-timeline";

const STATUS_OPTIONS = ALL_STATUS_OPTIONS;

const STATUS_BADGE_STYLE: Record<string, string> = {
  applied:    "bg-blue-100 text-blue-700 border border-blue-300",
  screening:  "bg-yellow-100 text-yellow-700 border border-yellow-300",
  interview:  "bg-purple-100 text-purple-700 border border-purple-300",
  offer:      "bg-green-100 text-green-700 border border-green-300",
  hired:      "bg-teal-100 text-teal-700 border border-teal-300",
  onboarding: "bg-emerald-100 text-emerald-700 border border-emerald-300",
  rejected:   "bg-red-100 text-red-700 border border-red-300",
  withdrawn:  "bg-gray-100 text-gray-500 border border-gray-300",
};

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

type ScreeningAnswer = { id: number; questionId: number; answer: string | null; question: string | null; questionType: string | null };
type AppDocument = { id: number; documentType: string; url: string; fileName: string | null; createdAt: string };
type DocDeletion = {
  id: number;
  performedByEmail: string | null;
  performedById: number | null;
  createdAt: string;
  details: { documentType?: string | null; fileName?: string | null; documentId?: number | null; reason?: string | null } | null;
};
type OfferLetterSendLogEntry = {
  id: number;
  sentAt: string;
  recipientEmail: string;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  cv: "CV / Résumé", academic_cert: "Academic Certificate", professional_cert: "Professional Certificate",
  reference_letter: "Reference Letter", signed_contract: "Signed Contract", other: "Other",
};

export default function ApplicationDetailPage() {
  const [match, params] = useRoute("/applications/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isHiringManager, isAdmin, isHR } = useRole();
  const appId = match ? parseInt(params!.id) : 0;
  const [screeningAnswers, setScreeningAnswers] = useState<ScreeningAnswer[]>([]);
  const [appDocuments, setAppDocuments] = useState<AppDocument[]>([]);
  const [docDeletions, setDocDeletions] = useState<DocDeletion[]>([]);
  const [docToDelete, setDocToDelete] = useState<AppDocument | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingDoc, setDeletingDoc] = useState(false);

  const refreshDocDeletions = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/applications/${appId}/document-deletions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDocDeletions(await res.json() as DocDeletion[]);
      }
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    if (!appId || !(isAdmin || isHR || isHiringManager)) return;
    const token = getToken();
    if (!token) return;
    const headers = { "Authorization": `Bearer ${token}` };
    Promise.all([
      fetch(`/api/applications/${appId}/screening-answers`, { headers }).then(r => r.ok ? r.json() as Promise<ScreeningAnswer[]> : []),
      fetch(`/api/applications/${appId}/documents`, { headers }).then(r => r.ok ? r.json() as Promise<AppDocument[]> : []),
      fetch(`/api/applications/${appId}/document-deletions`, { headers }).then(r => r.ok ? r.json() as Promise<DocDeletion[]> : []),
    ]).then(([answers, docs, deletions]) => {
      setScreeningAnswers(answers);
      setAppDocuments(docs);
      setDocDeletions(deletions);
    }).catch(() => { /* non-fatal */ });
  }, [appId, isAdmin, isHR, isHiringManager]);

  const { data: app, isLoading } = useGetApplication(appId, {
    query: { enabled: !!appId, queryKey: getGetApplicationQueryKey(appId) },
  });

  const { data: candidate } = useGetCandidate(app?.candidateId ?? 0, {
    query: { enabled: !!app?.candidateId, queryKey: getGetCandidateQueryKey(app?.candidateId ?? 0) },
  });

  const { data: jobDetail } = useGetJob(app?.jobId ?? 0, {
    query: { enabled: !!app?.jobId, queryKey: getGetJobQueryKey(app?.jobId ?? 0) },
  });

  useEffect(() => {
    if (!appId) return;
    const candidateName = candidate?.name;
    const jobTitle = jobDetail?.title;
    if (candidateName && jobTitle) {
      document.title = `${candidateName} — ${jobTitle} | Applications`;
    } else {
      document.title = `Application #${appId} | Applications`;
    }
    return () => {
      document.title = "PNG NISIT HR Portal";
    };
  }, [appId, candidate?.name, jobDetail?.title]);

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

  const [offerLetterLoading, setOfferLetterLoading] = useState(false);
  const [sendOfferLoading, setSendOfferLoading] = useState(false);
  const [showOfferPreview, setShowOfferPreview] = useState(false);
  const [confirmSendOffer, setConfirmSendOffer] = useState(false);
  const [offerHistory, setOfferHistory] = useState<OfferLetterSendLogEntry[]>([]);
  const [offerHistoryLoading, setOfferHistoryLoading] = useState(false);
  const [offerHistoryOpen, setOfferHistoryOpen] = useState(false);
  const [resendConfirm, setResendConfirm] = useState<{ hours: number; onSuccess?: () => void } | null>(null);

  async function loadOfferLetterHistory() {
    if (!appId) return;
    setOfferHistoryLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/pdf/offer-letter-history/${appId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const rows = (await res.json()) as OfferLetterSendLogEntry[];
        setOfferHistory(rows);
      }
    } catch {
      /* non-fatal */
    } finally {
      setOfferHistoryLoading(false);
    }
  }

  // Auto-load history when an offer has ever been sent so we can show the count.
  useEffect(() => {
    if (!appId) return;
    if (!(isAdmin || isHR || isHiringManager)) return;
    if (!app?.offerLetterSentAt) return;
    loadOfferLetterHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, app?.offerLetterSentAt, isAdmin, isHR, isHiringManager]);

  function requestSendOfferLetter(onSuccess?: () => void) {
    if (app?.offerLetterSentAt) {
      const sentAt = new Date(app.offerLetterSentAt).getTime();
      const hoursAgo = (Date.now() - sentAt) / (1000 * 60 * 60);
      if (hoursAgo < 24) {
        setResendConfirm({ hours: Math.max(0, hoursAgo), onSuccess });
        return;
      }
    }
    setConfirmSendOffer(true);
  }

  async function sendOfferLetterEmail(): Promise<boolean> {
    if (!appId) return false;
    setSendOfferLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/pdf/send-offer-letter/${appId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
      if (!res.ok) {
        toast({ title: body.error ?? "Failed to send offer letter", variant: "destructive" });
        return false;
      }
      toast({ title: "Offer letter sent to candidate", description: body.message });
      queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(appId) });
      loadOfferLetterHistory();
      return true;
    } catch {
      toast({ title: "Failed to send offer letter", variant: "destructive" });
      return false;
    } finally {
      setSendOfferLoading(false);
    }
  }

  async function handleDeleteDocument(reason: string) {
    if (!docToDelete || !appId) return;
    setDeletingDoc(true);
    try {
      const token = getToken();
      const trimmedReason = deleteReason.trim();
      const res = await fetch(`/api/applications/${appId}/documents/${docToDelete.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(trimmedReason ? { reason: trimmedReason } : {}),
      });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast({ title: err.error ?? "Failed to delete document", variant: "destructive" });
        return;
      }
      setAppDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      toast({ title: "Document removed", description: "You can upload a replacement if needed." });
      setDocToDelete(null);
      setDeleteReason("");
      void refreshDocDeletions();
    } catch {
      toast({ title: "Failed to delete document", variant: "destructive" });
    } finally {
      setDeletingDoc(false);
    }
  }

  async function handleContractUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !appId) return;
    setContractUploading(true);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "signed_contract");
      const res = await fetch(`/api/applications/${appId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast({ title: err.error ?? "Failed to upload contract", variant: "destructive" });
        return;
      }
      toast({ title: "Signed contract uploaded successfully" });
      const [, docs] = await Promise.all([
        Promise.resolve(),
        fetch(`/api/applications/${appId}/documents`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r => r.ok ? r.json() as Promise<AppDocument[]> : []),
      ]);
      setAppDocuments(docs);
      if (contractFileRef.current) contractFileRef.current.value = "";
    } catch {
      toast({ title: "Failed to upload contract", variant: "destructive" });
    } finally {
      setContractUploading(false);
    }
  }

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!app) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Application not found.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/applications")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
          </Button>
          {app.candidateId && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/candidates/${app.candidateId}`)} data-testid="button-view-candidate-profile">
              <User className="h-4 w-4 mr-1" />
              {candidate?.name ? `${candidate.name}'s Profile` : "Candidate Profile"}
            </Button>
          )}
          {app.status === "hired" && canUpdateStatus && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOfferPreview(true)}
                data-testid="button-preview-offer-letter"
                className="border-purple-600 text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-500 dark:hover:bg-purple-950"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />Preview Offer Letter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadOfferLetter}
                disabled={offerLetterLoading}
                data-testid="button-generate-offer-letter"
                className="border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950"
              >
                {offerLetterLoading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating...</>
                  : <><FileDown className="h-3.5 w-3.5 mr-1.5" />Generate Offer Letter</>
                }
              </Button>
              <div className="flex flex-col items-start gap-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestSendOfferLetter()}
                  disabled={sendOfferLoading}
                  data-testid="button-send-offer-letter"
                  className="border-blue-600 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500 dark:hover:bg-blue-950"
                >
                  {sendOfferLoading
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</>
                    : app.offerLetterSentAt
                      ? <><Mail className="h-3.5 w-3.5 mr-1.5" />Resend Offer Letter</>
                      : <><Mail className="h-3.5 w-3.5 mr-1.5" />Send to Candidate</>
                  }
                </Button>
                {app.offerLetterSentAt && (
                  <span
                    className="text-[11px] text-muted-foreground pl-1"
                    data-testid="text-offer-letter-last-sent"
                  >
                    Last sent: {new Date(app.offerLetterSentAt).toLocaleString("en-PG", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                )}
                {app.offerLetterSentAt && (
                  <button
                    type="button"
                    onClick={() => setOfferHistoryOpen((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline pl-1 mt-0.5"
                    data-testid="button-toggle-offer-history"
                  >
                    {offerHistoryOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {offerHistoryLoading && offerHistory.length === 0
                      ? "Loading send history…"
                      : `Send history (${offerHistory.length})`}
                  </button>
                )}
                {offerHistoryOpen && app.offerLetterSentAt && (
                  <div
                    className="mt-1 ml-1 border border-border rounded-md bg-muted/30 p-2 text-[11px] w-[320px] max-w-full"
                    data-testid="container-offer-letter-history"
                  >
                    {offerHistoryLoading && offerHistory.length === 0 ? (
                      <div className="text-muted-foreground">Loading…</div>
                    ) : offerHistory.length === 0 ? (
                      <div className="text-muted-foreground">No send history recorded yet.</div>
                    ) : (
                      <ol className="space-y-1.5">
                        {offerHistory.map((entry, idx) => (
                          <li
                            key={entry.id}
                            className="flex flex-col gap-0.5"
                            data-testid={`row-offer-letter-history-${entry.id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">
                                #{offerHistory.length - idx} ·{" "}
                                {new Date(entry.sentAt).toLocaleString("en-PG", {
                                  day: "numeric", month: "short", year: "numeric",
                                  hour: "numeric", minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              By {entry.userName ?? entry.userEmail ?? "Unknown user"}
                            </span>
                            <span className="text-muted-foreground break-all">
                              To {entry.recipientEmail}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-create-employee"
                className="border-teal-600 text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-500 dark:hover:bg-teal-950"
                onClick={() => {
                  const qs = new URLSearchParams();
                  if (candidate?.name)  qs.set("name",  candidate.name);
                  if (candidate?.email) qs.set("email", candidate.email);
                  if (candidate?.phone) qs.set("phone", candidate.phone ?? "");
                  if (jobDetail?.departmentId) qs.set("departmentId", String(jobDetail.departmentId));
                  qs.set("fromApp", String(app.id));
                  setLocation(`/employees/new?${qs.toString()}`);
                }}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Create Employee Record
              </Button>
            </>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-application">
              {app.candidateId ? (
                <Link href={`/candidates/${app.candidateId}`}>
                  <span className="hover:underline cursor-pointer">
                    {candidate?.name ?? `Candidate #${app.candidateId}`}
                  </span>
                </Link>
              ) : (
                <span>{candidate?.name ?? "Unknown Candidate"}</span>
              )}
              {" "}—{" "}
              {app.jobId ? (
                <Link href={`/jobs/${app.jobId}`}>
                  <span className="hover:underline cursor-pointer">
                    {jobDetail?.title ?? `Job #${app.jobId}`}
                  </span>
                </Link>
              ) : (
                <span>{jobDetail?.title ?? "Unknown Job"}</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Application #{app.id}
            </p>
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
            <Badge className={`capitalize ${STATUS_BADGE_STYLE[app.status ?? ""] ?? "border bg-muted text-muted-foreground"}`}>
              {app.status}
            </Badge>
          )}
        </div>

        <Card data-testid="card-application-timeline">
          <CardHeader>
            <CardTitle className="text-base">Application Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ApplicationTimeline status={app.status} statusHistory={app.statusHistory} />
          </CardContent>
        </Card>

        {canUpdateStatus && app.statusHistory && app.statusHistory.length > 1 && (() => {
          type SHItem = { id: number; applicationId: number; status: string; changedAt: string; note?: string | null };
          const STATUS_LABEL: Record<string, string> = {
            applied: "Application Received", screening: "CV Screening",
            interview: "Interview", offer: "Offer Extended",
            hired: "Hired", onboarding: "Onboarding",
            rejected: "Rejected", withdrawn: "Withdrawn",
          };
          const BADGE_CLASS: Record<string, string> = {
            applied: "bg-blue-100 text-blue-700 border-blue-200",
            screening: "bg-yellow-100 text-yellow-700 border-yellow-200",
            interview: "bg-purple-100 text-purple-700 border-purple-200",
            offer: "bg-green-100 text-green-700 border-green-200",
            hired: "bg-teal-100 text-teal-700 border-teal-200",
            onboarding: "bg-emerald-100 text-emerald-700 border-emerald-200",
            rejected: "bg-red-100 text-red-700 border-red-200",
            withdrawn: "bg-gray-100 text-gray-600 border-gray-200",
          };
          const fmtDate = (iso: string) =>
            new Date(iso).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" });
          const sorted = [...(app.statusHistory as SHItem[])].sort(
            (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
          );
          const breakdown = sorted.map((h, i) => {
            const isCurrent = i === sorted.length - 1;
            const exitDate = isCurrent ? null : sorted[i + 1].changedAt;
            const exitMs = exitDate ? new Date(exitDate).getTime() : Date.now();
            const days = Math.max(0, Math.floor((exitMs - new Date(h.changedAt).getTime()) / 86400000));
            return { status: h.status, enteredAt: h.changedAt, exitedAt: exitDate, days, isCurrent };
          });
          const maxDays = Math.max(1, ...breakdown.map((b) => b.days));
          return (
            <Card data-testid="card-stage-breakdown">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Stage Duration Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left pb-2 font-medium">Stage</th>
                        <th className="text-left pb-2 font-medium">Entered</th>
                        <th className="text-left pb-2 font-medium">Exited</th>
                        <th className="text-left pb-2 font-medium w-[28%]">Duration</th>
                        <th className="text-right pb-2 font-medium">Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {breakdown.map((item, i) => (
                        <tr key={i} className={item.isCurrent ? "bg-primary/5" : ""}>
                          <td className="py-2 pr-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${BADGE_CLASS[item.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {STATUS_LABEL[item.status] ?? item.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground tabular-nums">
                            {fmtDate(item.enteredAt)}
                          </td>
                          <td className="py-2 pr-3">
                            {item.isCurrent
                              ? <span className="text-primary font-medium">Current</span>
                              : <span className="text-muted-foreground tabular-nums">{fmtDate(item.exitedAt!)}</span>
                            }
                          </td>
                          <td className="py-2 pr-3">
                            <div
                              className="h-1.5 rounded-full bg-muted overflow-hidden"
                              role="progressbar"
                              aria-valuenow={item.days}
                              aria-valuemin={0}
                              aria-valuemax={maxDays}
                              aria-label={`${item.days} days, ${Math.round((item.days / maxDays) * 100)}% of longest stage`}
                              data-testid={`bar-stage-duration-${i}`}
                            >
                              <div
                                className={`h-full rounded-full ${item.isCurrent ? "bg-primary" : "bg-primary/40"}`}
                                style={{ width: `${Math.max(2, (item.days / maxDays) * 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2 text-right">
                            <span className={`font-semibold tabular-nums ${item.isCurrent ? "text-primary" : "text-foreground"}`}>
                              {item.days}d
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border" data-testid="row-total-duration">
                        <td className="pt-2 pr-3 font-semibold text-foreground" colSpan={3}>
                          Total
                        </td>
                        <td className="pt-2 text-right">
                          <span className="font-bold tabular-nums text-foreground">
                            {breakdown.reduce((sum, item) => sum + item.days, 0)}d
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

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

        {app.personalStatement && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Personal Statement</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{app.personalStatement}</p>
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

        {(app.preferredLocation || app.availability || app.workType || app.relocate != null) && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Position Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {app.preferredLocation && <div className="flex justify-between"><span className="text-muted-foreground">Preferred Location</span><span>{app.preferredLocation}</span></div>}
              {app.availability && <div className="flex justify-between"><span className="text-muted-foreground">Availability</span><span>{app.availability}</span></div>}
              {app.workType && <div className="flex justify-between"><span className="text-muted-foreground">Work Type</span><span className="capitalize">{app.workType}</span></div>}
              {app.relocate != null && <div className="flex justify-between"><span className="text-muted-foreground">Willing to Relocate</span><span>{app.relocate ? "Yes" : "No"}</span></div>}
            </CardContent>
          </Card>
        )}

        {(app.expectedSalary || app.currentSalary || app.noticePeriod) && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Compensation & Availability</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {app.expectedSalary && <div className="flex justify-between"><span className="text-muted-foreground">Expected Salary</span><span>{app.expectedSalary}</span></div>}
              {app.currentSalary && <div className="flex justify-between"><span className="text-muted-foreground">Current Salary</span><span>{app.currentSalary}</span></div>}
              {app.noticePeriod && <div className="flex justify-between"><span className="text-muted-foreground">Notice Period</span><span>{app.noticePeriod}</span></div>}
            </CardContent>
          </Card>
        )}

        {(app.technicalSkills || app.softSkills || app.computerLiteracy || app.certificationsLicenses) && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" />Skills & Competencies</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {Array.isArray(app.technicalSkills) && (app.technicalSkills as string[]).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Technical Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(app.technicalSkills as string[]).map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
                  </div>
                </div>
              )}
              {Array.isArray(app.softSkills) && (app.softSkills as string[]).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Soft Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(app.softSkills as string[]).map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>)}
                  </div>
                </div>
              )}
              {app.computerLiteracy && <div className="flex justify-between"><span className="text-muted-foreground">Computer Literacy</span><span>{app.computerLiteracy}</span></div>}
              {app.certificationsLicenses && <div className="flex justify-between"><span className="text-muted-foreground">Certifications</span><span>{app.certificationsLicenses}</span></div>}
            </CardContent>
          </Card>
        )}

        {(app.declarationAgreed != null || app.backgroundCheckConsent != null || app.dataPrivacyConsent != null) && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Declarations & Consents</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {([
                { label: "Declaration (true & correct)", value: app.declarationAgreed },
                { label: "Background Check Consent", value: app.backgroundCheckConsent },
                { label: "Data Privacy Consent", value: app.dataPrivacyConsent },
                { label: "Conflict of Interest", value: app.conflictOfInterest },
                { label: "Criminal Record Declared", value: app.criminalRecord },
              ] as { label: string; value: boolean | null | undefined }[])
                .filter(item => item.value != null)
                .map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <Badge variant={item.value ? "default" : "destructive"} className="text-xs">
                      {item.value ? "✓ Yes" : "✗ No"}
                    </Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {screeningAnswers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" /> Screening Answers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {screeningAnswers.map((a, i) => (
                <div key={a.id} className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Q{i + 1}. {a.question ?? `Question #${a.questionId}`}</p>
                  <p className="text-sm pl-3 border-l-2 border-muted">{a.answer || <span className="italic text-muted-foreground">No answer provided</span>}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {appDocuments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Submitted Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {appDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-2 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName ?? DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}</p>
                      <p className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs">
                        <ExternalLink className="h-3 w-3" /> Open
                      </Button>
                    </a>
                    {(isAdmin || isHR) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setDocToDelete(doc)}
                        data-testid={`button-delete-document-${doc.id}`}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {docDeletions.length > 0 && (
          <Card data-testid="card-removed-documents">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" /> Removed Documents
                <Badge variant="outline" className="ml-1 text-xs">{docDeletions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                History of documents previously deleted from this application.
              </p>
              {docDeletions.map((entry) => {
                const type = entry.details?.documentType ? String(entry.details.documentType) : null;
                const typeLabel = type ? (DOC_TYPE_LABELS[type] ?? type) : "document";
                const fileName = entry.details?.fileName ? String(entry.details.fileName) : null;
                const reason = entry.details?.reason ? String(entry.details.reason) : null;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 p-2 rounded-md border bg-muted/20"
                    data-testid={`row-removed-document-${entry.id}`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <Trash2 className="h-4 w-4 text-destructive/70 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {fileName ?? typeLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabel}
                          {" · Deleted by "}
                          <span className="font-medium">{entry.performedByEmail ?? "unknown user"}</span>
                        </p>
                        {reason && (
                          <p
                            className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words"
                            data-testid={`text-removed-document-reason-${entry.id}`}
                          >
                            <span className="font-medium text-foreground">Reason:</span> {reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(entry.createdAt).toLocaleString()}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <AlertDialog open={docToDelete != null} onOpenChange={(open) => { if (!open && !deletingDoc) { setDocToDelete(null); setDeleteReason(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this document?</AlertDialogTitle>
              <AlertDialogDescription>
                {docToDelete?.fileName ?? DOC_TYPE_LABELS[docToDelete?.documentType ?? ""] ?? docToDelete?.documentType}
                {" "}will be permanently removed from this application. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="delete-document-reason" className="text-sm font-medium">
                Reason <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                id="delete-document-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. wrong file uploaded, candidate requested removal under data privacy"
                rows={3}
                maxLength={1000}
                disabled={deletingDoc}
                data-testid="input-delete-document-reason"
              />
              <p className="text-xs text-muted-foreground">
                Saved alongside the deletion entry in Removed Documents for audit review.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingDoc}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void handleDeleteDocument(deleteReason); }}
                disabled={deletingDoc || !deleteReason.trim()}
                data-testid="button-confirm-delete-document"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingDoc ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Deleting...</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={resendConfirm != null} onOpenChange={(open) => { if (!open && !sendOfferLoading) setResendConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resend offer letter?</AlertDialogTitle>
              <AlertDialogDescription data-testid="text-resend-confirm-description">
                {(() => {
                  const h = resendConfirm?.hours ?? 0;
                  const phrase = h < 1
                    ? `less than an hour ago`
                    : `${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"} ago`;
                  return `This offer was just sent ${phrase}. Resending will email the candidate again. Resend anyway?`;
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sendOfferLoading} data-testid="button-cancel-resend-offer">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  const onSuccess = resendConfirm?.onSuccess;
                  void sendOfferLetterEmail().then((ok) => {
                    if (ok) {
                      setResendConfirm(null);
                      onSuccess?.();
                    }
                  });
                }}
                disabled={sendOfferLoading}
                data-testid="button-confirm-resend-offer"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sendOfferLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</> : "Resend anyway"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={confirmSendOffer}
          onOpenChange={(open) => { if (!open && !sendOfferLoading) setConfirmSendOffer(false); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this offer letter?</AlertDialogTitle>
              <AlertDialogDescription>
                {candidate?.email
                  ? <>This will email the offer letter to <span className="font-medium text-foreground">{candidate?.name ?? "the candidate"}</span> at <span className="font-medium text-foreground" data-testid="text-confirm-send-offer-email">{candidate.email}</span>.</>
                  : <>No email address is on file for {candidate?.name ?? "this candidate"}, so the offer letter can't be sent.</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sendOfferLoading} data-testid="button-confirm-send-offer-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={sendOfferLoading || !candidate?.email}
                onClick={async (e) => {
                  e.preventDefault();
                  const ok = await sendOfferLetterEmail();
                  if (ok) {
                    setConfirmSendOffer(false);
                    setShowOfferPreview(false);
                  }
                }}
                data-testid="button-confirm-send-offer-confirm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sendOfferLoading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</>
                  : <>Send offer letter</>}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {app.status === "hired" && canUpdateStatus && (
          <Card data-testid="card-signed-contract">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" /> Upload Signed Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload the physically signed offer letter or contract to complete the document lifecycle.
              </p>
              {appDocuments.filter(d => d.documentType === "signed_contract").length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>{appDocuments.filter(d => d.documentType === "signed_contract").length} signed contract(s) already on file</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={contractFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleContractUpload}
                  className="hidden"
                  id="contract-upload-input"
                  data-testid="input-contract-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={contractUploading}
                  onClick={() => contractFileRef.current?.click()}
                  data-testid="button-upload-contract"
                >
                  {contractUploading
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading...</>
                    : <><Upload className="h-3.5 w-3.5 mr-1.5" />Choose File</>
                  }
                </Button>
                <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG accepted</span>
              </div>
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
      {appId && (
        <PdfPreviewDialog
          open={showOfferPreview}
          onOpenChange={setShowOfferPreview}
          url={`/api/pdf/offer-letter/${appId}`}
          title={`Offer Letter — Application #${appId}`}
          downloadFilename={`offer-letter-${appId}.pdf`}
          footerActions={
            <Button
              size="sm"
              onClick={() => requestSendOfferLetter(() => setShowOfferPreview(false))}
              disabled={sendOfferLoading}
              data-testid="button-send-offer-letter-from-preview"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sendOfferLoading
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</>
                : <><Mail className="h-3.5 w-3.5 mr-1.5" />Send to Candidate</>
              }
            </Button>
          }
        />
      )}
      <AlertDialog
        open={confirmSendOffer}
        onOpenChange={(open) => { if (!open && !sendOfferLoading) setConfirmSendOffer(false); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this offer letter?</AlertDialogTitle>
            <AlertDialogDescription>
              {candidate?.email
                ? <>This will email the offer letter to <span className="font-medium text-foreground">{candidate?.name ?? "the candidate"}</span> at <span className="font-medium text-foreground" data-testid="text-confirm-send-offer-email">{candidate.email}</span>.</>
                : <>No email address is on file for {candidate?.name ?? "this candidate"}, so the offer letter can't be sent.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendOfferLoading} data-testid="button-confirm-send-offer-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sendOfferLoading || !candidate?.email}
              onClick={async (e) => {
                e.preventDefault();
                const ok = await sendOfferLetterEmail();
                if (ok) {
                  setConfirmSendOffer(false);
                  setShowOfferPreview(false);
                }
              }}
              data-testid="button-confirm-send-offer-confirm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sendOfferLoading
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</>
                : <>Send offer letter</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
