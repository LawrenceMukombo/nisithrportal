import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, FileDown, Loader2 } from "lucide-react";
import { useGetContract, useGetEmployee, useUpdateContract, getGetContractQueryKey, getGetEmployeeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/auth-context";
import { getToken } from "@/lib/api-config";
import { useQueryClient } from "@tanstack/react-query";

function RenewDialog({ contractId, currentEndDate, onClose }: { contractId: number; currentEndDate?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateContract = useUpdateContract();
  const [newEndDate, setNewEndDate] = useState(currentEndDate ?? "");

  const handleRenew = async () => {
    if (!newEndDate) {
      toast({ title: "Please enter a new end date", variant: "destructive" });
      return;
    }
    try {
      await updateContract.mutateAsync({
        id: contractId,
        data: { endDate: newEndDate, status: "active" },
      });
      queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(contractId) });
      toast({ title: "Contract renewed", description: "The contract has been renewed with the new end date." });
      onClose();
    } catch {
      toast({ title: "Renewal failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renew Contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>New End Date</Label>
            <Input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              data-testid="input-renew-end-date"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleRenew} disabled={updateContract.isPending} data-testid="button-confirm-renewal">
              {updateContract.isPending ? "Renewing..." : "Renew Contract"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({ contractId, currentStatus, onClose }: { contractId: number; currentStatus: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateContract = useUpdateContract();
  const [status, setStatus] = useState(currentStatus);

  const handleUpdate = async () => {
    try {
      await updateContract.mutateAsync({ id: contractId, data: { status } });
      queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(contractId) });
      toast({ title: "Status updated" });
      onClose();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Contract Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-contract-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateContract.isPending} data-testid="button-confirm-status">
              {updateContract.isPending ? "Saving..." : "Update Status"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractDetailPage() {
  const [match, params] = useRoute("/contracts/:id");
  const [, setLocation] = useLocation();
  const [showRenew, setShowRenew] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [contractPdfLoading, setContractPdfLoading] = useState(false);
  const { canManageContracts } = useRole();
  const { toast } = useToast();

  async function downloadContractPdf(contractId: number) {
    setContractPdfLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/pdf/contract/${contractId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast({ title: err.error ?? "Failed to generate contract PDF", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract-${contractId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Failed to generate contract PDF", variant: "destructive" });
    } finally {
      setContractPdfLoading(false);
    }
  }

  const contractId = match ? parseInt(params!.id) : 0;

  const { data: contract, isLoading } = useGetContract(contractId, {
    query: { enabled: !!contractId && !isNaN(contractId), queryKey: getGetContractQueryKey(contractId) },
  });

  const empId = contract?.employeeId ?? 0;
  const { data: employee } = useGetEmployee(empId, {
    query: { enabled: !!empId, queryKey: getGetEmployeeQueryKey(empId) },
  });

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!contract) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Contract not found.</div></AppLayout>;
  }

  const isExpiredOrExpiring = contract.status === "expired" ||
    (contract.endDate && new Date(contract.endDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contracts
        </Button>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" data-testid="heading-contract">Contract #{contract.id}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={contract.status === "active" ? "default" : contract.status === "expired" ? "destructive" : "outline"}>
              {contract.status}
            </Badge>
            {canManageContracts && (
              <>
                {(contract.status === "expired" || isExpiredOrExpiring) && (
                  <Button size="sm" variant="outline" onClick={() => setShowRenew(true)} data-testid="button-renew-contract">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renew
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowStatus(true)} data-testid="button-update-status">
                  Update Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadContractPdf(contract.id)}
                  disabled={contractPdfLoading}
                  data-testid="button-generate-contract-pdf"
                  className="border-blue-600 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500 dark:hover:bg-blue-950"
                >
                  {contractPdfLoading
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Generating...</>
                    : <><FileDown className="h-3.5 w-3.5 mr-1" />Generate Contract</>
                  }
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Contract Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee</span>
              {contract.employeeId ? (
                <Link href={`/employees/${contract.employeeId}`}>
                  <span className="text-primary hover:underline cursor-pointer">
                    {employee?.name ?? `Employee #${contract.employeeId}`}
                  </span>
                </Link>
              ) : "—"}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{contract.type?.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span>{contract.startDate ? new Date(contract.startDate).toLocaleDateString() : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span>{contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "Ongoing (Permanent)"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={contract.status === "active" ? "default" : "destructive"}>{contract.status}</Badge>
            </div>
            {contract.documentUrl && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Document</span>
                <a href={contract.documentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">
                  View Document
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {isExpiredOrExpiring && contract.status === "active" && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">Contract Expiring Soon</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  This contract expires on {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "—"}.
                </p>
              </div>
              {canManageContracts && (
                <Button size="sm" onClick={() => setShowRenew(true)} variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-200">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renew
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showRenew && (
        <RenewDialog
          contractId={contract.id}
          currentEndDate={contract.endDate}
          onClose={() => setShowRenew(false)}
        />
      )}
      {showStatus && (
        <StatusDialog
          contractId={contract.id}
          currentStatus={contract.status}
          onClose={() => setShowStatus(false)}
        />
      )}
    </AppLayout>
  );
}
