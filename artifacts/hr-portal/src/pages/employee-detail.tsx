import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Building2, Briefcase, Calendar, Phone, Mail, User } from "lucide-react";
import {
  useGetEmployee, useGetContracts, useGetDepartments, useGetPositions,
  getGetEmployeeQueryKey, getGetContractsQueryKey, getGetDepartmentsQueryKey, getGetPositionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "secondary",
  terminated: "destructive",
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const [match, params] = useRoute("/employees/:id");
  const [, setLocation] = useLocation();
  const employeeId = match ? parseInt(params!.id) : 0;

  const { data: employee, isLoading } = useGetEmployee(employeeId, {
    query: { enabled: !!employeeId, queryKey: getGetEmployeeQueryKey(employeeId) },
  });

  const { data: contracts = [] } = useGetContracts(undefined, {
    query: { queryKey: getGetContractsQueryKey() },
  });

  const { data: departments = [] } = useGetDepartments(undefined, {
    query: { queryKey: getGetDepartmentsQueryKey() },
  });

  const { data: positions = [] } = useGetPositions(undefined, {
    query: { queryKey: getGetPositionsQueryKey() },
  });

  const deptMap: Record<number, string> = {};
  departments.forEach(d => { deptMap[d.id] = d.name; });

  const posMap: Record<number, string> = {};
  positions.forEach(p => { posMap[p.id] = p.title; });

  const empContracts = contracts.filter((c) => c.employeeId === employeeId)
    .sort((a, b) => new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime());

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!employee) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Employee not found.</div></AppLayout>;
  }

  const deptName = employee.departmentId ? (deptMap[employee.departmentId] ?? `Dept #${employee.departmentId}`) : null;
  const posTitle = employee.positionId ? (posMap[employee.positionId] ?? `Position #${employee.positionId}`) : null;

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/employees")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Employees
        </Button>

        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
              {initials(employee.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-employee">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {posTitle && <span className="text-sm text-muted-foreground">{posTitle}</span>}
              {posTitle && deptName && <span className="text-muted-foreground/50">·</span>}
              {deptName && <span className="text-sm text-muted-foreground">{deptName}</span>}
              <Badge variant={STATUS_COLORS[employee.status ?? "active"] ?? "default"} className="ml-1">
                {employee.status?.replace("_", " ") ?? "Active"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Building2} label="Department" value={deptName} />
              <InfoRow icon={Briefcase} label="Position" value={posTitle} />
              <InfoRow
                icon={Calendar}
                label="Start Date"
                value={employee.startDate ? new Date(employee.startDate).toLocaleDateString("en-PG", { day: "numeric", month: "long", year: "numeric" }) : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" /> Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Mail} label="Email" value={employee.email} />
              <InfoRow icon={Phone} label="Phone" value={employee.phone} />
            </CardContent>
          </Card>
        </div>

        {empContracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contract History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {empContracts.map((c) => (
                <Link key={c.id} href={`/contracts/${c.id}`}>
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    data-testid={`row-contract-${c.id}`}
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">{c.type} Contract</p>
                      <p className="text-xs text-muted-foreground">
                        {c.startDate ? new Date(c.startDate).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "?"}{" "}—{" "}
                        {c.endDate ? new Date(c.endDate).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "ongoing"}
                      </p>
                    </div>
                    <Badge variant={c.status === "active" ? "default" : c.status === "expired" ? "destructive" : "outline"}>
                      {c.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
