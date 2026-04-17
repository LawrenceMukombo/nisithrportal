import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Calendar, MapPin, Building2, Send } from "lucide-react";
import { useGetJob, useCreateApplication, getGetJobQueryKey } from "@workspace/api-client-react";
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
import { useAuth } from "@/contexts/auth-context";

const appSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  coverLetter: z.string().optional(),
});
type AppForm = z.infer<typeof appSchema>;

function ApplyDialog({ jobId }: { jobId: number }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AppForm>({
    resolver: zodResolver(appSchema),
    defaultValues: { fullName: "", email: "", phone: "", coverLetter: "" },
  });

  const createApp = useCreateApplication();

  const onSubmit = async (values: AppForm) => {
    try {
      await createApp.mutateAsync({
        data: {
          jobId,
          candidateName: values.fullName,
          candidateEmail: values.email,
          candidatePhone: values.phone,
          coverLetter: values.coverLetter,
        }
      });
      toast({ title: "Application submitted!", description: "We'll review your application and be in touch." });
      setOpen(false);
      form.reset();
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" data-testid="button-apply-now">
          <Send className="h-4 w-4 mr-2" /> Apply Now
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Application</DialogTitle>
        </DialogHeader>
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
              disabled={createApp.isPending}
              data-testid="button-submit-application"
            >
              {createApp.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function JobDetailPage() {
  const [match, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const jobId = match ? parseInt(params!.id) : 0;
  const { data: job, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) }
  });

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

          {false && ( // requirements not in Job schema
            <Card>
              <CardHeader><CardTitle className="text-base">Requirements</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-job-requirements"></p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
