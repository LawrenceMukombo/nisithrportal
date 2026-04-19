import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Building2, UserPlus } from "lucide-react";
import { useGetEmployees, useGetDepartments, getGetEmployeesQueryKey, getGetDepartmentsQueryKey } from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRole } from "@/contexts/auth-context";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "secondary",
  terminated: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  on_leave: "On Leave",
  terminated: "Terminated",
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [, setLocation] = useLocation();
  const { isAdmin, isHR } = useRole();

  const { data: employees = [], isLoading } = useGetEmployees(
    { status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getGetEmployeesQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const { data: departments = [] } = useGetDepartments(undefined, {
    query: { queryKey: getGetDepartmentsQueryKey() },
  });

  const deptMap = useMemo(() => {
    const m: Record<number, string> = {};
    departments.forEach(d => { m[d.id] = d.name; });
    return m;
  }, [departments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchSearch = !q ||
        (e.name ?? "").toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q) ||
        (e.phone ?? "").toLowerCase().includes(q);
      const matchDept = deptFilter === "all" || String(e.departmentId) === deptFilter;
      return matchSearch && matchDept;
    });
  }, [employees, search, deptFilter]);

  const columns: DataTableColumn<Employee>[] = useMemo(() => [
    {
      key: "name",
      label: "Employee",
      sortable: true,
      csvValue: (e) => e.name ?? "",
      renderCell: (e) => (
        <Link href={`/employees/${e.id}`}>
          <div className="flex items-center gap-3 cursor-pointer group">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials(e.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="font-medium group-hover:underline text-foreground">{e.name}</span>
              {e.email && <p className="text-xs text-muted-foreground">{e.email}</p>}
            </div>
          </div>
        </Link>
      ),
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      csvValue: (e) => e.departmentId ? (deptMap[e.departmentId] ?? `Dept #${e.departmentId}`) : "",
      renderCell: (e) => (
        <span className="text-muted-foreground">
          {e.departmentId ? (deptMap[e.departmentId] ?? `Dept #${e.departmentId}`) : "—"}
        </span>
      ),
    },
    {
      key: "startDate",
      label: "Start Date",
      sortable: true,
      csvValue: (e) => e.startDate ?? "",
      renderCell: (e) => (
        <span className="text-muted-foreground">
          {e.startDate ? new Date(e.startDate).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      csvValue: (e) => STATUS_LABEL[e.status ?? "active"] ?? e.status ?? "",
      renderCell: (e) => (
        <Badge variant={STATUS_COLORS[e.status ?? "active"] ?? "default"}>
          {STATUS_LABEL[e.status ?? "active"] ?? e.status}
        </Badge>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      defaultHidden: true,
      csvValue: (e) => e.phone ?? "",
      renderCell: (e) => <span className="text-muted-foreground">{e.phone ?? "—"}</span>,
    },
  ], [deptMap]);

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-employees">Employees</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Loading…" : `${employees.length} employee${employees.length !== 1 ? "s" : ""} total`}
            </p>
          </div>
          {(isAdmin || isHR) && (
            <Button size="sm" onClick={() => setLocation("/employees/new")} data-testid="btn-new-employee">
              <UserPlus className="h-4 w-4 mr-1.5" />
              Add Employee
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-employees"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-48" data-testid="select-dept-filter">
                  <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            getRowId={(e) => e.id}
            emptyMessage="No employees found. Try adjusting your search or filters."
            onRowClick={(e) => setLocation(`/employees/${e.id}`)}
            data-testid="table-employees"
          />
        )}
      </div>
    </AppLayout>
  );
}
