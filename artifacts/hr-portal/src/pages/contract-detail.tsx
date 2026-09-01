import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, FileDown, Loader2, Upload, FileText, CheckCircle2, Trash2, Eye, Pencil } from "lucide-react";
import { useGetContract, useGetEmployee, useUpdateContract, getGetContractQueryKey, getGetEmployeeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/use-auth";
import { getToken } from "@/lib/api-config";
import { useQueryClient } from "@tanstack/react-query";
import { PdfPreviewDialog } from "@/components/pdf-preview-dialog";
import { PenTool, Stamp, ShieldCheck as ShieldCheckIcon } from "lucide-react";
import {
  DigitalSignatureModal,
  type DigitalSignatureData,
} from "@/components/digital-signature-modal";

type DocDeletion = {
  id: number;
  performedByEmail: string | null;
  performedById: number | null;
  createdAt: string;
  details: { action?: string | null; previousUrl?: string | null; newUrl?: string | null; via?: string | null; reason?: string | null } | null;
};

function todayDateOnly(): string { return new Date().toISOString().slice(0, 10); }
function formatDate(value: string | null | undefined): string { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

function RenewDialog({ contractId, currentEndDate, onClose }: { contractId: number; currentEndDate?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateContract = useUpdateContract();
  const [newEndDate, setNewEndDate] = useState(currentEndDate ?? "");
  const minimumRenewalDate = (() => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().slice(0, 10);
    return currentEndDate && currentEndDate >= tomorrowString ? currentEndDate : tomorrowString;
  })();

  const handleRenew = async () => {
    if (!newEndDate) {
      toast({ title: "Please enter a new end date", variant: "destructive" });
      return;
    }
    if (newEndDate <= minimumRenewalDate) {
      toast({ title: "Choose a later renewal date", description: `The new end date must be after ${formatDate(minimumRenewalDate)}.`, variant: "destructive" });
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
              min={minimumRenewalDate}
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

function EditContractDialog({
  contract,
  onClose,
}: {
  contract: any;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateContract = useUpdateContract();

  const [type, setType] = useState(contract.type ?? "contract");
  const [startDate, setStartDate] = useState(contract.startDate ?? "");
  const [endDate, setEndDate] = useState(contract.endDate ?? "");
  const [status, setStatus] = useState(contract.status ?? "active");

  const isPermanent = type === "permanent";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      toast({ title: "Start date is required", variant: "destructive" });
      return;
    }
    if (!isPermanent && !endDate) {
      toast({ title: "End date is required for fixed-term contracts", variant: "destructive" });
      return;
    }
    if (!isPermanent && endDate <= startDate) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }

    try {
      await updateContract.mutateAsync({
        id: contract.id,
        data: {
          type,
          startDate,
          endDate: isPermanent ? null : endDate,
          status,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(contract.id) });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract updated successfully", description: "Contract terms, dates, and status saved." });
      onClose();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message ?? "Could not update contract", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit Contract #{contract.id}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div>
              <Label className="font-medium text-foreground block mb-1">Contract Type *</Label>
              <Select value={type} onValueChange={(val) => {
                setType(val);
                if (val === "permanent") setEndDate("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Fixed-Term Contract</SelectItem>
                  <SelectItem value="permanent">Permanent / Tenured</SelectItem>
                  <SelectItem value="probationary">Probationary Contract</SelectItem>
                  <SelectItem value="casual">Casual / Daily Hire</SelectItem>
                  <SelectItem value="temporary">Temporary Appointment</SelectItem>
                  <SelectItem value="consultancy">Special Consultancy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-medium text-foreground block mb-1">Start Date *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="font-medium text-foreground block mb-1">
                  End Date {!isPermanent && "*"}
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  disabled={isPermanent}
                  placeholder={isPermanent ? "Ongoing" : undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required={!isPermanent}
                />
              </div>
            </div>

            <div>
              <Label className="font-medium text-foreground block mb-1">Contract Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                  <SelectItem value="draft">Draft / Under Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateContract.isPending}>
              {updateContract.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractDetailPage() {
  const [match, params] = useRoute("/contracts/:id");
  const [, setLocation] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [contractPdfLoading, setContractPdfLoading] = useState(false);
  const [signedUploading, setSignedUploading] = useState(false);
  const [showRemoveDoc, setShowRemoveDoc] = useState(false);
  const [removingDoc, setRemovingDoc] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [docDeletions, setDocDeletions] = useState<DocDeletion[]>([]);
  const [showDigitalSign, setShowDigitalSign] = useState(false);
  const [contractSignature, setContractSignature] = useState<DigitalSignatureData | null>(null);
  const signedFileRef = useRef<HTMLInputElement>(null);
  const updateContractMutation = useUpdateContract();
  const { canManageContracts } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const refreshDocDeletions = async () => {
    if (!contractId) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/contracts/${contractId}/document-deletions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDocDeletions(await res.json() as DocDeletion[]);
      }
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    void refreshDocDeletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  async function handleRemoveSigned() {
    if (!contractId) return;
    setRemovingDoc(true);
    try {
      const trimmedReason = removeReason.trim();
      await updateContractMutation.mutateAsync({
        id: contractId,
        data: { documentUrl: null, ...(trimmedReason ? { reason: trimmedReason } : {}) },
      });
      queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(contractId) });
      toast({ title: "Signed contract removed", description: "You can now upload the correct file." });
      setShowRemoveDoc(false);
      setRemoveReason("");
      void refreshDocDeletions();
    } catch {
      toast({ title: "Failed to remove signed contract", variant: "destructive" });
    } finally {
      setRemovingDoc(false);
    }
  }

  async function handleSignedUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !contractId) return;
    setSignedUploading(true);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/contracts/${contractId}/upload-signed`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast({ title: err.error ?? "Failed to upload signed contract", variant: "destructive" });
        return;
      }
      toast({ title: "Signed contract uploaded", description: "The document has been stored against this contract." });
      queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(contractId) });
      if (signedFileRef.current) signedFileRef.current.value = "";
      void refreshDocDeletions();
    } catch {
      toast({ title: "Failed to upload signed contract", variant: "destructive" });
    } finally {
      setSignedUploading(false);
    }
  }

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

  const isPermanent = contract.type === "permanent" || !contract.endDate;
  const today = todayDateOnly();
  const isExpired = !isPermanent && (contract.status === "expired" || contract.endDate! < today);
  const isExpiringSoon = !isExpired && !isPermanent && contract.status === "active" && contract.endDate! <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const handleViewDocument = () => {
    if (contract.documentUrl && contract.documentUrl.startsWith("/api/storage/")) {
      setDocumentPreviewUrl(contract.documentUrl);
    } else {
      setShowPreview(true);
    }
  };

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
                <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} data-testid="button-edit-contract">
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Contract
                </Button>
                {!isPermanent && (isExpired || isExpiringSoon) && (
                  <Button size="sm" variant="outline" onClick={() => setShowRenew(true)} data-testid="button-renew-contract">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renew
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowStatus(true)} data-testid="button-update-status">
                  Update Status
                </Button>
                <Button
                  size="sm"
                  variant={contractSignature ? "secondary" : "outline"}
                  onClick={() => setShowDigitalSign(true)}
                  data-testid="button-sign-contract"
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500 dark:hover:bg-emerald-950"
                >
                  <PenTool className="h-3.5 w-3.5 mr-1" />
                  {contractSignature ? "Signed & Stamped" : "Digitally Sign & Stamp"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  data-testid="button-preview-contract-pdf"
                  className="border-purple-600 text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-500 dark:hover:bg-purple-950"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />Preview
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
              <span>{formatDate(contract.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span>{isPermanent ? "Ongoing (permanent)" : formatDate(contract.endDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={contract.status === "active" ? "default" : "destructive"}>{contract.status}</Badge>
            </div>
            {contract.documentUrl && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Document</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleViewDocument} data-testid="button-view-contract-document">View Document</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {canManageContracts && (
          <Card data-testid="card-upload-signed-contract">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" /> Upload Signed Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.documentUrl ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 dark:bg-green-950 dark:border-green-800 dark:text-green-300" data-testid="banner-signed-uploaded">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    {contract.documentUrl.startsWith("/api/storage/")
                      ? "Signed contract uploaded —"
                      : "Contract document on file —"}
                  </span>
                  <Button variant="link" size="sm" className="h-auto p-0 underline font-medium" onClick={handleViewDocument} data-testid="button-view-signed-contract-document">View Document</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300" data-testid="banner-signed-missing">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>No signed contract uploaded yet</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload the physically signed contract PDF to complete the document lifecycle.
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={signedFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleSignedUpload}
                  className="hidden"
                  data-testid="input-signed-contract-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={signedUploading}
                  onClick={() => signedFileRef.current?.click()}
                  data-testid="button-upload-signed-contract"
                >
                  {signedUploading
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading...</>
                    : <><Upload className="h-3.5 w-3.5 mr-1.5" />{contract.documentUrl ? "Replace Signed Contract" : "Upload Signed Contract"}</>
                  }
                </Button>
                {contract.documentUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={removingDoc}
                    onClick={() => setShowRemoveDoc(true)}
                    data-testid="button-remove-signed-contract"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remove
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG accepted</span>
              </div>
            </CardContent>
          </Card>
        )}

        {docDeletions.length > 0 && (
          <Card data-testid="card-removed-contract-documents">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" /> Document History
                <Badge variant="outline" className="ml-1 text-xs">{docDeletions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                History of when the signed contract document was cleared or replaced.
              </p>
              {docDeletions.map((entry) => {
                const action = entry.details?.action === "replaced" ? "Replaced" : "Cleared";
                const via = entry.details?.via === "upload-signed" ? " (via re-upload)" : "";
                const reason = entry.details?.reason ? String(entry.details.reason) : null;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 p-2 rounded-md border bg-muted/20"
                    data-testid={`row-contract-doc-deletion-${entry.id}`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <Trash2 className="h-4 w-4 text-destructive/70 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {action} signed document{via}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By <span className="font-medium">{entry.performedByEmail ?? "unknown user"}</span>
                        </p>
                        {reason && (
                          <p
                            className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words"
                            data-testid={`text-contract-doc-deletion-reason-${entry.id}`}
                          >
                            <span className="font-medium text-foreground">Reason:</span> {reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(entry.createdAt).toLocaleString()}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <AlertDialog
          open={showRemoveDoc}
          onOpenChange={(open) => {
            if (removingDoc) return;
            setShowRemoveDoc(open);
            if (!open) setRemoveReason("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove signed contract?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear the document attached to this contract. You can upload a replacement afterwards. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="remove-signed-contract-reason" className="text-sm font-medium">
                Reason <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                id="remove-signed-contract-reason"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="e.g. wrong file uploaded, candidate requested removal under data privacy"
                rows={3}
                maxLength={1000}
                disabled={removingDoc}
                data-testid="input-remove-signed-contract-reason"
              />
              <p className="text-xs text-muted-foreground">
                Saved alongside this entry in Document History for audit review.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removingDoc}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void handleRemoveSigned(); }}
                disabled={removingDoc}
                data-testid="button-confirm-remove-signed-contract"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removingDoc ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Removing...</> : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {(isExpired || isExpiringSoon) && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">{isExpired ? "Contract Expired" : "Contract Expiring Soon"}</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  This contract {isExpired ? "expired" : "expires"} on {formatDate(contract.endDate)}.
                </p>
              </div>
              {canManageContracts && !isPermanent && (
                <Button size="sm" onClick={() => setShowRenew(true)} variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-200">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renew
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showEdit && (
        <EditContractDialog
          contract={contract}
          onClose={() => setShowEdit(false)}
        />
      )}
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
      <PdfPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        url={`/api/pdf/contract/${contract.id}`}
        title={`Contract #${contract.id} — Preview`}
        downloadFilename={`contract-${contract.id}.pdf`}
      />
      {documentPreviewUrl && (
        <PdfPreviewDialog
          open={documentPreviewUrl != null}
          onOpenChange={(open) => { if (!open) setDocumentPreviewUrl(null); }}
          url={documentPreviewUrl}
          title={`Contract #${contract.id} — Stored document`}
          downloadFilename={`contract-${contract.id}-signed-document.pdf`}
        />
      )}
      <DigitalSignatureModal
        open={showDigitalSign}
        onOpenChange={setShowDigitalSign}
        documentTitle={`Employment Contract #${contract.id}`}
        defaultSignerName={employee?.name ?? "Authorised Officer"}
        defaultSignerTitle="Staff Signatory / HR Registrar"
        onConfirmSignature={(sig) => setContractSignature(sig)}
      />
    </AppLayout>
  );
}
