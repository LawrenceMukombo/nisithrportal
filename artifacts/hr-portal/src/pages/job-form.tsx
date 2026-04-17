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
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const schema = z.object({
  title: z.string().min(2, "Title required"),
  departmentId: z.coerce.number().optional(),
  description: z.string().min(1, "Description required"),
  closingDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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
      </div>
    </AppLayout>
  );
}
