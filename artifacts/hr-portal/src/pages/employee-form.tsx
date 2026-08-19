import { useState, useEffect } from "react";
import { useLocation, Link, useRoute } from "wouter";
import { ArrowLeft, UserPlus, Edit3, ExternalLink, ShieldCheck, HeartHandshake, Briefcase, User, MapPin } from "lucide-react";
import {
  useGetDepartments,
  useGetPositions,
  useGetEmployees,
  useGetEmployee,
  getGetEmployeesQueryKey,
  getGetEmployeeQueryKey,
  getGetDepartmentsQueryKey,
  getGetPositionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { getToken } from "@/lib/api-config";

const maximumEmployableDateOfBirth = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date.toISOString().slice(0, 10);
};

const employeeMasterFormSchema = z.object({
  name: z.string().min(2, "Full legal name is required"),
  email: z.string().email("Valid email required").or(z.literal("")).optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional().refine(
    (value) => !value || value <= maximumEmployableDateOfBirth(),
    "An employee must be at least 18 years old",
  ),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationalId: z.string().optional(),
  passportNumber: z.string().optional(),
  residentialAddress: z.string().optional(),
  postalAddress: z.string().optional(),
  city: z.string().default("Port Moresby"),
  province: z.string().default("National Capital District"),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactAddress: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  supervisorId: z.string().optional(),
  gradeLevel: z.string().default("Grade 10"),
  division: z.string().optional(),
  unit: z.string().optional(),
  employmentType: z.string().default("permanent"),
  startDate: z.string().optional(),
  probationStartDate: z.string().optional(),
  probationEndDate: z.string().optional(),
  status: z.string().default("active"),
});

type EmployeeMasterFormValues = z.infer<typeof employeeMasterFormSchema>;

export default function EmployeeFormPage() {
  const [, setLocation] = useLocation();
  const [matchEdit1, params1] = useRoute("/employees/edit/:id");
  const [matchEdit2, params2] = useRoute("/employees/:id/edit");
  const editIdStr = matchEdit1 ? params1?.id : matchEdit2 ? params2?.id : null;
  const isEdit = !!editIdStr;
  const employeeId = editIdStr ? parseInt(editIdStr, 10) : 0;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const fromApp = params.get("fromApp");
  const prefillName = params.get("name") ?? "";
  const prefillEmail = params.get("email") ?? "";
  const prefillPhone = params.get("phone") ?? "";
  const prefillDeptId = params.get("departmentId") ?? "";
  const prefillPositionId = params.get("positionId") ?? "";

  const { data: rawDepartments = [] } = useGetDepartments(undefined, {
    query: { queryKey: getGetDepartmentsQueryKey() },
  });
  const departments = Array.isArray(rawDepartments) ? rawDepartments : [];

  const { data: rawPositions = [] } = useGetPositions(undefined, {
    query: { queryKey: getGetPositionsQueryKey() },
  });
  const positions = Array.isArray(rawPositions) ? rawPositions : [];

  const { data: rawEmployees = [] } = useGetEmployees(undefined, {
    query: { queryKey: getGetEmployeesQueryKey() },
  });
  const existingEmployees = Array.isArray(rawEmployees) ? (rawEmployees as any[]) : [];

  const { data: existingEmp } = useGetEmployee(employeeId, {
    query: { enabled: isEdit && !!employeeId, queryKey: getGetEmployeeQueryKey(employeeId) },
  });

  const form = useForm<EmployeeMasterFormValues>({
    resolver: zodResolver(employeeMasterFormSchema),
    defaultValues: {
      name: prefillName,
      email: prefillEmail,
      phone: prefillPhone,
      departmentId: prefillDeptId,
      positionId: prefillPositionId,
      city: "Port Moresby",
      province: "National Capital District",
      gradeLevel: "Grade 10",
      employmentType: "permanent",
      startDate: new Date().toISOString().slice(0, 10),
      status: "active",
    },
  });

  useEffect(() => {
    if (isEdit && existingEmp) {
      const emp = existingEmp as any;
      form.reset({
        name: emp.name ?? "",
        email: emp.email ?? "",
        phone: emp.phone ?? "",
        dateOfBirth: emp.dateOfBirth ?? "",
        gender: emp.gender ?? "",
        maritalStatus: emp.maritalStatus ?? "",
        nationalId: emp.nationalId ?? "",
        passportNumber: emp.passportNumber ?? "",
        residentialAddress: emp.residentialAddress ?? "",
        postalAddress: emp.postalAddress ?? "",
        city: emp.city ?? "Port Moresby",
        province: emp.province ?? "National Capital District",
        emergencyContactName: emp.emergencyContactName ?? "",
        emergencyContactRelationship: emp.emergencyContactRelationship ?? "",
        emergencyContactPhone: emp.emergencyContactPhone ?? "",
        emergencyContactAddress: emp.emergencyContactAddress ?? "",
        departmentId: emp.departmentId ? String(emp.departmentId) : "",
        positionId: emp.positionId ? String(emp.positionId) : "",
        supervisorId: emp.supervisorId ? String(emp.supervisorId) : "",
        gradeLevel: emp.gradeLevel ?? "Grade 10",
        division: emp.division ?? "",
        unit: emp.unit ?? "",
        employmentType: emp.employmentType ?? "permanent",
        startDate: emp.startDate ?? "",
        probationStartDate: emp.probationStartDate ?? "",
        probationEndDate: emp.probationEndDate ?? "",
        status: emp.status ?? "active",
      });
    }
  }, [isEdit, existingEmp, form]);

  const onSubmit = async (values: EmployeeMasterFormValues) => {
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/employees/${employeeId}` : "/api/employees";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
        credentials: "include",
        body: JSON.stringify({
          ...values,
          departmentId: values.departmentId ? parseInt(values.departmentId, 10) : null,
          positionId: values.positionId ? parseInt(values.positionId, 10) : null,
          supervisorId: values.supervisorId ? parseInt(values.supervisorId, 10) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} employee record`);
      }

      await queryClient.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
      if (isEdit) {
        await queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
      }

      toast({
        title: isEdit ? "Employee Record Updated" : "Employee Record Created",
        description: isEdit
          ? `Changes saved for ${values.name}.`
          : `${values.name} assigned Employee ID ${data.employeeNumber || `#${data.id}`}`,
      });
      setLocation(`/employees/${isEdit ? employeeId : data.id}`);
    } catch (err: any) {
      toast({
        title: isEdit ? "Update Failed" : "Creation Failed",
        description: err.message || `Could not ${isEdit ? "update" : "create"} employee master record`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(isEdit ? `/employees/${employeeId}` : fromApp ? `/applications/${fromApp}` : "/employees")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {isEdit ? "Back to Profile" : fromApp ? "Back to Application" : "Back to Employees"}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {isEdit ? (
            <Edit3 className="h-7 w-7 text-primary" />
          ) : (
            <UserPlus className="h-7 w-7 text-primary" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEdit ? "Edit Employee Master Record" : "Create Employee Master Record"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEdit
                ? `Modify statutory details, position assignments, or emergency contacts for #${employeeId}.`
                : "Enrol a new personnel record into the NISIT workforce directory."}
            </p>
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Personal Demographics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" /> 1. Personal Identification & Demographics
                </CardTitle>
                <CardDescription>Legal identification details as recorded on official civil documents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Legal Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Margaret Mala Tolo" {...field} data-testid="input-employee-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nationalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>National ID Number (NID)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. NID-8839201" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" max={maximumEmployableDateOfBirth()} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maritalStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marital Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Single">Single</SelectItem>
                            <SelectItem value="Married">Married</SelectItem>
                            <SelectItem value="Divorced">Divorced</SelectItem>
                            <SelectItem value="Widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Contact & Address */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> 2. Contact & Residential Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="e.g. mtolo@nisit.gov.pg" {...field} />
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
                        <FormLabel>Primary Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. +675 7123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="residentialAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Residential Address</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Section 42, Lot 10, Boroko" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Address</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. P.O. Box 1024, Port Moresby" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Emergency Contacts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartHandshake className="h-5 w-5 text-primary" /> 3. Emergency Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Peter Tolo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyContactRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Spouse / Brother" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. +675 7987 6543" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Institutional & Governance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" /> 4. Institutional Structure & Grade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        <FormLabel>Established Position *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Position" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="gradeLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Public Service Grade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "Grade 10"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Grade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Grade 8">Grade 8 (Support)</SelectItem>
                            <SelectItem value="Grade 10">Grade 10 (Officer)</SelectItem>
                            <SelectItem value="Grade 12">Grade 12 (Senior Officer)</SelectItem>
                            <SelectItem value="Grade 14">Grade 14 (Principal / Manager)</SelectItem>
                            <SelectItem value="Grade 16">Grade 16 (Director / Executive)</SelectItem>
                            <SelectItem value="Grade 18">Grade 18 (Director General)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supervisorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reporting Supervisor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Supervisor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {existingEmployees.map((e) => (
                              <SelectItem key={e.id} value={String(e.id)}>
                                {e.name} ({e.employeeNumber || `EMP-${e.id}`})
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
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "permanent"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="permanent">Permanent Public Officer</SelectItem>
                            <SelectItem value="fixed_term">Fixed-Term Contract</SelectItem>
                            <SelectItem value="temporary">Temporary / Casual</SelectItem>
                            <SelectItem value="consultant">Specialist Consultant</SelectItem>
                            <SelectItem value="intern">Graduate Intern</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effective Appointment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                        <FormLabel>Personnel Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "active"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="probation">On Probation</SelectItem>
                            <SelectItem value="on_leave">On Approved Leave</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation(isEdit ? `/employees/${employeeId}` : "/employees")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} data-testid="btn-submit-employee">
                {submitting
                  ? (isEdit ? "Updating Record…" : "Enrolling Employee…")
                  : (isEdit ? "Update Employee Master Record" : "Save Employee Master Record")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
