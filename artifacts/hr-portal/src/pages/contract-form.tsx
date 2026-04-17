import { useRoute, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useGetEmployees, useCreateContract } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/layouts/app-layout";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contractFormSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  type: z.enum(["fixed_term", "permanent", "casual", "probationary"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  documentUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

export default function ContractFormPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: employees = [], isLoading: loadingEmployees } = useGetEmployees(undefined, {});

  const createContract = useCreateContract();

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      employeeId: "",
      type: "fixed_term",
      startDate: "",
      endDate: "",
      documentUrl: "",
    },
  });

  const onSubmit = async (values: ContractFormValues) => {
    try {
      const created = await createContract.mutateAsync({
        data: {
          employeeId: parseInt(values.employeeId),
          type: values.type,
          startDate: values.startDate,
          endDate: values.endDate || null,
          documentUrl: values.documentUrl || null,
        },
      });
      toast({ title: "Contract created", description: "Contract has been created and activated." });
      setLocation(`/contracts/${created.id}`);
    } catch {
      toast({ title: "Failed to create contract", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contracts
        </Button>

        <h1 className="text-2xl font-bold" data-testid="heading-new-contract">New Contract</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">Contract Details</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={loadingEmployees}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employee">
                            <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Select employee"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              {emp.name} {emp.email ? `(${emp.email})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contract-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed_term">Fixed Term</SelectItem>
                          <SelectItem value="permanent">Permanent</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="probationary">Probationary</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-start-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date <span className="text-muted-foreground font-normal">(optional for permanent)</span></FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-end-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="documentUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document URL <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://..." data-testid="input-document-url" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setLocation("/contracts")}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createContract.isPending} data-testid="button-save-contract">
                    {createContract.isPending ? "Creating..." : "Create Contract"}
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
