import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Calendar, Building2, Send, Users2, ChevronRight } from "lucide-react";
import { useGetJob, useCreateApplication, useGetApplications, getGetJobQueryKey } from "@workspace/api-client-react";
import type { Application } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/layouts/app-layout";
import { useAuth, useRole } from "@/contexts/auth-context";

const appSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  cvUrl: z.string().optional(),
  coverLetter: z.string().optional(),
});
type AppForm = z.infer<typeof appSchema>;

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  screening: "bg-yellow-100 text-yellow-700",
  interview: "bg-purple-100 text-purple-700",
  offer: "bg-green-100 text-green-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

async function uploadCvFile(file: File): Promise<string> {
  const urlRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Failed to upload file to storage");

  return `/api/storage${objectPath}`;
}

function ApplyDialog({ jobId }: { jobId: number }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: number; email: string } | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const form = useForm<AppForm>({
    resolver: zodResolver(appSchema),
    defaultValues: { fullName: "", email: "", phone: "", cvUrl: "", coverLetter: "" },
  });

  const createApp = useCreateApplication();

  const onSubmit = async (values: AppForm) => {
    try {
      let cvUrl = values.cvUrl || undefined;

      if (cvFile) {
        setUploading(true);
        try {
          cvUrl = await uploadCvFile(cvFile);
        } catch {
          toast({ title: "CV upload failed", description: "Could not upload your CV. Please try again.", variant: "destructive" });
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      const result = await createApp.mutateAsync({
        data: {
          jobId,
          candidateName: values.fullName,
          candidateEmail: values.email,
          candidatePhone: values.phone || undefined,
          cvUrl,
          coverLetter: values.coverLetter || undefined,
        }
      });
      setSubmitted({ id: (result as { id: number }).id, email: values.email });
      form.reset();
      setCvFile(null);
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSubmitted(null); }}>
      <DialogTrigger asChild>
        <Button size="lg" data-testid="button-apply-now">
          <Send className="h-4 w-4 mr-2" /> Apply Now
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{submitted ? "Application Submitted" : "Submit Application"}</DialogTitle>
        </DialogHeader>
        {submitted && (
          <div className="space-y-4 py-2" data-testid="apply-success">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center space-y-2">
              <p className="text-green-700 font-semibold text-sm">Your application was received!</p>
              <p className="text-xs text-muted-foreground">Save your reference number to track your application status.</p>
              <div className="bg-white border rounded-md px-4 py-2 mt-2 font-mono text-lg font-bold tracking-widest text-primary" data-testid="apply-reference">
                REF-{String(submitted.id).padStart(6, "0")}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Use your email <strong>{submitted.email}</strong> and the reference number above at{" "}
              <Link href="/track-application" className="text-primary underline">Track Application</Link>{" "}
              to check your status.
            </p>
            <Button className="w-full" onClick={() => { setOpen(false); setSubmitted(null); }}>Close</Button>
          </div>
        )}
        {!submitted && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="fullName" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input placeholder="Your full name" data-testid="input-apply-name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" placeholder="your@email.com" data-testid="input-apply-email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <FormControl><Input placeholder="+675..." data-testid="input-apply-phone" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormItem>
              <FormLabel>CV / Résumé Upload (optional)</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="cursor-pointer"
                    data-testid="input-apply-cv-url"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) { setCvFile(null); return; }
                      if (file.size > 10 * 1024 * 1024) {
                        toast({ title: "File too large", description: "CV must be under 10 MB", variant: "destructive" });
                        e.target.value = "";
                        setCvFile(null);
                        return;
                      }
                      setCvFile(file);
                    }}
                  />
                  {cvFile && (
                    <p className="text-xs text-green-600">
                      {uploading ? "Uploading CV..." : `CV selected: ${cvFile.name}`}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Supported: PDF, DOC, DOCX — max 10 MB</p>
                </div>
              </FormControl>
            </FormItem>
            <FormField control={form.control} name="coverLetter" render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Letter (optional)</FormLabel>
                <FormControl><Textarea placeholder="Tell us why you're a great fit..." rows={4} data-testid="input-cover-letter" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button
              type="submit"
              className="w-full"
              disabled={createApp.isPending || uploading}
              data-testid="button-submit-application"
            >
              {uploading ? "Uploading CV..." : createApp.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApplicationPipelineCard({ jobId }: { jobId: number }) {
  const { data: applications = [], isLoading } = useGetApplications({ job_id: jobId });

  const byStatus = applications.reduce<Record<string, Application[]>>((acc, app) => {
    (acc[app.status] = acc[app.status] || []).push(app);
    return acc;
  }, {});

  const statusOrder = ["applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"];
  const activeStatuses = statusOrder.filter((s) => (byStatus[s]?.length ?? 0) > 0);

  return (
    <Card data-testid="card-pipeline">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Recruitment Pipeline</CardTitle>
          </div>
          <Badge variant="outline">{applications.length} application{applications.length !== 1 ? "s" : ""}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No applications yet for this position.</p>
        ) : (
          <div className="space-y-4">
            {/* Status summary row */}
            <div className="flex flex-wrap gap-2">
              {activeStatuses.map((status) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {status} ({byStatus[status]?.length})
                </span>
              ))}
            </div>
            <Separator />
            {/* Applications table */}
            <div className="space-y-1">
              {applications.slice(0, 20).map((app) => (
                <Link key={app.id} href={`/applications/${app.id}`}>
                  <div
                    className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/60 cursor-pointer transition-colors"
                    data-testid={`pipeline-row-${app.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {app.status}
                      </span>
                      <span className="text-sm font-medium">Candidate #{app.candidateId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {app.createdAt && <span>{new Date(app.createdAt).toLocaleDateString()}</span>}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
              {applications.length > 20 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{applications.length - 20} more —{" "}
                  <Link href="/applications" className="text-primary hover:underline">view all applications</Link>
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function JobDetailPage() {
  const [match, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAdmin, isHR, isHiringManager } = useRole();

  const jobId = match ? parseInt(params!.id) : 0;
  const { data: job, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) }
  });

  const canViewPipeline = isAuthenticated && (isAdmin || isHR || isHiringManager);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto text-center py-20">
          <p className="text-muted-foreground">Job not found.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/jobs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs
        </Button>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="heading-job-title">{job.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {job.departmentId && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Dept #{job.departmentId}</span>}
                {job.closingDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Closes {new Date(job.closingDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={job.status === "published" ? "default" : "secondary"}>{job.status}</Badge>
              {job.status === "published" && <ApplyDialog jobId={job.id} />}
            </div>
          </div>

          <Separator />

          {job.description && (
            <Card>
              <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-job-description">{job.description}</p>
              </CardContent>
            </Card>
          )}

          {canViewPipeline && <ApplicationPipelineCard jobId={job.id} />}
        </div>
      </div>
    </AppLayout>
  );
}
