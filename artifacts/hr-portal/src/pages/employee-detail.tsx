import { useRoute, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useGetEmployee, useGetContracts, getGetEmployeeQueryKey, getGetContractsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/layouts/app-layout";

export default function EmployeeDetailPage() {
  const [match, params] = useRoute("/employees/:id");
  const [, setLocation] = useLocation();
  const employeeId = match ? parseInt(params!.id) : 0;

  const { data: employee, isLoading } = useGetEmployee(employeeId, {
    query: { enabled: !!employeeId, queryKey: getGetEmployeeQueryKey(employeeId) },
  });

  const { data: contracts } = useGetContracts(undefined, {
    query: { queryKey: getGetContractsQueryKey() },
  });
  const empContracts = contracts?.filter((c) => c.employeeId === employeeId);

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!employee) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Employee not found.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/employees")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Employees
        </Button>

        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-employee">{employee.name}</h1>
          {employee.email && <p className="text-muted-foreground text-sm mt-1">{employee.email}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Employment Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {employee.departmentId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <span>Dept #{employee.departmentId}</span>
                </div>
              )}
              {employee.positionId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position</span>
                  <span>Position #{employee.positionId}</span>
                </div>
              )}
              {employee.startDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date</span>
                  <span>{new Date(employee.startDate).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge>{employee.status?.replace("_", " ")}</Badge>
              </div>
              {employee.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{employee.phone}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {empContracts && empContracts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Contract History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {empContracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0" data-testid={`row-contract-${c.id}`}>
                  <div>
                    <p className="text-sm font-medium capitalize">{c.type} Contract</p>
                    <p className="text-xs text-muted-foreground">
                      {c.startDate ? new Date(c.startDate).toLocaleDateString() : "?"} —{" "}
                      {c.endDate ? new Date(c.endDate).toLocaleDateString() : "ongoing"}
                    </p>
                  </div>
                  <Badge variant={c.status === "active" ? "default" : c.status === "expired" ? "destructive" : "outline"}>
                    {c.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
