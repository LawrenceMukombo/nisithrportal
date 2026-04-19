import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface StageRow {
  status: string;
  label: string;
  description: string;
}

const STAGE_ROWS: StageRow[] = [
  { status: "applied",    label: "Application Received",  description: "Days before an unreviewed application is flagged as stalled." },
  { status: "screening",  label: "CV Screening",          description: "Days before a candidate sitting in screening/assessment is flagged." },
  { status: "interview",  label: "Interview / Evaluation", description: "Days before a candidate in interview or evaluation is flagged." },
  { status: "offer",      label: "Offer Extended",        description: "Days before an outstanding offer is flagged as stalled." },
  { status: "hired",      label: "Background Check",      description: "Days before a background-check step is flagged as stalled." },
  { status: "onboarding", label: "Onboarding",            description: "Days before an onboarding record is flagged as stalled." },
];

const DEFAULT_THRESHOLDS: Record<string, number> = {
  applied: 3, screening: 7, interview: 10, offer: 5, hired: 7, onboarding: 14,
};

function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("hr_portal_token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? res.statusText);
    }
    return res.json() as Promise<T>;
  });
}

export default function PipelineSlaSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: savedThresholds, isLoading } = useQuery({
    queryKey: ["stale-thresholds"],
    queryFn: () => apiFetch<Record<string, number>>("/api/agencies/settings/stale-thresholds"),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [initialised, setInitialised] = useState(false);

  if (savedThresholds && !initialised) {
    const init: Record<string, string> = {};
    STAGE_ROWS.forEach((r) => {
      init[r.status] = String(savedThresholds[r.status] ?? DEFAULT_THRESHOLDS[r.status] ?? 7);
    });
    setValues(init);
    setInitialised(true);
  }

  const saveMutation = useMutation({
    mutationFn: (thresholds: Record<string, number>) =>
      apiFetch("/api/agencies/settings/stale-thresholds", {
        method: "PUT",
        body: JSON.stringify(thresholds),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stale-thresholds"] });
      toast({ title: "Thresholds saved" });
    },
    onError: (e) => toast({ title: `Failed to save: ${(e as Error).message}`, variant: "destructive" }),
  });

  const handleSave = () => {
    const thresholds: Record<string, number> = {};
    for (const r of STAGE_ROWS) {
      const n = parseInt(values[r.status] ?? "");
      if (isNaN(n) || n < 1) {
        toast({ title: `"${r.label}" must be a number ≥ 1`, variant: "destructive" });
        return;
      }
      thresholds[r.status] = n;
    }
    saveMutation.mutate(thresholds);
  };

  const handleReset = () => {
    const init: Record<string, string> = {};
    STAGE_ROWS.forEach((r) => { init[r.status] = String(DEFAULT_THRESHOLDS[r.status]); });
    setValues(init);
  };

  const isDirty = initialised && STAGE_ROWS.some(
    (r) => String(savedThresholds?.[r.status] ?? DEFAULT_THRESHOLDS[r.status]) !== values[r.status]
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Pipeline SLA Settings</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Configure how many days a candidate can sit in each hiring stage before being flagged as stalled.
            Stalled-application alerts are sent to HR officers when a threshold is exceeded.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stalled-application thresholds</CardTitle>
              <CardDescription className="text-xs">
                Enter the maximum number of idle days per stage. The default values follow PNG government HR guidelines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {STAGE_ROWS.map((row, i) => (
                <div key={row.status}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{row.label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
                      {DEFAULT_THRESHOLDS[row.status] !== undefined && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">Default: {DEFAULT_THRESHOLDS[row.status]} days</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        className="w-20 text-right"
                        value={values[row.status] ?? ""}
                        onChange={(e) => setValues(v => ({ ...v, [row.status]: e.target.value }))}
                        data-testid={`input-threshold-${row.status}`}
                      />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
                </div>
              ))}

              <Separator />

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground">
                  Reset to defaults
                </Button>
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" /> Unsaved changes
                    </span>
                  )}
                  {!isDirty && initialised && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Up to date
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saveMutation.isPending || !isDirty}
                    data-testid="button-save-thresholds"
                  >
                    {saveMutation.isPending
                      ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save thresholds
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
