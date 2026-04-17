import { useState } from "react";
import { Link } from "wouter";
import { Search, Plus } from "lucide-react";
import { useGetEmployees, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "secondary",
  terminated: "destructive",
};

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { agencyId } = useAuth();

  const employees = useGetEmployees(
    { status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getGetEmployeesQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const filtered = employees.data?.filter((e) =>
    (e.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.email ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-employees">Employees</h1>
            <p className="text-sm text-muted-foreground mt-1">{employees.data?.length ?? 0} employees</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by employee number..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-employees"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {employees.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="table-employees">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Employee</th>
                    <th className="text-left py-3 px-4 font-medium">Number</th>
                    <th className="text-left py-3 px-4 font-medium">Department</th>
                    <th className="text-left py-3 px-4 font-medium">Start Date</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">No employees found</td>
                    </tr>
                  ) : (
                    filtered.map((emp) => (
                      <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-employee-${emp.id}`}>
                        <td className="py-3 px-4">
                          <Link href={`/employees/${emp.id}`}>
                            <span className="text-primary hover:underline cursor-pointer font-medium">
                              {emp.name}
                            </span>
                          </Link>
                          {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{emp.departmentId ? `Dept #${emp.departmentId}` : "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {emp.startDate ? new Date(emp.startDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={STATUS_COLORS[emp.status ?? "active"] ?? "default"} className="capitalize">
                            {emp.status?.replace("_", " ") ?? "Active"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
