import { useState, useEffect } from "react";
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
  status: "pending" | "generated" | "rejected";
  generatedLetterContent: string | null;
  generatedAt: string | null;
  createdAt: string;
}

export default function HRLettersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR } = useRole();
  const { user } = useAuth();

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<DigitalSignatureData | null>(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [letterType, setLetterType] = useState("employment_confirmation");
  const [addressee, setAddressee] = useState("Bank of South Pacific (BSP) Credit Assessment");
  const [purpose, setPurpose] = useState("Mortgage / Home loan assessment and employment verification");

  const [activePreview, setActivePreview] = useState<string | null>(null);

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
      toast({ title: "Letter Requested", description: "HR Corporate Services will review and issue your official document." });
      setIsRequestOpen(false);
      const empId = selectedEmployeeId ? parseInt(selectedEmployeeId) : (employees[0]?.id || 1);
      // Auto generate instant draft
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
      toast({ title: "Letter Generated", description: "Official NISIT HR letter is ready for printing/export." });
    },
    onError: (err: any) => {
      toast({ title: "Letter Generation Error", description: err.message, variant: "destructive" });
    },
  });

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const empId = selectedEmployeeId ? parseInt(selectedEmployeeId) : (employees[0]?.id || 1);
    requestMutation.mutate({
      employeeId: empId,
      letterType,
      addressee,
      purpose,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to Clipboard", description: "Letter content copied to clipboard." });
  };

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
                Automated Documents
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Generate standardized confirmation of employment, remuneration verification, and service certificates
            </p>
          </div>
          <Button onClick={() => setIsRequestOpen(true)} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Request New HR Letter
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Issued & Requested Letters */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Letter Requests & History
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
              requests.map((req) => (
                <Card
                  key={req.id}
                  className="shadow-xs hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => req.generatedLetterContent && setActivePreview(req.generatedLetterContent)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-xs text-foreground uppercase tracking-wide">
                        {req.letterType.replace(/_/g, " ")}
                      </p>
                      <Badge
                        variant={req.status === "generated" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {req.status === "generated" ? "Ready" : "Pending"}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">To:</span> {req.addressee}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      Purpose: {req.purpose}
                    </p>

                    {req.generatedLetterContent && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7 mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePreview(req.generatedLetterContent);
                        }}
                      >
                        View Official Letter
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
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
                        Standard statutory format with official NISIT emblem, seal, and digital signature
                      </CardDescription>
                    </div>
                  </div>

                  {activePreview && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={signatureData ? "secondary" : "default"}
                        onClick={() => setIsSignModalOpen(true)}
                        className="text-xs"
                        data-testid="btn-sign-letter"
                      >
                        <PenTool className="w-3.5 h-3.5 mr-1" />
                        {signatureData ? "Signed & Stamped" : "Digitally Sign & Stamp"}
                      </Button>
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
                    {/* Standard Government Letterhead Header */}
                    <div className="border-b-2 border-[#c0a030] pb-4 space-y-2 text-center bg-gradient-to-r from-blue-900/5 via-amber-500/5 to-blue-900/5 p-4 rounded-lg">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#003082] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                          NISIT
                        </div>
                        <div>
                          <p className="text-xs font-bold tracking-wider text-[#003082] uppercase">
                            Government of Papua New Guinea
                          </p>
                          <p className="text-sm font-extrabold tracking-tight text-foreground uppercase">
                            National Institute of Standards &amp; Industrial Technology
                          </p>
                          <p className="text-[10px] text-muted-foreground">
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
                    <DocumentOfficialStampBlock signatureData={signatureData} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Digital Signature Modal */}
        <DigitalSignatureModal
          open={isSignModalOpen}
          onOpenChange={setIsSignModalOpen}
          documentTitle="Official HR Verification Letter"
          onConfirmSignature={(sig) => setSignatureData(sig)}
        />

        {/* Request Modal */}
        <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleRequestSubmit}>
              <DialogHeader>
                <DialogTitle>Request Official HR Letter</DialogTitle>
                <DialogDescription>
                  Corporate Services will generate an authenticated letter with digital verification.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                {(isAdmin || isHR) && employees.length > 0 && (
                  <div>
                    <label className="font-medium text-foreground block mb-1">Employee / Staff Member *</label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger data-testid="select-letter-employee">
                        <SelectValue placeholder="Select Employee" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.name} {emp.positionTitle ? `(${emp.positionTitle})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <SelectItem value="salary_confirmation">Confirmation of Remuneration / Salary (Banking & Loan)</SelectItem>
                      <SelectItem value="service_certificate">Certificate of Service</SelectItem>
                      <SelectItem value="visa_support">Visa & Travel Support Letter</SelectItem>
                    </SelectContent>
                  </Select>
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
                  {requestMutation.isPending ? "Generating..." : "Generate Letter"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
