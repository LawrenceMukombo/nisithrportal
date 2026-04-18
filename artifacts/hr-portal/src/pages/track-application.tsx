import { useState } from "react";
import { Link } from "wouter";
import { Search, ArrowLeft, Clock, CheckCircle2, Circle, XCircle, AlertCircle } from "lucide-react";
import { useTrackApplication, getTrackApplicationQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WORKFLOW_STAGES,
  STAGE_COLOR_MAP,
  TERMINAL_STATUSES,
  getActiveStageIndex,
  isStageComplete,
  isStageCurrent,
} from "@/lib/workflowStages";

const STATUS_LABELS: Record<string, string> = {
  applied: "Application Received",
  screening: "Under Screening",
  interview: "Interview Stage",
  offer: "Offer Extended",
  hired: "Hired",
  onboarding: "Onboarding",
  rejected: "Unsuccessful",
  withdrawn: "Withdrawn",
};

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700 border-blue-200",
  screening: "bg-yellow-100 text-yellow-700 border-yellow-200",
  interview: "bg-purple-100 text-purple-700 border-purple-200",
  offer: "bg-green-100 text-green-700 border-green-200",
  hired: "bg-teal-100 text-teal-700 border-teal-200",
  onboarding: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  withdrawn: "bg-gray-100 text-gray-600 border-gray-200",
};

function ApplicationTimeline({ status }: { status: string }) {
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const activeIndex = getActiveStageIndex(status);

  if (isTerminal) {
    return (
      <div className="mt-5 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          {status === "rejected" ? (
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {status === "rejected" ? "Application Unsuccessful" : "Application Withdrawn"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "rejected"
                ? "Thank you for applying. Unfortunately your application was not successful at this time."
                : "This application has been withdrawn from the recruitment process."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Your journey — Step {activeIndex + 1} of {WORKFLOW_STAGES.length}
      </p>
      <div className="relative">
        {WORKFLOW_STAGES.map((stage, i) => {
          const complete = isStageComplete(i, activeIndex);
          const current = isStageCurrent(i, activeIndex);
          const future = !complete && !current;
          const colors = STAGE_COLOR_MAP[stage.color];
          const Icon = stage.icon;

          return (
            <div key={stage.id} className="flex gap-3 relative">
              <div className="flex flex-col items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 transition-all ${
                    complete
                      ? "bg-primary border-primary"
                      : current
                      ? `${colors.bg} ${colors.border} ring-2 ${colors.ring}`
                      : "bg-background border-border"
                  }`}
                >
                  {complete ? (
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                  ) : current ? (
                    <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </div>
                {i < WORKFLOW_STAGES.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[2rem] my-0.5 ${complete ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
              <div className={`pb-4 flex-1 ${i === WORKFLOW_STAGES.length - 1 ? "pb-0" : ""}`}>
                <div className="flex items-center gap-2 pt-1">
                  <p
                    className={`text-sm font-medium ${
                      complete ? "text-foreground" : current ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </p>
                  {current && (
                    <Badge className={`text-xs px-1.5 py-0 ${colors.bg} ${colors.text} border ${colors.border}`} variant="outline">
                      Current
                    </Badge>
                  )}
                </div>
                {(current || future) && (
                  <p className={`text-xs mt-0.5 ${current ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    {stage.description}
                  </p>
                )}
                {current && (
                  <p className={`text-xs mt-1 font-medium ${colors.text}`}>
                    Expected: {stage.timeframe}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackApplicationPage() {
  const [email, setEmail] = useState("");
  const [ref, setRef] = useState("");
  const [submittedParams, setSubmittedParams] = useState<{ email: string; ref: string } | null>(null);

  const cleanRef = (r: string) => r.replace(/^REF-0*/i, "") || r;

  const trackParams = {
    email: submittedParams?.email ?? "",
    ref: cleanRef(submittedParams?.ref ?? ""),
  };

  const trackQuery = useTrackApplication(trackParams, {
    query: {
      enabled: !!submittedParams,
      retry: false,
      queryKey: getTrackApplicationQueryKey(submittedParams ? trackParams : undefined),
    },
  });

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedParams({ email, ref });
  };

  const isLoading = trackQuery.isLoading && !!submittedParams;
  const result = trackQuery.data;
  const queryError = trackQuery.error as { message?: string; response?: { data?: { error?: string } } } | null;
  const errorMessage = queryError
    ? (queryError.response?.data?.error ?? queryError.message ?? "Application not found. Please check your email and reference number.")
    : null;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-background border-b border-border px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-12 pb-12">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Track Your Application</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email and reference number to check your application status.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Lookup</CardTitle>
              <CardDescription>
                Your reference number was shown after submitting your application (e.g. REF-000012).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTrack} className="space-y-4" data-testid="form-track">
                <div className="space-y-1.5">
                  <Label htmlFor="track-email">Email Address</Label>
                  <Input
                    id="track-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-track-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="track-ref">Reference Number</Label>
                  <Input
                    id="track-ref"
                    required
                    placeholder="REF-000012 or 12"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    data-testid="input-track-ref"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-track-submit">
                  <Search className="h-4 w-4 mr-2" />
                  {isLoading ? "Searching..." : "Check Status"}
                </Button>
              </form>

              {isLoading && (
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              )}

              {!isLoading && submittedParams && errorMessage && (
                <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" data-testid="track-error">
                  {errorMessage}
                </div>
              )}

              {!isLoading && result && (
                <div className="mt-4" data-testid="track-result">
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{result.jobTitle}</p>
                        {result.jobLocation && (
                          <p className="text-xs text-muted-foreground">{result.jobLocation}</p>
                        )}
                      </div>
                      <Badge className={`${STATUS_COLORS[result.status] ?? ""} border`} variant="outline">
                        {STATUS_LABELS[result.status] ?? result.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      Submitted:{" "}
                      {new Date(result.submittedAt).toLocaleDateString("en-PG", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      <span className="ml-3">Ref: REF-{String(result.id).padStart(6, "0")}</span>
                    </div>
                  </div>

                  <ApplicationTimeline status={result.status} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
