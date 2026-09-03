import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileBadge,
  Printer,
  Copy,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  PenTool,
  Stamp,
  Award,
  Lock,
  UserCheck,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DigitalSignatureModal,
  DocumentOfficialStampBlock,
  type DigitalSignatureData,
} from "@/components/digital-signature-modal";

interface LetterRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  letterType: string;
  addressee: string;
  purpose: string;
  status: "pending" | "pending_signature" | "generated" | "signed_and_stamped" | "rejected";
  generatedLetterContent: string | null;
  generatedAt: string | null;
  signatoryUserId: number | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  signedAt: string | null;
  signatureDataUrl: string | null;
  verificationRef: string | null;
  isStamped: boolean;
  createdAt: string;
}

interface AuthorizedSignatory {
  id: string;
  userId?: number;
  name: string;
  title: string;
  department: string;
  email: string;
  authorityLevel: string;
  canSignContracts: boolean;
  canSignOfficialLetters: boolean;
  canAffixSeal: boolean;
}

export default function HRLettersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR, isExecutive } = useRole();
  const { user, role } = useAuth();

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<LetterRequest | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedSignatoryId, setSelectedSignatoryId] = useState<string>("director_corp_hr");
  const [letterType, setLetterType] = useState("employment_confirmation");
  const [addressee, setAddressee] = useState("Bank of South Pacific (BSP) Credit Assessment");
  const [purpose, setPurpose] = useState("Mortgage / Home loan assessment and employment verification");

  const [activePreview, setActivePreview] = useState<string | null>(null);

  // Fetch Authorized Signatories (Senior Officers)
  const { data: authorizedSignatories = [] } = useQuery<AuthorizedSignatory[]>({
    queryKey: ["/api/hr-letters/authorized-signatories"],
    queryFn: async () => {
      const res = await fetch("/api/hr-letters/authorized-signatories", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Employees List
  const { data: employees = [] } = useQuery<Array<{ id: number; name: string; email?: string; positionTitle?: string; departmentName?: string }>>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => ({
        value: String(emp.id),
        label: `${emp.name} ${emp.positionTitle ? `(${emp.positionTitle})` : ""}`,
        searchTerms: `${emp.name} ${(emp as any).employeeNumber || ""} ${emp.positionTitle || ""} ${emp.departmentName || ""} ${emp.email || ""}`,
      })),
    [employees]
  );

  // Auto select matching employee or first employee
  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      const matched = employees.find((e) => e.email?.toLowerCase() === user?.email?.toLowerCase());
      setSelectedEmployeeId(String(matched ? matched.id : employees[0].id));
    }
  }, [employees, user, selectedEmployeeId]);

  // Fetch Requests
  const { data: requests = [], isLoading } = useQuery<LetterRequest[]>({
    queryKey: ["/api/hr-letters"],
    queryFn: async () => {
      const res = await fetch("/api/hr-letters", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Sync first request to preview if none selected
  useEffect(() => {
    if (!selectedRequest && requests.length > 0) {
      setSelectedRequest(requests[0]);
      if (requests[0].generatedLetterContent) {
        setActivePreview(requests[0].generatedLetterContent);
      }
    }
  }, [requests, selectedRequest]);

  // Request Letter Mutation
  const requestMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/hr-letters/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr-letters"] });
      toast({
        title: "Letter Requested & Routed",
        description: "Official request assigned to designated Senior Signatory for verification.",
      });
      setIsRequestOpen(false);
      const empId = selectedEmployeeId ? parseInt(selectedEmployeeId) : (employees[0]?.id || 1);
      // Auto generate instant template content
      generateMutation.mutate({
        requestId: data.id,
        employeeId: empId,
        letterType,
        addressee,
        purpose,
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Generate Letter Mutation
  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/hr-letters/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate letter");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr-letters"] });
      setActivePreview(data.letterContent);
      toast({ title: "Letter Generated", description: "Official NISIT HR letter is ready for senior signature." });
    },
    onError: (err: any) => {
      toast({ title: "Letter Generation Error", description: err.message, variant: "destructive" });
    },
  });

  // Strict Anti-Forgery Sign & Stamp Mutation
  const signLetterMutation = useMutation({
    mutationFn: async ({ requestId, sigData }: { requestId: number; sigData: DigitalSignatureData }) => {
      const res = await fetch(`/api/hr-letters/${requestId}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          signatureDataUrl: sigData.signatureImage,
          signatoryName: sigData.signerName,
          signatoryTitle: sigData.signerTitle,
          isStamped: sigData.withOfficialStamp,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to execute digital signature");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr-letters"] });
      if (selectedRequest) {
        setSelectedRequest({
          ...selectedRequest,
          status: "signed_and_stamped",
          signedAt: new Date().toISOString(),
          signatureDataUrl: data.data.signatureDataUrl,
          verificationRef: data.data.verificationRef,
          isStamped: true,
        });
      }
      toast({
        title: "Official Document Signed & Stamped",
        description: "Authenticated with the official NISIT statutory seal.",
      });
      setIsSignModalOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Signing & Authorization Error", description: err.message, variant: "destructive" });
    },
  });

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const empId = selectedEmployeeId ? parseInt(selectedEmployeeId) : (employees[0]?.id || 1);
    const chosenSignatory = authorizedSignatories.find((s) => s.id === selectedSignatoryId);

    requestMutation.mutate({
      employeeId: empId,
      letterType,
      addressee,
      purpose,
      signatoryUserId: chosenSignatory?.userId,
      signatoryName: chosenSignatory?.name,
      signatoryTitle: chosenSignatory?.title,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to Clipboard", description: "Letter content copied to clipboard." });
  };

  // Determine if the current authenticated user has authority to sign the selected letter
  const isExecutiveOrHrDirector = isExecutive || isHR || role === "executive" || role === "hr_manager";
  const isAssignedSignatoryUser = selectedRequest?.signatoryUserId != null && selectedRequest.signatoryUserId === user?.userId;
  const canSignCurrentDocument = isExecutiveOrHrDirector || isAssignedSignatoryUser;

  // Prepare signature data object for stamp block rendering
  const activeSignatureBlockData: DigitalSignatureData | null = selectedRequest?.signatureDataUrl
    ? {
        signatureImage: selectedRequest.signatureDataUrl,
        signerName: selectedRequest.signatoryName || "Lawrence Mukombo",
        signerTitle: selectedRequest.signatoryTitle || "Director of Human Resources & Corporate Services",
        signedAt: selectedRequest.signedAt || new Date().toISOString(),
        verificationCode: selectedRequest.verificationRef || `NISIT-SIG-AUTH-${new Date().getFullYear()}`,
        withOfficialStamp: selectedRequest.isStamped,
        signatureType: "drawn",
      }
    : null;

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Official HR Letter Generator</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Statutory Governance &amp; Signing Workflow
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Generate standardized confirmation of employment, remuneration verification, and statutory certificates with official Senior Officer signatures.
            </p>
          </div>
          <Button onClick={() => setIsRequestOpen(true)} className="shadow-sm" data-testid="btn-request-letter">
            <Plus className="w-4 h-4 mr-2" />
            Request New HR Letter
          </Button>
        </div>

        {/* Governance & Senior Signatories Banner */}
        <div className="p-4 bg-muted/40 border border-border/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Statutory Signing &amp; Anti-Forgery Policy</p>
              <p className="text-muted-foreground mt-0.5">
                Official NISIT seals and signatures can only be executed by designated Senior Officers (Executive Director, Corporate Services Director, Registrar). Admins cannot forge or sign on behalf.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="font-mono text-[10px]">
              <Lock className="w-3 h-3 mr-1 text-primary" /> RBAC Enforced
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Issued & Requested Letters */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Letter Requests &amp; History
            </h2>

            {isLoading ? (
              <Card className="p-4"><Skeleton className="h-32 w-full" /></Card>
            ) : requests.length === 0 ? (
              <Card className="p-8 text-center shadow-sm">
                <FileBadge className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold text-foreground">No HR letters issued yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click 'Request New HR Letter' to create one.</p>
              </Card>
            ) : (
              requests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                const isSigned = req.status === "signed_and_stamped";

                return (
                  <Card
                    key={req.id}
                    className={`shadow-xs transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary ring-1 ring-primary/30 bg-primary/5 dark:bg-primary/10"
                        : "hover:border-primary/40"
                    }`}
                    onClick={() => {
                      setSelectedRequest(req);
                      if (req.generatedLetterContent) setActivePreview(req.generatedLetterContent);
                    }}
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-xs text-foreground uppercase tracking-wide">
                          {req.letterType.replace(/_/g, " ")}
                        </p>
                        <Badge
                          variant={isSigned ? "default" : req.status === "generated" ? "secondary" : "outline"}
                          className={`text-[10px] ${
                            isSigned ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                          }`}
                        >
                          {isSigned ? "Signed & Stamped" : req.status === "generated" ? "Draft Ready" : "Awaiting Signatory"}
                        </Badge>
                      </div>

                      <div className="text-xs space-y-0.5">
                        <p className="text-muted-foreground">
                          <span className="font-semibold text-foreground">Employee:</span> {req.employeeName || `Staff #${req.employeeId}`}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-semibold text-foreground">To:</span> {req.addressee}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <UserCheck className="w-3 h-3 text-primary" />
                          <span>Signatory: {req.signatoryName || "Corporate Services Director"}</span>
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="w-full text-xs h-7 mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(req);
                          if (req.generatedLetterContent) setActivePreview(req.generatedLetterContent);
                        }}
                      >
                        {isSelected ? "Currently Viewing" : "View Official Letter"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Right Column: Official Letter Preview */}
          <div className="lg:col-span-2">
            <Card className="shadow-md border-primary/20 min-h-[500px] flex flex-col justify-between">
              <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-bold">Official Document Preview</CardTitle>
                      <CardDescription className="text-xs">
                        Standard statutory letterhead with official PNG NISIT emblem, verification stamp, and digital signature
                      </CardDescription>
                    </div>
                  </div>

                  {activePreview && selectedRequest && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Signing Workflow Button */}
                      {selectedRequest.status === "signed_and_stamped" ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 py-1.5 px-3 flex items-center gap-1.5 text-xs">
                          <FileCheck2 className="w-3.5 h-3.5" />
                          Authenticated &amp; Stamped
                        </Badge>
                      ) : canSignCurrentDocument ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setIsSignModalOpen(true)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          data-testid="btn-sign-letter"
                        >
                          <PenTool className="w-3.5 h-3.5 mr-1" />
                          Digitally Sign &amp; Stamp
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs py-1.5 px-2.5 text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-600" />
                          Awaiting {selectedRequest.signatoryName || "Senior Officer"}'s Signature
                        </Badge>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(activePreview)}
                        className="text-xs"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                      </Button>
                      <Button size="sm" onClick={() => window.print()} className="text-xs" data-testid="btn-print-letter">
                        <Printer className="w-3.5 h-3.5 mr-1" /> Print / Export PDF
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 flex-1 bg-card">
                {!activePreview ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <FileBadge className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-semibold text-foreground">No Document Selected</p>
                    <p className="text-xs max-w-sm mt-1">
                      Request a letter or click on any generated item from the left queue to preview the formatted statutory letter.
                    </p>
                  </div>
                ) : (
                  <div className="p-8 bg-background rounded-xl border border-border/80 shadow-sm font-serif text-sm leading-relaxed text-foreground space-y-6">
                    {/* Standard Government Letterhead Header with REAL NISIT Logo */}
                    <div className="border-b-2 border-[#c0a030] pb-4 space-y-2 text-center bg-gradient-to-r from-blue-900/5 via-amber-500/5 to-blue-900/5 p-4 rounded-lg">
                      <div className="flex items-center justify-center gap-4">
                        <img
                          src="/nisit-logo.png"
                          alt="PNG NISIT Official Seal"
                          className="w-16 h-16 object-contain shrink-0 drop-shadow-xs"
                        />
                        <div className="text-left sm:text-center">
                          <p className="text-xs font-bold tracking-wider text-[#003082] dark:text-blue-400 uppercase">
                            Government of Papua New Guinea
                          </p>
                          <p className="text-sm sm:text-base font-extrabold tracking-tight text-foreground uppercase font-sans">
                            National Institute of Standards &amp; Industrial Technology
                          </p>
                          <p className="text-[10px] text-muted-foreground font-sans">
                            P.O. Box 1071, Port Moresby, National Capital District · Papua New Guinea
                          </p>
                        </div>
                      </div>
                      <div className="h-0.5 bg-[#c0a030] w-full mt-2" />
                    </div>

                    {/* Letter Content */}
                    <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed">
                      {activePreview}
                    </div>

                    {/* Official Stamp & Signatory Block */}
                    <DocumentOfficialStampBlock signatureData={activeSignatureBlockData} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Digital Signature Modal */}
        {selectedRequest && (
          <DigitalSignatureModal
            open={isSignModalOpen}
            onOpenChange={setIsSignModalOpen}
            documentTitle={`Official HR Letter #${selectedRequest.id} — ${selectedRequest.letterType.replace(/_/g, " ")}`}
            defaultSignerName={selectedRequest.signatoryName || user?.name || "Lawrence Mukombo"}
            defaultSignerTitle={selectedRequest.signatoryTitle || "Director of Corporate Services & Human Resources"}
            onConfirmSignature={(sig) => {
              signLetterMutation.mutate({
                requestId: selectedRequest.id,
                sigData: sig,
              });
            }}
          />
        )}

        {/* Request Modal */}
        <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleRequestSubmit}>
              <DialogHeader>
                <DialogTitle>Request Official HR Letter</DialogTitle>
                <DialogDescription>
                  Corporate Services will generate an authenticated letter and route it to the designated Senior Signatory.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                {(isAdmin || isHR) && employees.length > 0 && (
                  <div>
                    <label className="font-medium text-foreground block mb-1">Employee / Staff Member *</label>
                    <SearchableSelect
                      value={selectedEmployeeId}
                      onValueChange={setSelectedEmployeeId}
                      options={employeeOptions}
                      placeholder="Search or select employee..."
                      searchPlaceholder="Search staff by name or position..."
                      data-testid="select-letter-employee"
                    />
                  </div>
                )}

                <div>
                  <label className="font-medium text-foreground block mb-1">Letter Type *</label>
                  <Select value={letterType} onValueChange={setLetterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Letter type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employment_confirmation">Certificate of Employment</SelectItem>
                      <SelectItem value="salary_confirmation">Confirmation of Remuneration / Salary (Banking &amp; Loan)</SelectItem>
                      <SelectItem value="service_certificate">Certificate of Service</SelectItem>
                      <SelectItem value="visa_support">Visa &amp; Travel Support Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">
                    Designated Authorized Senior Signatory *
                  </label>
                  <Select value={selectedSignatoryId} onValueChange={setSelectedSignatoryId}>
                    <SelectTrigger data-testid="select-letter-signatory">
                      <SelectValue placeholder="Select Senior Signatory" />
                    </SelectTrigger>
                    <SelectContent>
                      {authorizedSignatories.map((sig) => (
                        <SelectItem key={sig.id} value={sig.id}>
                          {sig.name} — {sig.title} ({sig.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Anti-Forgery Rule: Only the chosen authorized officer can sign and stamp this official document.
                  </p>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Addressee / Recipient *</label>
                  <Input
                    placeholder="e.g. Bank of South Pacific / ANZ / High Commission"
                    value={addressee}
                    onChange={(e) => setAddressee(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Purpose / Reason *</label>
                  <Textarea
                    placeholder="Provide specific purpose and any special particulars required..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsRequestOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={requestMutation.isPending}>
                  {requestMutation.isPending ? "Submitting Request..." : "Request & Route Letter"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
