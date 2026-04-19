import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Plus, FileText, FileCheck2, FileClock } from "lucide-react";
import { useGetContracts, useGetEmployees, getGetContractsQueryKey, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import type { Contract } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import type { DataTableColumn } from "@/components/ui/data-table";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expired: "destructive",
  terminated: "outline",
};

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  permanent: "Permanent",
  contract: "Fixed-Term",
  casual: "Casual",
  temporary: "Temporary",
};

type ContractRow = Contract & Record<string, unknown>;

export default function ContractsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [, setLocation] = useLocation();

  const { data: contracts = [], isLoading } = useGetContracts(
    { status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getGetContractsQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const { data: employees = [] } = useGetEmployees(undefined, {
    query: { queryKey: getGetEmployeesQueryKey() },
  });

  const empMap = useMemo(() => {
    const m: Record<number, string> = {};
    employees.forEach(e => { m[e.id] = e.name ?? `Employee #${e.id}`; });
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return contracts as ContractRow[];
    return (contracts as ContractRow[]).filter((c) => {
      const empName = c.employeeId ? (empMap[c.employeeId as number] ?? "").toLowerCase() : "";
      return empName.includes(q) || String(c.id).includes(q) || (c.type as string ?? "").toLowerCase().includes(q);
    });
  }, [contracts, search, empMap]);

  const columns: DataTableColumn<ContractRow>[] = [
    {
      key: "id",
      label: "Contract",
      sortable: true,
      sortValue: (c) => c.id,
      exportValue: (c) => `Contract #${c.id}`,
      render: (c) => (
        <Link href={`/contracts/${c.id}`}>
          <span className="text-primary hover:underline cursor-pointer font-medium">Contract #{c.id}</span>
        </Link>
      ),
    },
    {
      key: "employee",
      label: "Employee",
      sortable: true,
      sortValue: (c) => c.employeeId ? (empMap[c.employeeId as number] ?? "") : "",
      exportValue: (c) => c.employeeId ? (empMap[c.employeeId as number] ?? `Employee #${c.employeeId}`) : "—",
      render: (c) => (
        c.employeeId ? (
          <Link href={`/employees/${c.employeeId}`}>
            <span className="hover:underline cursor-pointer">
              {empMap[c.employeeId as number] ?? `Employee #${c.employeeId}`}
            </span>
          </Link>
        ) : <span>—</span>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      sortValue: (c) => c.type as string ?? "",
      exportValue: (c) => CONTRACT_TYPE_LABEL[c.type as string ?? ""] ?? c.type as string ?? "—",
      render: (c) => (
        <span className="text-muted-foreground capitalize">
          {CONTRACT_TYPE_LABEL[c.type as string ?? ""] ?? c.type as string ?? "—"}
        </span>
      ),
    },
    {
      key: "period",
      label: "Period",
      sortable: true,
      sortValue: (c) => c.startDate as string ?? "",
      exportValue: (c) => {
        const start = c.startDate ? new Date(c.startDate as string).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "—";
        const end = c.endDate ? new Date(c.endDate as string).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "ongoing";
        return `${start} – ${end}`;
      },
      render: (c) => (
        <span className="text-muted-foreground text-xs">
          {c.startDate ? new Date(c.startDate as string).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          <span className="mx-1">–</span>
          {c.endDate ? new Date(c.endDate as string).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "ongoing"}
        </span>
      ),
    },
    {
      key: "startDate",
      label: "Start Date",
      defaultHidden: true,
      sortable: true,
      sortValue: (c) => c.startDate as string ?? "",
      exportValue: (c) => c.startDate ? new Date(c.startDate as string).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "—",
      render: (c) => <span className="text-muted-foreground text-xs">{c.startDate ? new Date(c.startDate as string).toLocaleDateString() : "—"}</span>,
    },
    {
      key: "endDate",
      label: "End Date",
      defaultHidden: true,
      sortable: true,
      sortValue: (c) => c.endDate as string ?? "",
      exportValue: (c) => c.endDate ? new Date(c.endDate as string).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "ongoing",
      render: (c) => <span className="text-muted-foreground text-xs">{c.endDate ? new Date(c.endDate as string).toLocaleDateString() : "ongoing"}</span>,
    },
    {
      key: "signedDocument",
      label: "Signed Document",
      sortable: true,
      sortValue: (c) => (c.documentUrl ? 1 : 0),
      exportValue: (c) => (c.documentUrl ? "Signed" : "Pending"),
      render: (c) => (
        c.documentUrl ? (
          <Badge variant="default" className="gap-1" data-testid={`badge-signed-${c.id}`}>
            <FileCheck2 className="h-3 w-3" /> Signed
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid={`badge-pending-${c.id}`}>
            <FileClock className="h-3 w-3" /> Pending
          </Badge>
        )
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValue: (c) => c.status as string ?? "",
      exportValue: (c) => c.status as string ?? "—",
      render: (c) => (
        <Badge variant={STATUS_COLORS[c.status as string ?? "active"] ?? "default"} className="capitalize">
          {c.status as string}
        </Badge>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-contracts">Contracts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Loading…" : `${contracts.length} contract${contracts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/contracts/new">
            <Button data-testid="button-create-contract">
              <Plus className="h-4 w-4 mr-2" /> New Contract
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by employee name or contract ID…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-contracts"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(c) => c.id}
          isLoading={isLoading}
          exportFilename="contracts"
          data-testid="table-contracts"
          emptyState={
            <div className="py-4">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No contracts found</p>
              <p className="text-xs mt-1">Try adjusting your search or filters</p>
            </div>
          }
        />
      </div>
    </AppLayout>
  );
}
