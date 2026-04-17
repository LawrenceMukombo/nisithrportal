import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useGetAgencies, useCreateAgency, useDeleteAgency, getGetAgenciesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  type: z.string().min(1, "Type required"),
});
type FormValues = z.infer<typeof schema>;

const AGENCY_TYPES = ["government", "statutory", "soe", "ngo", "other"];

function CreateAgencyDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "government" },
  });

  const createMutation = useCreateAgency({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAgenciesQueryKey() });
        toast({ title: "Agency created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to create agency", variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-agency"><Plus className="h-4 w-4 mr-2" /> New Agency</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Agency</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate({ data: v }))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Agency Name</FormLabel>
                <FormControl><Input placeholder="Department of Finance" data-testid="input-agency-name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-agency-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {AGENCY_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-agency">
              {createMutation.isPending ? "Creating..." : "Create Agency"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AgenciesPage() {
  const agencies = useGetAgencies({ query: { queryKey: getGetAgenciesQueryKey() } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useDeleteAgency({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAgenciesQueryKey() });
        toast({ title: "Agency deleted" });
      },
    },
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-agencies">Agencies</h1>
            <p className="text-sm text-muted-foreground mt-1">{agencies.data?.length ?? 0} agencies</p>
          </div>
          <CreateAgencyDialog />
        </div>

        <Card>
          <CardContent className="p-0">
            {agencies.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div data-testid="list-agencies">
                {agencies.data?.map((agency) => (
                  <div key={agency.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0" data-testid={`row-agency-${agency.id}`}>
                    <div>
                      <p className="font-medium text-sm">{agency.name}</p>
                      {agency.type && <Badge variant="outline" className="text-xs mt-1 capitalize">{agency.type}</Badge>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("Delete this agency?")) deleteMutation.mutate({ id: agency.id }); }}
                      data-testid={`button-delete-agency-${agency.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {agencies.data?.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">No agencies found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
