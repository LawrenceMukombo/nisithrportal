import { useState } from "react";
import { Link } from "wouter";
import { Search, Plus } from "lucide-react";
import { useGetContracts, getGetContractsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expired: "destructive",
  terminated: "outline",
};

export default function ContractsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { agencyId } = useAuth();

  const contracts = useGetContracts(
    { status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getGetContractsQueryKey({ status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-contracts">Contracts</h1>
            <p className="text-sm text-muted-foreground mt-1">{contracts.data?.length ?? 0} contracts</p>
          </div>
          <Link href="/contracts/new">
            <Button data-testid="button-create-contract">
              <Plus className="h-4 w-4 mr-2" /> New Contract
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {contracts.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="table-contracts">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">ID</th>
                    <th className="text-left py-3 px-4 font-medium">Employee</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Start</th>
                    <th className="text-left py-3 px-4 font-medium">End</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.data?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">No contracts found</td>
                    </tr>
                  ) : (
                    contracts.data?.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-contract-${c.id}`}>
                        <td className="py-3 px-4">
                          <Link href={`/contracts/${c.id}`}>
                            <span className="text-primary hover:underline cursor-pointer font-medium">#{c.id}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">Employee #{c.employeeId}</td>
                        <td className="py-3 px-4 capitalize text-muted-foreground">{c.type}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={STATUS_COLORS[c.status ?? "active"] ?? "default"} className="capitalize">
                            {c.status}
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
