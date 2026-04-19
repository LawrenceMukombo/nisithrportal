import { useLocation } from "wouter";
import { ArrowLeft, UserPlus, ExternalLink } from "lucide-react";
import {
  useCreateEmployee,
  useGetDepartments,
  useGetPositions,
  getGetEmployeesQueryKey,
  getGetDepartmentsQueryKey,
  getGetPositionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/layouts/app-layout";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

const employeeFormSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email required").or(z.literal("")).optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  startDate: z.string().optional(),
  status: z.enum(["active", "on_leave", "terminated"]).default("active"),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export default function EmployeeFormPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(window.location.search);
  const fromApp = params.get("fromApp");
  const prefillName = params.get("name") ?? "";
  const prefillEmail = params.get("email") ?? "";
  const prefillPhone = params.get("phone") ?? "";
  const prefillDeptId = params.get("departmentId") ?? "";
  const prefillPositionId = params.get("positionId") ?? "";

  const { data: departments = [] } = useGetDepartments(undefined, {
    query: { queryKey: getGetDepartmentsQueryKey() },
  });
  const { data: positions = [] } = useGetPositions(undefined, {
    query: { queryKey: getGetPositionsQueryKey() },
  });

  const createEmployee = useCreateEmployee();

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: prefillName,
      email: prefillEmail,
      phone: prefillPhone,
      departmentId: prefillDeptId,
      positionId: prefillPositionId,
      startDate: new Date().toISOString().slice(0, 10),
      status: "active",
    },
  });

  const onSubmit = async (values: EmployeeFormValues) => {
    try {
      const result = await createEmployee.mutateAsync({
        data: {
          name: values.name,
          email: values.email || null,
          phone: values.phone || null,
          departmentId: values.departmentId ? parseInt(values.departmentId) : null,
          positionId: values.positionId ? parseInt(values.positionId) : null,
          startDate: values.startDate || null,
          status: values.status,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
      toast({ title: "Employee record created", description: `${values.name} added to the directory.` });
      setLocation(`/employees/${result.id}`);
    } catch {
      toast({ title: "Failed to create employee record", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(fromApp ? `/applications/${fromApp}` : "/employees")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {fromApp ? "Back to Application" : "Back to Employees"}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <UserPlus className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Create Employee Record</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Add a new employee to the workforce directory.</p>
          </div>
        </div>

        {fromApp && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800 text-sm">
            <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400 shrink-0">Hired</Badge>
            <span className="text-muted-foreground">Onboarding from</span>
            <Link href={`/applications/${fromApp}`}>
              <span className="text-primary hover:underline cursor-pointer flex items-center gap-1 font-medium">
                Application #{fromApp} <ExternalLink className="h-3 w-3" />
              </span>
            </Link>
            <span className="text-muted-foreground">— fields pre-filled from candidate profile.</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. John Smith" {...field} data-testid="input-employee-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+675 7000 0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                          <FormControl>
                            <SelectTrigger data-testid="select-dept">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No Department</SelectItem>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="positionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position / Title</FormLabel>
                        <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                          <FormControl>
                            <SelectTrigger data-testid="select-position">
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No Position</SelectItem>
                            {positions.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_leave">On Leave</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={createEmployee.isPending}
                    data-testid="btn-create-employee"
                  >
                    {createEmployee.isPending ? "Creating…" : "Create Employee Record"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation(fromApp ? `/applications/${fromApp}` : "/employees")}
                  >
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
