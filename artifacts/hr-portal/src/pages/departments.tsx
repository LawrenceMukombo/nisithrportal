import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useGetDepartments, useCreateDepartment, useDeleteDepartment, useGetAgencies, getGetDepartmentsQueryKey, getGetAgenciesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  agencyId: z.coerce.number().optional(),
});
type FormValues = z.infer<typeof schema>;

function CreateDeptDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const agencies = useGetAgencies({ query: { queryKey: getGetAgenciesQueryKey() } });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", agencyId: undefined },
  });

  const createMutation = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDepartmentsQueryKey() });
        toast({ title: "Department created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-department"><Plus className="h-4 w-4 mr-2" /> New Department</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Department</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate({ data: v }))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Department Name</FormLabel>
                <FormControl><Input placeholder="Human Resources" data-testid="input-dept-name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-department">
              {createMutation.isPending ? "Creating..." : "Create Department"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function DepartmentsPage() {
  const departments = useGetDepartments(undefined, { query: { queryKey: getGetDepartmentsQueryKey() } });
  const agencies = useGetAgencies({ query: { queryKey: getGetAgenciesQueryKey() } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useDeleteDepartment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDepartmentsQueryKey() });
        toast({ title: "Department deleted" });
      },
    },
  });

  const agencyMap = Object.fromEntries(agencies.data?.map((a) => [a.id, a.name]) ?? []);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-departments">Departments</h1>
            <p className="text-sm text-muted-foreground mt-1">{departments.data?.length ?? 0} departments</p>
          </div>
          <CreateDeptDialog />
        </div>

        <Card>
          <CardContent className="p-0">
            {departments.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div data-testid="list-departments">
                {departments.data?.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0" data-testid={`row-department-${dept.id}`}>
                    <div>
                      <p className="font-medium text-sm">{dept.name}</p>
                      {dept.agencyId && <p className="text-xs text-muted-foreground">{agencyMap[dept.agencyId] ?? `Agency #${dept.agencyId}`}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("Delete department?")) deleteMutation.mutate({ id: dept.id }); }}
                      data-testid={`button-delete-department-${dept.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {departments.data?.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">No departments found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
