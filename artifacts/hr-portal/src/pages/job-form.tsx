import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateJob, useUpdateJob, useGetJob, useGetDepartments, getGetJobsQueryKey, getGetJobQueryKey, getGetDepartmentsQueryKey } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, HelpCircle, Plus, Trash2, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useCallback } from "react";
import type { ScreeningQuestion } from "@/components/apply-wizard";
import { getToken } from "@/lib/api-config";

const schema = z.object({
  title: z.string().min(2, "Title required"),
  departmentId: z.coerce.number().optional(),
  description: z.string().min(1, "Description required"),
  closingDate: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  yes_no: "Yes / No",
  multiple_choice: "Multiple Choice",
};

type NewQuestion = { question: string; questionType: string; options: string; required: boolean };

function ScreeningQuestionsSection({ jobId }: { jobId: number }) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newQ, setNewQ] = useState<NewQuestion>({ question: "", questionType: "short_answer", options: "", required: true });

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
    if (!newQ.question.trim()) {
      toast({ title: "Question text required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const options = newQ.questionType === "multiple_choice"
        ? newQ.options.split(",").map(s => s.trim()).filter(Boolean)
        : undefined;
      const res = await fetch(`/api/jobs/${jobId}/screening-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ question: newQ.question, questionType: newQ.questionType, options, required: newQ.required }),
      });
      if (!res.ok) { toast({ title: "Failed to add question", variant: "destructive" }); return; }
      setNewQ({ question: "", questionType: "short_answer", options: "", required: true });
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
    // Optimistic UI update
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
      // Revert on failure
      await fetchQuestions();
      toast({ title: "Failed to reorder questions", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Screening Questions</CardTitle>
          <Badge variant="outline">{questions.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Add questions candidates must answer when applying for this position.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
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
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType}</Badge>
                      {q.required && <Badge variant="outline" className="text-xs text-red-600">Required</Badge>}
                    </div>
                    {q.options && Array.isArray(q.options) && (q.options as string[]).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Options: {(q.options as string[]).join(", ")}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <Button
                      type="button" size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => handleReorder(q.id, "up")} disabled={i === 0}
                      title="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button" size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => handleReorder(q.id, "down")} disabled={i === questions.length - 1}
                      title="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2 flex-shrink-0"
                    onClick={() => handleDelete(q.id)}
                    disabled={deletingId === q.id}
                  >
                    {deletingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new question */}
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
                  <Input
                    placeholder="Option A, Option B, Option C"
                    value={newQ.options}
                    onChange={e => setNewQ(p => ({ ...p, options: e.target.value }))}
                  />
                </div>
              )}
              <Button type="button" size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Add Question
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function JobFormPage() {
  const [matchNew] = useRoute("/jobs/new");
  const [matchEdit, paramsEdit] = useRoute("/jobs/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!matchEdit;
  const jobId = isEdit ? parseInt(paramsEdit!.id) : 0;

  const { data: departments } = useGetDepartments(undefined, { query: { queryKey: getGetDepartmentsQueryKey() } });
  const { data: existingJob } = useGetJob(jobId, { query: { enabled: isEdit && !!jobId, queryKey: getGetJobQueryKey(jobId) } });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", departmentId: undefined, description: "", closingDate: "" },
  });

  useEffect(() => {
    if (existingJob) {
      form.reset({
        title: existingJob.title,
        departmentId: existingJob.departmentId ?? undefined,
        description: existingJob.description ?? "",
        closingDate: existingJob.closingDate ? existingJob.closingDate.slice(0, 10) : "",
      });
    }
  }, [existingJob, form]);

  const createJob = useCreateJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
        toast({ title: "Job created" });
        setLocation("/jobs");
      },
      onError: () => toast({ title: "Failed to create job", variant: "destructive" }),
    },
  });

  const updateJob = useUpdateJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        toast({ title: "Job updated" });
        setLocation("/jobs");
      },
      onError: () => toast({ title: "Failed to update job", variant: "destructive" }),
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload = {
      title: values.title,
      description: values.description,
      departmentId: values.departmentId ?? null,
      closingDate: values.closingDate || null,
    };
    if (isEdit) {
      updateJob.mutate({ id: jobId, data: payload });
    } else {
      createJob.mutate({ data: payload });
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/jobs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? "Edit Job Vacancy" : "Post New Job Vacancy"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl><Input placeholder="Senior Analyst" data-testid="input-job-title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department (optional)</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Describe the role and responsibilities..." rows={5} data-testid="input-description" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="closingDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Closing Date (optional)</FormLabel>
                    <FormControl><Input type="date" data-testid="input-closing-date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex gap-3">
                  <Button type="submit" disabled={isPending} data-testid="button-save-job" className="flex-1">
                    {isPending ? "Saving..." : isEdit ? "Update Job" : "Post Job"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setLocation("/jobs")} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Screening Questions (only available in edit mode when job has an ID) */}
        {isEdit && jobId > 0 && <ScreeningQuestionsSection jobId={jobId} />}
      </div>
    </AppLayout>
  );
}
