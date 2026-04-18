import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateJob, useUpdateJob, useGetJob, useGetDepartments,
  getGetJobsQueryKey, getGetJobQueryKey, getGetDepartmentsQueryKey,
  usePublishJob,
} from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, HelpCircle, Plus, Trash2, Loader2, ArrowUp, ArrowDown,
  ChevronRight, ChevronLeft, CheckCircle2,
  Send, Save, Briefcase, FileText, GraduationCap, Settings2, Eye,
  ClipboardList,
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useCallback, useRef } from "react";
import type { ScreeningQuestion } from "@/components/apply-wizard";
import { getToken } from "@/lib/api-config";

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────
const PNG_PROVINCES = [
  "National Capital District", "Central", "Gulf", "Western", "Oro (Northern)",
  "Milne Bay", "Morobe", "Madang", "Eastern Highlands", "Western Highlands",
  "Jiwaka", "Chimbu (Simbu)", "Southern Highlands", "Hela", "Enga",
  "Sandaun (West Sepik)", "East Sepik", "Manus", "New Ireland",
  "East New Britain", "West New Britain", "Bougainville (AROB)",
];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "casual", label: "Casual" },
];

const WORK_ARRANGEMENTS = [
  { value: "on_site", label: "On-Site" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

const EDUCATION_LEVELS = [
  "Grade 10 (Form 4)", "Grade 12 (Form 6)", "Certificate III/IV",
  "Diploma", "Advanced Diploma", "Bachelor's Degree",
  "Postgraduate Certificate/Diploma", "Master's Degree", "Doctorate (PhD)",
];

const CURRENCIES = ["PGK", "USD", "AUD"];

const SALARY_VISIBILITY_OPTS = [
  { value: "public", label: "Show salary range publicly" },
  { value: "internal", label: "Show to internal staff only" },
  { value: "hidden", label: "Do not display salary" },
];

const PUBLISH_TARGET_OPTS = [
  { value: "public", label: "Public Portal", description: "Visible to all applicants on the public job board" },
  { value: "internal", label: "Internal Portal", description: "Visible only to staff with an account" },
  { value: "both", label: "Both Portals", description: "Visible on both public and internal portals" },
];

const REQUIRED_DOCS_OPTIONS = [
  "Updated CV / Résumé",
  "Cover Letter",
  "Academic Certificates",
  "Transcript of Records",
  "National ID / TIN Card",
  "Birth Certificate",
  "Valid Passport",
  "Police Clearance Certificate",
  "Medical Certificate",
  "Reference Letters (2)",
  "Professional Registration Certificate",
];

const WIZARD_STEPS = [
  { label: "Basic Info", Icon: Briefcase },
  { label: "Description", Icon: FileText },
  { label: "Requirements", Icon: GraduationCap },
  { label: "Screening", Icon: HelpCircle },
  { label: "Settings", Icon: Settings2 },
  { label: "Review", Icon: Eye },
];

const STEP_REQUIRED_FIELDS: (keyof FormValues)[][] = [
  ["title"],
  [],
  [],
  [],
  [],
  [],
];

// ──────────────────────────────────────────────────────────
// Form schema
// ──────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(2, "Job title is required"),
  referenceNumber: z.string().optional(),
  departmentId: z.coerce.number().optional(),
  country: z.string().optional(),
  province: z.string().optional(),
  officeSite: z.string().optional(),
  employmentType: z.string().optional(),
  workArrangement: z.string().optional(),
  location: z.string().optional(),
  gradeBand: z.string().optional(),
  openingDate: z.string().optional(),
  closingDate: z.string().optional(),
  maxApplicants: z.coerce.number().optional(),
  jobSummary: z.string().optional(),
  description: z.string().optional(),
  reportingLine: z.string().optional(),
  minEducation: z.string().optional(),
  yearsExperience: z.coerce.number().optional(),
  languageRequirements: z.string().optional(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  salaryCurrency: z.string().optional(),
  salaryVisibility: z.string().optional(),
  contractDuration: z.string().optional(),
  isFeatured: z.boolean().optional(),
  publishTarget: z.string().optional(),
  autoExpire: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

// ──────────────────────────────────────────────────────────
// Screening Questions Section
// ──────────────────────────────────────────────────────────
const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  yes_no: "Yes / No",
  multiple_choice: "Multiple Choice",
};
type NewQuestion = { question: string; questionType: string; options: string; required: boolean; isMandatoryFilter: boolean; autoReject: boolean; autoRejectValue: string };

function ScreeningQuestionsSection({ jobId, onQuestionsChange }: { jobId: number; onQuestionsChange?: (qs: ScreeningQuestion[]) => void }) {
  const { toast } = useToast();
  const [questions, setQuestionsState] = useState<ScreeningQuestion[]>([]);
  const setQuestions = (qs: ScreeningQuestion[]) => { setQuestionsState(qs); onQuestionsChange?.(qs); };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newQ, setNewQ] = useState<NewQuestion>({ question: "", questionType: "short_answer", options: "", required: true, isMandatoryFilter: false, autoReject: false, autoRejectValue: "No" });

  const authHeaders = (): Record<string, string> => {
    const token = getToken();
    return token ? { "Authorization": `Bearer ${token}` } : {};
  };

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/screening-questions`, { headers: authHeaders() });
      if (res.ok) setQuestions(await res.json() as ScreeningQuestion[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { void fetchQuestions(); }, [fetchQuestions]);

  const handleAdd = async () => {
    if (!newQ.question.trim()) { toast({ title: "Question text required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const options = newQ.questionType === "multiple_choice"
        ? newQ.options.split(",").map(s => s.trim()).filter(Boolean)
        : undefined;
      const res = await fetch(`/api/jobs/${jobId}/screening-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          question: newQ.question,
          questionType: newQ.questionType,
          options,
          required: newQ.required,
          isMandatoryFilter: newQ.isMandatoryFilter,
          autoReject: newQ.autoReject,
          autoRejectValue: newQ.autoReject ? newQ.autoRejectValue : undefined,
        }),
      });
      if (!res.ok) { toast({ title: "Failed to add question", variant: "destructive" }); return; }
      setNewQ({ question: "", questionType: "short_answer", options: "", required: true, isMandatoryFilter: false, autoReject: false, autoRejectValue: "No" });
      await fetchQuestions();
      toast({ title: "Screening question added" });
    } catch { toast({ title: "Failed to add question", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (qid: number) => {
    setDeletingId(qid);
    try {
      await fetch(`/api/jobs/${jobId}/screening-questions/${qid}`, { method: "DELETE", headers: authHeaders() });
      await fetchQuestions();
      toast({ title: "Question removed" });
    } catch { toast({ title: "Failed to remove question", variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  const handleReorder = async (qid: number, direction: "up" | "down") => {
    const idx = questions.findIndex(q => q.id === qid);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const reordered = [...questions];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    setQuestions(reordered);
    try {
      await fetch(`/api/jobs/${jobId}/screening-questions/${qid}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ direction }),
      });
    } catch {
      await fetchQuestions();
      toast({ title: "Failed to reorder questions", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{questions.length} question{questions.length !== 1 ? "s" : ""}</Badge>
        <p className="text-xs text-muted-foreground">Candidates must answer these when applying.</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No screening questions yet.</p>
          )}
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
                <span className="text-xs text-muted-foreground font-mono w-5 flex-shrink-0 mt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{q.question}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs">{QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType}</Badge>
                    {q.required && <Badge variant="outline" className="text-xs text-red-600">Required</Badge>}
                    {(q as typeof q & { isMandatoryFilter?: boolean }).isMandatoryFilter && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">Filter Question</Badge>
                    )}
                    {(q as typeof q & { autoReject?: boolean; autoRejectValue?: string }).autoReject && (
                      <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50">
                        Auto-Reject if: {(q as typeof q & { autoRejectValue?: string }).autoRejectValue ?? "No"}
                      </Badge>
                    )}
                  </div>
                  {q.options && Array.isArray(q.options) && (q.options as string[]).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Options: {(q.options as string[]).join(", ")}</p>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleReorder(q.id, "up")} disabled={i === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleReorder(q.id, "down")} disabled={i === questions.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <Button type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2 flex-shrink-0" onClick={() => handleDelete(q.id)} disabled={deletingId === q.id}>
                  {deletingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">Add Question</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Question Text</label>
              <Input
                placeholder="e.g. Do you hold a valid PNG driver's licence?"
                value={newQ.question}
                onChange={e => setNewQ(p => ({ ...p, question: e.target.value }))}
                data-testid="input-screening-question"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <Select value={newQ.questionType} onValueChange={v => setNewQ(p => ({ ...p, questionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                    <SelectItem value="long_answer">Long Answer</SelectItem>
                    <SelectItem value="yes_no">Yes / No</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Required?</label>
                <Select value={newQ.required ? "yes" : "no"} onValueChange={v => setNewQ(p => ({ ...p, required: v === "yes" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Required</SelectItem>
                    <SelectItem value="no">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newQ.questionType === "multiple_choice" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Options (comma separated)</label>
                <Input placeholder="Option A, Option B, Option C" value={newQ.options} onChange={e => setNewQ(p => ({ ...p, options: e.target.value }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <p className="text-xs font-medium">Mandatory Filter</p>
                  <p className="text-xs text-muted-foreground">Used to pre-screen candidates</p>
                </div>
                <Switch checked={newQ.isMandatoryFilter} onCheckedChange={v => setNewQ(p => ({ ...p, isMandatoryFilter: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <p className="text-xs font-medium">Auto-Reject</p>
                  <p className="text-xs text-muted-foreground">Reject if specific answer given</p>
                </div>
                <Switch
                  checked={newQ.autoReject}
                  disabled={newQ.questionType !== "yes_no" && newQ.questionType !== "multiple_choice"}
                  onCheckedChange={v => setNewQ(p => ({ ...p, autoReject: v }))}
                />
              </div>
            </div>
            {newQ.autoReject && (newQ.questionType === "yes_no" || newQ.questionType === "multiple_choice") && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Auto-reject if answer is</label>
                {newQ.questionType === "yes_no" ? (
                  <Select value={newQ.autoRejectValue} onValueChange={v => setNewQ(p => ({ ...p, autoRejectValue: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className="h-8 text-xs" placeholder="Enter the reject-trigger answer" value={newQ.autoRejectValue} onChange={e => setNewQ(p => ({ ...p, autoRejectValue: e.target.value }))} />
                )}
              </div>
            )}
            <Button type="button" size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Add Question
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Tag Input
// ──────────────────────────────────────────────────────────
function TagInput({ values, onChange, placeholder, label, testId }: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  label?: string;
  testId?: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setInput("");
  };
  const remove = (v: string) => onChange(values.filter(x => x !== v));
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium block">{label}</label>}
      <div className="flex gap-2">
        <Input
          value={input}
          placeholder={placeholder}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          data-testid={testId}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button type="button" onClick={() => remove(v)} className="ml-0.5 hover:text-destructive rounded">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Step Indicator
// ──────────────────────────────────────────────────────────
function StepIndicator({ currentStep, onStepClick }: { currentStep: number; onStepClick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {WIZARD_STEPS.map((s, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const Icon = s.Icon;
        return (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepClick(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                active ? "bg-primary text-primary-foreground" :
                done ? "text-primary hover:bg-primary/10" :
                "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {done
                ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                : <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              }
              {s.label}
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 mx-0.5 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Review helpers
// ──────────────────────────────────────────────────────────
function ReviewSection({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pb-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <button type="button" onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
      </div>
      <div className="space-y-1 text-sm pl-1">{children}</div>
      <Separator className="mt-3" />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[9rem] shrink-0">{label}:</span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────
export default function JobFormPage() {
  const [matchNew] = useRoute("/jobs/new");
  const [matchEdit, paramsEdit] = useRoute("/jobs/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!matchEdit;
  const jobId = isEdit ? parseInt(paramsEdit!.id) : 0;
  const pendingPublishId = useRef<number>(0);

  const initialStep = (() => {
    if (typeof window !== "undefined") {
      const s = new URLSearchParams(window.location.search).get("step");
      if (s) { const n = parseInt(s); if (!isNaN(n) && n >= 0 && n < 6) return n; }
    }
    return 0;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [reviewScreeningQuestions, setReviewScreeningQuestions] = useState<ScreeningQuestion[]>([]);
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [technicalSkills, setTechnicalSkills] = useState<string[]>([]);
  const [softSkills, setSoftSkills] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [customDocInput, setCustomDocInput] = useState("");

  const { data: departments } = useGetDepartments(undefined, { query: { queryKey: getGetDepartmentsQueryKey() } });
  const { data: existingJob } = useGetJob(jobId, {
    query: { enabled: isEdit && !!jobId, queryKey: getGetJobQueryKey(jobId) },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", referenceNumber: "", departmentId: undefined,
      country: "Papua New Guinea", province: "", officeSite: "",
      employmentType: "", workArrangement: "", location: "",
      gradeBand: "", openingDate: "", closingDate: "",
      maxApplicants: undefined, jobSummary: "", description: "",
      reportingLine: "", minEducation: "", yearsExperience: undefined,
      languageRequirements: "", salaryMin: undefined, salaryMax: undefined,
      salaryCurrency: "PGK", salaryVisibility: "public",
      contractDuration: "", isFeatured: false,
      publishTarget: "public", autoExpire: false,
    },
  });

  const populatedRef = useRef(false);

  useEffect(() => {
    if (existingJob && !populatedRef.current) {
      populatedRef.current = true;
      type ExtJob = typeof existingJob & {
        referenceNumber?: string | null; country?: string | null; province?: string | null;
        officeSite?: string | null; location?: string | null; employmentType?: string | null;
        workArrangement?: string | null; jobSummary?: string | null; responsibilities?: string[] | null;
        reportingLine?: string | null; minEducation?: string | null; yearsExperience?: number | null;
        technicalSkills?: string[] | null; softSkills?: string[] | null; certifications?: string[] | null;
        languageRequirements?: string | null; salaryMin?: number | null; salaryMax?: number | null;
        salaryCurrency?: string | null; salaryVisibility?: string | null; gradeBand?: string | null;
        contractDuration?: string | null; openingDate?: string | null;
        requiredDocuments?: string[] | null; maxApplicants?: number | null; isFeatured?: boolean | null;
        publishTarget?: string | null; autoExpire?: boolean | null;
      };
      const j = existingJob as ExtJob;
      form.reset({
        title: j.title,
        departmentId: j.departmentId ?? undefined,
        description: j.description ?? "",
        closingDate: j.closingDate ? j.closingDate.slice(0, 10) : "",
        referenceNumber: j.referenceNumber ?? "",
        country: j.country ?? "Papua New Guinea",
        province: j.province ?? j.location ?? "",
        officeSite: j.officeSite ?? "",
        location: j.location ?? "",
        employmentType: j.employmentType ?? "",
        workArrangement: j.workArrangement ?? "",
        jobSummary: j.jobSummary ?? "",
        reportingLine: j.reportingLine ?? "",
        minEducation: j.minEducation ?? "",
        yearsExperience: j.yearsExperience ?? undefined,
        languageRequirements: j.languageRequirements ?? "",
        salaryMin: j.salaryMin ?? undefined,
        salaryMax: j.salaryMax ?? undefined,
        salaryCurrency: j.salaryCurrency ?? "PGK",
        salaryVisibility: j.salaryVisibility ?? "public",
        gradeBand: j.gradeBand ?? "",
        contractDuration: j.contractDuration ?? "",
        openingDate: j.openingDate ? j.openingDate.slice(0, 10) : "",
        maxApplicants: j.maxApplicants ?? undefined,
        isFeatured: j.isFeatured ?? false,
        publishTarget: j.publishTarget ?? "public",
        autoExpire: j.autoExpire ?? false,
      });
      if (j.responsibilities) setResponsibilities(j.responsibilities);
      if (j.technicalSkills) setTechnicalSkills(j.technicalSkills);
      if (j.softSkills) setSoftSkills(j.softSkills);
      if (j.certifications) setCertifications(j.certifications);
      if (j.requiredDocuments) setRequiredDocuments(j.requiredDocuments);
    }
  }, [existingJob, form]);

  const buildPayload = (values: FormValues) => ({
    title: values.title,
    description: values.description || " ",
    departmentId: values.departmentId ?? null,
    closingDate: values.closingDate || null,
    referenceNumber: values.referenceNumber || null,
    country: values.country || null,
    province: values.province || null,
    officeSite: values.officeSite || null,
    location: values.province || values.location || null,
    publishTarget: values.publishTarget || "public",
    autoExpire: values.autoExpire ?? false,
    employmentType: values.employmentType || null,
    workArrangement: values.workArrangement || null,
    jobSummary: values.jobSummary || null,
    responsibilities: responsibilities.length > 0 ? responsibilities : null,
    reportingLine: values.reportingLine || null,
    minEducation: values.minEducation || null,
    yearsExperience: values.yearsExperience ?? null,
    technicalSkills: technicalSkills.length > 0 ? technicalSkills : null,
    softSkills: softSkills.length > 0 ? softSkills : null,
    certifications: certifications.length > 0 ? certifications : null,
    languageRequirements: values.languageRequirements || null,
    salaryMin: values.salaryMin ?? null,
    salaryMax: values.salaryMax ?? null,
    salaryCurrency: values.salaryCurrency || null,
    salaryVisibility: values.salaryVisibility || null,
    gradeBand: values.gradeBand || null,
    contractDuration: values.contractDuration || null,
    openingDate: values.openingDate || null,
    requiredDocuments: requiredDocuments.length > 0 ? requiredDocuments : null,
    maxApplicants: values.maxApplicants ?? null,
    isFeatured: values.isFeatured ?? false,
  });

  const createJob = useCreateJob({
    mutation: {
      onError: () => toast({ title: "Failed to save job", variant: "destructive" }),
    },
  });

  const updateJob = useUpdateJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      },
      onError: () => toast({ title: "Failed to update job", variant: "destructive" }),
    },
  });

  const publishMutation = usePublishJob({
    mutation: {
      onSuccess: () => {
        const publishedId = pendingPublishId.current || jobId;
        queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(publishedId) });
        toast({ title: "Job published successfully" });
        setLocation(`/jobs/${publishedId}`);
      },
      onError: () => toast({ title: "Failed to publish job", variant: "destructive" }),
    },
  });

  const isPending = createJob.isPending || updateJob.isPending || publishMutation.isPending;

  const goToStep = async (target: number) => {
    if (target > currentStep) {
      const required = STEP_REQUIRED_FIELDS[currentStep] ?? [];
      if (required.length > 0) {
        const ok = await form.trigger(required);
        if (!ok) return;
      }
    }
    setCurrentStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveDraft = async (values: FormValues) => {
    const payload = buildPayload(values);
    if (isEdit) {
      await updateJob.mutateAsync({ id: jobId, data: payload });
      toast({ title: "Job saved" });
    } else {
      const created = await createJob.mutateAsync({ data: { ...payload, status: "draft" } });
      queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
      toast({ title: "Job saved as draft" });
      setLocation(`/jobs/${created.id}/edit?step=3`);
    }
  };

  const handleSaveAndPublish = async (values: FormValues) => {
    const payload = buildPayload(values);
    if (isEdit) {
      await updateJob.mutateAsync({ id: jobId, data: payload });
      pendingPublishId.current = jobId;
      publishMutation.mutate({ id: jobId });
    } else {
      const created = await createJob.mutateAsync({ data: { ...payload, status: "draft" } });
      queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
      pendingPublishId.current = created.id;
      publishMutation.mutate({ id: created.id });
    }
  };

  const values = form.watch();
  const EMPLOYMENT_LABEL = EMPLOYMENT_TYPES.find(e => e.value === values.employmentType)?.label;
  const ARRANGEMENT_LABEL = WORK_ARRANGEMENTS.find(e => e.value === values.workArrangement)?.label;
  const DEPT_LABEL = departments?.find(d => d.id === values.departmentId)?.name;

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/jobs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs
        </Button>

        <div>
          <h1 className="text-2xl font-bold">{isEdit ? "Edit Job Vacancy" : "Post New Job Vacancy"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit ? `Editing: ${existingJob?.title ?? "..."}` : "Complete each step to post a new vacancy"}
          </p>
        </div>

        {/* Step Progress */}
        <Card className="border-border/60">
          <CardContent className="p-3">
            <StepIndicator currentStep={currentStep} onStepClick={goToStep} />
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={e => e.preventDefault()}>

            {/* ═══ STEP 0: BASIC INFO ═══ */}
            {currentStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-4 w-4 text-primary" /> Basic Information
                  </CardTitle>
                  <CardDescription>Core details about the position</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Senior Analyst, Procurement" data-testid="input-job-title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="referenceNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference Number</FormLabel>
                        <div className="flex gap-1.5">
                          <FormControl><Input placeholder="e.g. NISIT-2026-001" {...field} /></FormControl>
                          <Button
                            type="button" size="sm" variant="outline" className="flex-shrink-0 px-2"
                            onClick={() => {
                              const year = new Date().getFullYear();
                              const rand = Math.floor(100 + Math.random() * 900);
                              field.onChange(`NISIT-${year}-${rand}`);
                            }}
                          >
                            Auto
                          </Button>
                        </div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="gradeBand" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade / Band</FormLabel>
                        <FormControl><Input placeholder="e.g. Grade 12, SES Band 1" {...field} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="departmentId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-department">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments?.map((d) => (
                              <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="employmentType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-employment-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EMPLOYMENT_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="workArrangement" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Arrangement</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select arrangement" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WORK_ARRANGEMENTS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="country" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl><Input placeholder="Papua New Guinea" {...field} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="province" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-location">
                              <SelectValue placeholder="Select province" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper">
                            {PNG_PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="officeSite" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Office / Site</FormLabel>
                        <FormControl><Input placeholder="e.g. NISIT Head Office, Waigani" {...field} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="contractDuration" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Duration</FormLabel>
                        <FormControl><Input placeholder="e.g. 2 years, Ongoing" {...field} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="openingDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="closingDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Closing Date</FormLabel>
                        <FormControl><Input type="date" data-testid="input-closing-date" {...field} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="maxApplicants" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Applicants</FormLabel>
                        <FormControl>
                          <Input
                            type="number" placeholder="Leave blank for unlimited"
                            {...field}
                            onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ═══ STEP 1: DESCRIPTION ═══ */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-4 w-4 text-primary" /> Job Description
                  </CardTitle>
                  <CardDescription>Describe the role, responsibilities and context</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <FormField control={form.control} name="jobSummary" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Summary</FormLabel>
                      <FormControl>
                        <Textarea placeholder="A concise overview of the position and its purpose in the organisation..." rows={3} {...field} />
                      </FormControl>
                    </FormItem>
                  )} />

                  <TagInput
                    values={responsibilities}
                    onChange={setResponsibilities}
                    label="Key Responsibilities"
                    placeholder="Type a responsibility and press Enter"
                    testId="input-responsibility"
                  />

                  <FormField control={form.control} name="reportingLine" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reporting Line</FormLabel>
                      <FormControl><Input placeholder="e.g. Reports to the Director of Operations" {...field} /></FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Description / Additional Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional information about the role, context, or special conditions..."
                          rows={5}
                          data-testid="input-description"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ═══ STEP 2: REQUIREMENTS ═══ */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-4 w-4 text-primary" /> Requirements
                  </CardTitle>
                  <CardDescription>Qualifications, skills and experience required</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="minEducation" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Education</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-min-education">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EDUCATION_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="yearsExperience" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of Experience</FormLabel>
                        <FormControl>
                          <Input
                            type="number" placeholder="e.g. 3"
                            {...field}
                            onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <TagInput
                    values={technicalSkills}
                    onChange={setTechnicalSkills}
                    label="Technical Skills"
                    placeholder="e.g. SAP, Project Management, Python — press Enter to add"
                    testId="input-technical-skill"
                  />

                  <TagInput
                    values={softSkills}
                    onChange={setSoftSkills}
                    label="Soft Skills"
                    placeholder="e.g. Leadership, Communication — press Enter to add"
                    testId="input-soft-skill"
                  />

                  <TagInput
                    values={certifications}
                    onChange={setCertifications}
                    label="Certifications / Licences"
                    placeholder="e.g. PNG Drivers Licence, CPA — press Enter to add"
                    testId="input-certification"
                  />

                  <FormField control={form.control} name="languageRequirements" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language Requirements</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. English (required), Tok Pisin (preferred)" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ═══ STEP 3: SCREENING QUESTIONS ═══ */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <HelpCircle className="h-4 w-4 text-primary" /> Screening Questions
                  </CardTitle>
                  <CardDescription>Custom questions candidates must answer when applying</CardDescription>
                </CardHeader>
                <CardContent>
                  {isEdit && jobId > 0 ? (
                    <ScreeningQuestionsSection jobId={jobId} onQuestionsChange={setReviewScreeningQuestions} />
                  ) : (
                    <div className="py-10 text-center space-y-3">
                      <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="font-medium">Save your job first to add screening questions</p>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Screening questions are tied to a specific posting. Save this job as a draft first, then you can configure screening questions.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={form.handleSubmit(handleSaveDraft)}
                        data-testid="button-save-draft-screening"
                      >
                        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save as Draft & Continue
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ═══ STEP 4: SETTINGS ═══ */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-4 w-4 text-primary" /> Settings
                  </CardTitle>
                  <CardDescription>Salary, required documents and publishing options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Salary</p>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="salaryCurrency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="salaryMin" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Salary</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="40000"
                              {...field}
                              onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="salaryMax" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Salary</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="70000"
                              {...field}
                              onChange={e => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="salaryVisibility" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary Visibility</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {SALARY_VISIBILITY_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Required Documents</p>
                    <p className="text-xs text-muted-foreground">Select or add documents applicants must submit with their application.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {REQUIRED_DOCS_OPTIONS.map(doc => (
                        <div key={doc} className="flex items-center gap-2">
                          <Checkbox
                            id={`doc-${doc}`}
                            checked={requiredDocuments.includes(doc)}
                            onCheckedChange={(checked) =>
                              setRequiredDocuments(prev =>
                                checked ? [...prev, doc] : prev.filter(d => d !== doc)
                              )
                            }
                          />
                          <Label htmlFor={`doc-${doc}`} className="text-sm font-normal cursor-pointer">{doc}</Label>
                        </div>
                      ))}
                    </div>
                    {requiredDocuments.filter(d => !REQUIRED_DOCS_OPTIONS.includes(d)).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {requiredDocuments.filter(d => !REQUIRED_DOCS_OPTIONS.includes(d)).map(d => (
                          <span key={d} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md">
                            {d}
                            <button type="button" onClick={() => setRequiredDocuments(prev => prev.filter(x => x !== d))} className="text-muted-foreground hover:text-foreground">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Input
                        placeholder="Add custom document requirement…"
                        value={customDocInput}
                        onChange={e => setCustomDocInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = customDocInput.trim();
                            if (trimmed && !requiredDocuments.includes(trimmed)) {
                              setRequiredDocuments(prev => [...prev, trimmed]);
                            }
                            setCustomDocInput("");
                          }
                        }}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const trimmed = customDocInput.trim();
                          if (trimmed && !requiredDocuments.includes(trimmed)) {
                            setRequiredDocuments(prev => [...prev, trimmed]);
                          }
                          setCustomDocInput("");
                        }}
                      >Add</Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Publish Target</p>
                    <p className="text-xs text-muted-foreground">Choose where this vacancy will be visible after publishing.</p>
                    <div className="space-y-2">
                      {PUBLISH_TARGET_OPTS.map(opt => {
                        const currentVal = form.watch("publishTarget");
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => form.setValue("publishTarget", opt.value)}
                            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                              currentVal === opt.value
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              currentVal === opt.value ? "border-primary" : "border-muted-foreground/40"
                            }`}>
                              {currentVal === opt.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <FormField control={form.control} name="isFeatured" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base cursor-pointer">Featured Vacancy</FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Featured jobs are highlighted on the public job board
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="autoExpire" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base cursor-pointer">Auto-Expire on Close</FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Automatically close this vacancy on the closing date
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ═══ STEP 5: REVIEW & PUBLISH ═══ */}
            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="h-4 w-4 text-primary" /> Review & Publish
                  </CardTitle>
                  <CardDescription>Review the details before saving or publishing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ReviewSection label="Basic Information" onEdit={() => setCurrentStep(0)}>
                    <ReviewRow label="Job Title" value={values.title} />
                    <ReviewRow label="Reference No." value={values.referenceNumber} />
                    <ReviewRow label="Department" value={DEPT_LABEL} />
                    <ReviewRow label="Employment Type" value={EMPLOYMENT_LABEL} />
                    <ReviewRow label="Work Arrangement" value={ARRANGEMENT_LABEL} />
                    <ReviewRow label="Country" value={values.country} />
                    <ReviewRow label="Province" value={values.province} />
                    <ReviewRow label="Office / Site" value={values.officeSite} />
                    <ReviewRow label="Grade / Band" value={values.gradeBand} />
                    <ReviewRow label="Opening Date" value={values.openingDate} />
                    <ReviewRow label="Closing Date" value={values.closingDate} />
                    <ReviewRow label="Max Applicants" value={values.maxApplicants} />
                    <ReviewRow label="Contract Duration" value={values.contractDuration} />
                  </ReviewSection>

                  <ReviewSection label="Description" onEdit={() => setCurrentStep(1)}>
                    <ReviewRow
                      label="Job Summary"
                      value={values.jobSummary ? values.jobSummary.slice(0, 100) + (values.jobSummary.length > 100 ? "…" : "") : undefined}
                    />
                    <ReviewRow label="Responsibilities" value={responsibilities.length > 0 ? `${responsibilities.length} item(s)` : undefined} />
                    <ReviewRow label="Reporting Line" value={values.reportingLine} />
                  </ReviewSection>

                  <ReviewSection label="Requirements" onEdit={() => setCurrentStep(2)}>
                    <ReviewRow label="Min. Education" value={values.minEducation} />
                    <ReviewRow label="Experience" value={values.yearsExperience ? `${values.yearsExperience} year(s)` : undefined} />
                    <ReviewRow label="Technical Skills" value={technicalSkills.length > 0 ? technicalSkills.join(", ") : undefined} />
                    <ReviewRow label="Soft Skills" value={softSkills.length > 0 ? softSkills.join(", ") : undefined} />
                    <ReviewRow label="Certifications" value={certifications.length > 0 ? certifications.join(", ") : undefined} />
                    <ReviewRow label="Languages" value={values.languageRequirements} />
                  </ReviewSection>

                  <ReviewSection label="Screening Questions" onEdit={() => setCurrentStep(3)}>
                    {reviewScreeningQuestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No screening questions configured</p>
                    ) : (
                      <>
                        <ReviewRow label="Total Questions" value={`${reviewScreeningQuestions.length} question(s)`} />
                        <ReviewRow
                          label="Mandatory Filters"
                          value={reviewScreeningQuestions.filter(q => q.isMandatoryFilter).length > 0
                            ? `${reviewScreeningQuestions.filter(q => q.isMandatoryFilter).length} question(s) with filter`
                            : undefined}
                        />
                        <ReviewRow
                          label="Auto-Reject Rules"
                          value={reviewScreeningQuestions.filter(q => q.autoReject).length > 0
                            ? `${reviewScreeningQuestions.filter(q => q.autoReject).length} auto-reject rule(s)`
                            : undefined}
                        />
                      </>
                    )}
                  </ReviewSection>

                  <ReviewSection label="Settings" onEdit={() => setCurrentStep(4)}>
                    {(values.salaryMin || values.salaryMax) ? (
                      <ReviewRow
                        label="Salary Range"
                        value={`${values.salaryCurrency ?? "PGK"} ${(values.salaryMin ?? 0).toLocaleString()} – ${(values.salaryMax ?? 0).toLocaleString()}`}
                      />
                    ) : null}
                    <ReviewRow label="Salary Visibility" value={SALARY_VISIBILITY_OPTS.find(o => o.value === values.salaryVisibility)?.label} />
                    <ReviewRow label="Required Docs" value={requiredDocuments.length > 0 ? `${requiredDocuments.length} document(s) required` : undefined} />
                    <ReviewRow label="Publish Target" value={PUBLISH_TARGET_OPTS.find(o => o.value === values.publishTarget)?.label} />
                    <ReviewRow label="Featured" value={values.isFeatured ? "Yes" : undefined} />
                    <ReviewRow label="Auto-Expire" value={values.autoExpire ? "Yes — closes automatically on the closing date" : undefined} />
                  </ReviewSection>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={isPending}
                      onClick={form.handleSubmit(handleSaveDraft)}
                      data-testid="button-save-draft"
                    >
                      {isPending && !publishMutation.isPending
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Save className="h-4 w-4 mr-2" />
                      }
                      {isEdit ? "Save Changes" : "Save as Draft"}
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={isPending}
                      onClick={form.handleSubmit(handleSaveAndPublish)}
                      data-testid="button-save-job"
                    >
                      {publishMutation.isPending
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Send className="h-4 w-4 mr-2" />
                      }
                      {isEdit && existingJob?.status === "published"
                        ? "Update & Keep Published"
                        : "Save & Publish Now"
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-5">
              <div>
                {currentStep > 0 && (
                  <Button type="button" variant="outline" onClick={() => goToStep(currentStep - 1)} data-testid="button-prev-step">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEdit && currentStep < 5 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={form.handleSubmit(async (vals) => {
                      const payload = buildPayload(vals);
                      await updateJob.mutateAsync({ id: jobId, data: payload });
                      toast({ title: "Progress saved" });
                    })}
                    data-testid="button-save-progress"
                  >
                    {updateJob.isPending
                      ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      : <Save className="h-3.5 w-3.5 mr-1" />
                    }
                    Save Progress
                  </Button>
                )}
                {currentStep < 5 && (
                  <Button type="button" onClick={() => goToStep(currentStep + 1)} data-testid="button-next-step">
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
