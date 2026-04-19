import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Search, Plus, FileText } from "lucide-react";
import { useGetContracts, useGetEmployees, getGetContractsQueryKey, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function ContractsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
    if (!q) return contracts;
    return contracts.filter((c) => {
      const empName = c.employeeId ? (empMap[c.employeeId] ?? "").toLowerCase() : "";
      return empName.includes(q) || String(c.id).includes(q) || (c.type ?? "").toLowerCase().includes(q);
    });
  }, [contracts, search, empMap]);

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

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No contracts found</p>
                <p className="text-xs mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="table-contracts">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Contract</th>
                    <th className="text-left py-3 px-4 font-medium">Employee</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Period</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-contract-${c.id}`}>
                      <td className="py-3 px-4">
                        <Link href={`/contracts/${c.id}`}>
                          <span className="text-primary hover:underline cursor-pointer font-medium">Contract #{c.id}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        {c.employeeId ? (
                          <Link href={`/employees/${c.employeeId}`}>
                            <span className="hover:underline cursor-pointer">
                              {empMap[c.employeeId] ?? `Employee #${c.employeeId}`}
                            </span>
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground capitalize">
                        {CONTRACT_TYPE_LABEL[c.type ?? ""] ?? c.type ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        <span>{c.startDate ? new Date(c.startDate).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                        <span className="mx-1">–</span>
                        <span>{c.endDate ? new Date(c.endDate).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "ongoing"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={STATUS_COLORS[c.status ?? "active"] ?? "default"} className="capitalize">
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
