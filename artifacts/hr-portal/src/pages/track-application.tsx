import { useState } from "react";
import { Link } from "wouter";
import { Search, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  applied: "Application Received",
  screening: "Under Screening",
  interview: "Interview Stage",
  offer: "Offer Extended",
  hired: "Hired",
  rejected: "Unsuccessful",
  withdrawn: "Withdrawn",
};

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700 border-blue-200",
  screening: "bg-yellow-100 text-yellow-700 border-yellow-200",
  interview: "bg-purple-100 text-purple-700 border-purple-200",
  offer: "bg-green-100 text-green-700 border-green-200",
  hired: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  withdrawn: "bg-gray-100 text-gray-600 border-gray-200",
};

type TrackResult = {
  id: number;
  status: string;
  submittedAt: string;
  jobTitle: string;
  jobLocation: string | null;
};

export default function TrackApplicationPage() {
  const [email, setEmail] = useState("");
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const cleanRef = ref.replace(/^REF-0*/i, "");

    try {
      const res = await fetch(
        `${baseUrl}/api/applications/track?email=${encodeURIComponent(email)}&ref=${encodeURIComponent(cleanRef)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No application found with those details.");
      } else {
        setResult(await res.json());
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-background border-b border-border px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-16 pb-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Track Application</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email and reference number to check your application status.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Lookup</CardTitle>
              <CardDescription>
                Your reference number was displayed after submitting your application (e.g. REF-000012).
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
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-track-submit">
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? "Searching..." : "Check Status"}
                </Button>
              </form>

              {error && (
                <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" data-testid="track-error">
                  {error}
                </div>
              )}

              {result && (
                <div className="mt-4 rounded-lg border p-4 space-y-3" data-testid="track-result">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{result.jobTitle}</p>
                      {result.jobLocation && <p className="text-xs text-muted-foreground">{result.jobLocation}</p>}
                    </div>
                    <Badge className={`${STATUS_COLORS[result.status] ?? ""} border`} variant="outline">
                      {STATUS_LABELS[result.status] ?? result.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Submitted: {new Date(result.submittedAt).toLocaleDateString("en-PG", { year: "numeric", month: "long", day: "numeric" })}
                    <span className="ml-3">Ref: REF-{String(result.id).padStart(6, "0")}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
