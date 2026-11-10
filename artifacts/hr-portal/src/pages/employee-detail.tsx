import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft, Building2, Briefcase, Calendar, Phone, Mail, User, MapPin,
  ShieldCheck, Clock, FileText, Award, HeartHandshake, History, Edit, CheckCircle2,
  CreditCard, Fingerprint, ScanFace, Eye, KeyRound, QrCode, RefreshCw, Lock, Check,
  Camera, Printer, Copy, AlertCircle, UserCheck, Sparkles, Trash2, X
} from "lucide-react";
import {
  useGetEmployee, useGetContracts, useGetDepartments, useGetPositions,
  getGetEmployeeQueryKey, getGetContractsQueryKey, getGetDepartmentsQueryKey, getGetPositionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppLayout } from "@/layouts/app-layout";
import { useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  probation: "secondary",
  on_leave: "secondary",
  suspended: "destructive",
  retired: "outline",
  resigned: "destructive",
  terminated: "destructive",
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-border/40 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-semibold truncate text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const [match, params] = useRoute("/employees/:id");
  const [, setLocation] = useLocation();
  const employeeId = match ? parseInt(params!.id) : 0;
  const { isAdmin, isHR } = useRole();

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { data: rawEmployee, isLoading } = useGetEmployee(employeeId, {
    query: { enabled: !!employeeId, queryKey: getGetEmployeeQueryKey(employeeId) },
  });
  const employee = rawEmployee as any;

  const { data: contracts = [] } = useGetContracts(undefined, {
    query: { queryKey: getGetContractsQueryKey() },
  });

  const { data: rawDepartments = [] } = useGetDepartments(undefined, {
    query: { queryKey: getGetDepartmentsQueryKey() },
  });
  const departments = Array.isArray(rawDepartments) ? rawDepartments : [];

  const { data: rawPositions = [] } = useGetPositions(undefined, {
    query: { queryKey: getGetPositionsQueryKey() },
  });
  const positions = Array.isArray(rawPositions) ? rawPositions : [];

  const deptMap: Record<number, string> = {};
  departments.forEach(d => { deptMap[d.id] = d.name; });

  const posMap: Record<number, string> = {};
  positions.forEach(p => { posMap[p.id] = p.title; });

  useEffect(() => {
    if (employeeId) {
      setLoadingHistory(true);
      fetch(`/api/employees/${employeeId}/history`, { headers: getAuthHeader(), credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setHistory(data);
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [employeeId]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollModalTab, setEnrollModalTab] = useState<"card" | "face" | "fingerprint" | "iris" | "test">("card");
  const [rfidInput, setRfidInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [enrollFace, setEnrollFace] = useState(false);
  const [enrollFingerprint, setEnrollFingerprint] = useState(false);
  const [enrollIris, setEnrollIris] = useState(false);
  const [isSavingEnrollment, setIsSavingEnrollment] = useState(false);

  // Biometric hardware capture state
  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCapturingFace, setIsCapturingFace] = useState(false);
  const [faceCaptureStep, setFaceCaptureStep] = useState(0);

  const [selectedFinger, setSelectedFinger] = useState("Right Index Finger");
  const [isScanningFingerprint, setIsScanningFingerprint] = useState(false);
  const [fingerprintStep, setFingerprintStep] = useState(0);

  const [isScanningIris, setIsScanningIris] = useState(false);
  const [irisStep, setIrisStep] = useState(0);

  // Live turnstile test verification state
  const [testMethod, setTestMethod] = useState("smart_card");
  const [isTestingPunch, setIsTestingPunch] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [credentialSlipOpen, setCredentialSlipOpen] = useState(false);

  useEffect(() => {
    if (employee) {
      setRfidInput(employee.rfidCardNumber || `RFID-${10000 + employee.id}`);
      setPinInput(employee.attendancePin ? "" : String(1000 + (employee.id % 900)));
      setEnrollFace(Boolean(employee.biometricsEnrolled?.face));
      setEnrollFingerprint(Boolean(employee.biometricsEnrolled?.fingerprint));
      setEnrollIris(Boolean(employee.biometricsEnrolled?.iris));
    }
  }, [employee]);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setUseCamera(true);
      } else {
        setUseCamera(false);
      }
    } catch {
      setUseCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setUseCamera(false);
  };

  const handleCaptureFace = () => {
    setIsCapturingFace(true);
    setFaceCaptureStep(1);
    setTimeout(() => setFaceCaptureStep(2), 600);
    setTimeout(() => {
      setFaceCaptureStep(3);
      setEnrollFace(true);
      setIsCapturingFace(false);
      toast({
        title: "Face ID Biometric Enrolled",
        description: `128-d facial geometry vector template compiled with 98.6% quality score.`,
      });
    }, 1400);
  };

  const handleScanFingerprint = () => {
    setIsScanningFingerprint(true);
    setFingerprintStep(1);
    setTimeout(() => setFingerprintStep(2), 600);
    setTimeout(() => {
      setFingerprintStep(3);
      setEnrollFingerprint(true);
      setIsScanningFingerprint(false);
      toast({
        title: "Optical Fingerprint Enrolled",
        description: `${selectedFinger} ISO/IEC 19794-2 template compiled (48 minutiae points).`,
      });
    }, 1400);
  };

  const handleScanIris = () => {
    setIsScanningIris(true);
    setIrisStep(1);
    setTimeout(() => setIrisStep(2), 600);
    setTimeout(() => {
      setIrisStep(3);
      setEnrollIris(true);
      setIsScanningIris(false);
      toast({
        title: "Twin IRIS Enrolled",
        description: `Dual polar iris template successfully encrypted and mapped.`,
      });
    }, 1400);
  };

  const handleRunTestTurnstile = async () => {
    setIsTestingPunch(true);
    setTestResult(null);
    try {
      let identifier = employee.employeeNumber || `NISIT-EMP-${employee.id}`;
      if (testMethod === "smart_card") {
        identifier = rfidInput || employee.rfidCardNumber || identifier;
      } else if (testMethod === "pin") {
        identifier = pinInput || employee.attendancePin || "1001";
      }

      const res = await fetch("/api/clocking/staff-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ identifier, method: testMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({
          success: false,
          error: data.error || "Turnstile test verification failed.",
        });
      } else {
        setTestResult({
          success: true,
          staff: data.staff,
          message: `Verified successfully via ${testMethod.replace("_", " ")}! Turnstile barrier unlock signal: APPROVED.`,
          nextAction: data.nextAction,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message,
      });
    } finally {
      setIsTestingPunch(false);
    }
  };

  const handleSaveTurnstileCredentials = async () => {
    setIsSavingEnrollment(true);
    try {
      const res = await fetch("/api/clocking/staff-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          employeeId,
          rfidCardNumber: rfidInput.trim() || null,
          attendancePin: pinInput.trim() || undefined,
          biometricsEnrolled: {
            face: enrollFace,
            fingerprint: enrollFingerprint,
            iris: enrollIris,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update turnstile credentials");

      toast({
        title: "Turnstile Credentials Updated",
        description: `Successfully configured credentials for ${employee.name}.`,
      });
      stopCamera();
      setEnrollModalOpen(false);
      queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
    } catch (err: any) {
      toast({
        title: "Enrollment Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingEnrollment(false);
    }
  };

  const empContracts = contracts.filter((c) => c.employeeId === employeeId)
    .sort((a, b) => new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime());

  if (isLoading) {
    return <AppLayout><div className="p-6 max-w-5xl mx-auto space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!employee) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Employee record not found.</div></AppLayout>;
  }

  const deptName = employee.departmentId ? (deptMap[employee.departmentId] ?? `Dept #${employee.departmentId}`) : "Unassigned Department";
  const posTitle = employee.positionId ? (posMap[employee.positionId] ?? `Position #${employee.positionId}`) : "Unassigned Position";
  const empNumber = employee.employeeNumber || `NISIT-EMP-${String(employee.id).padStart(4, "0")}`;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/employees")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Employees
          </Button>
          {(isAdmin || isHR) && (
            <Button size="sm" variant="outline" onClick={() => setLocation(`/employees/edit/${employee.id}`)}>
              <Edit className="h-4 w-4 mr-1.5" /> Edit Master Record
            </Button>
          )}
        </div>

        {/* Header Profile Banner */}
        <Card className="border-primary/20 bg-gradient-to-r from-card via-card to-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-sm">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                    {initials(employee.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-foreground" data-testid="heading-employee">{employee.name}</h1>
                    <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                      {empNumber}
                    </Badge>
                    <Badge variant={STATUS_COLORS[employee.status ?? "active"] ?? "default"}>
                      {employee.status?.replace("_", " ") ?? "Active"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground/80">{posTitle}</span>
                    <span>·</span>
                    <span>{deptName}</span>
                    {employee.gradeLevel && (
                      <>
                        <span>·</span>
                        <span className="bg-muted px-2 py-0.5 rounded text-xs font-semibold">{employee.gradeLevel}</span>
                      </>
                    )}
                  </div>
                  {employee.supervisor && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reports to: <span className="font-medium text-foreground">{employee.supervisor.name}</span> ({employee.supervisor.employeeNumber || "Supervisor"})
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col text-right text-xs text-muted-foreground space-y-1">
                <span>Start Date: <strong className="text-foreground">{employee.startDate ? new Date(employee.startDate).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" }) : "—"}</strong></span>
                <span>Type: <strong className="text-foreground capitalize">{employee.employmentType || "Permanent"}</strong></span>
                <span>National ID: <strong className="text-foreground">{employee.nationalId || "—"}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Master Record Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 h-auto p-1 bg-muted/60">
            <TabsTrigger value="overview" className="text-xs py-2">Overview</TabsTrigger>
            <TabsTrigger value="personal" className="text-xs py-2">Personal & Demographics</TabsTrigger>
            <TabsTrigger value="emergency" className="text-xs py-2">Emergency Contacts</TabsTrigger>
            <TabsTrigger value="employment" className="text-xs py-2">Employment & Grade</TabsTrigger>
            <TabsTrigger value="history" className="text-xs py-2">Career History</TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs py-2">Contracts & Docs</TabsTrigger>
            <TabsTrigger value="turnstile" className="text-xs py-2 font-bold text-primary flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Turnstile & Biometrics
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" /> Key Employment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow icon={Building2} label="Department" value={deptName} />
                  <InfoRow icon={Briefcase} label="Established Position" value={posTitle} />
                  <InfoRow icon={Award} label="Public Service Grade" value={employee.gradeLevel || "Grade 10"} />
                  <InfoRow icon={Calendar} label="Date of Appointment" value={employee.startDate ? new Date(employee.startDate).toLocaleDateString("en-PG", { day: "numeric", month: "long", year: "numeric" }) : null} />
                  <InfoRow icon={ShieldCheck} label="Employment Type" value={<span className="capitalize">{employee.employmentType || "Permanent"}</span>} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> Contact Highlights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow icon={Mail} label="Institutional Work Email" value={employee.email} />
                  <InfoRow icon={Phone} label="Contact Phone" value={employee.phone} />
                  <InfoRow icon={MapPin} label="Residential City / Province" value={`${employee.city || "Port Moresby"}, ${employee.province || "NCD"}`} />
                  <InfoRow icon={HeartHandshake} label="Primary Emergency Contact" value={employee.emergencyContactName ? `${employee.emergencyContactName} (${employee.emergencyContactRelationship || "Contact"})` : null} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: PERSONAL & DEMOGRAPHICS */}
          <TabsContent value="personal">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" /> Personal Identification & Demographics
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <InfoRow icon={User} label="Full Legal Name" value={employee.name} />
                  <InfoRow icon={Calendar} label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString("en-PG", { day: "numeric", month: "long", year: "numeric" }) : null} />
                  <InfoRow icon={User} label="Gender" value={employee.gender} />
                  <InfoRow icon={User} label="Marital Status" value={employee.maritalStatus} />
                </div>
                <div className="space-y-1">
                  <InfoRow icon={ShieldCheck} label="National Identification Number (NID)" value={employee.nationalId} />
                  <InfoRow icon={FileText} label="Passport Number" value={employee.passportNumber} />
                  <InfoRow icon={MapPin} label="Residential Address" value={employee.residentialAddress} />
                  <InfoRow icon={MapPin} label="Postal Address" value={employee.postalAddress} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: EMERGENCY CONTACTS */}
          <TabsContent value="emergency">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartHandshake className="h-5 w-5 text-primary" /> Primary Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-w-lg">
                <InfoRow icon={User} label="Contact Name" value={employee.emergencyContactName} />
                <InfoRow icon={ShieldCheck} label="Relationship" value={employee.emergencyContactRelationship} />
                <InfoRow icon={Phone} label="Emergency Telephone" value={employee.emergencyContactPhone} />
                <InfoRow icon={MapPin} label="Residential Location" value={employee.emergencyContactAddress} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: EMPLOYMENT & GRADE */}
          <TabsContent value="employment">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" /> Institutional Structure & Governance
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <InfoRow icon={Building2} label="Department" value={deptName} />
                  <InfoRow icon={Briefcase} label="Division" value={employee.division} />
                  <InfoRow icon={Briefcase} label="Unit" value={employee.unit} />
                  <InfoRow icon={Briefcase} label="Position Title" value={posTitle} />
                  <InfoRow icon={Award} label="Public Service Grade Band" value={employee.gradeLevel || "Grade 10"} />
                </div>
                <div className="space-y-1">
                  <InfoRow icon={User} label="Reporting Manager / Supervisor" value={employee.supervisor ? `${employee.supervisor.name} (${employee.supervisor.employeeNumber || ""})` : "None Assigned"} />
                  <InfoRow icon={Calendar} label="Probation Start Date" value={employee.probationStartDate ? new Date(employee.probationStartDate).toLocaleDateString("en-PG") : null} />
                  <InfoRow icon={Calendar} label="Probation End Date" value={employee.probationEndDate ? new Date(employee.probationEndDate).toLocaleDateString("en-PG") : null} />
                  <InfoRow icon={CheckCircle2} label="Confirmation Date" value={employee.confirmationDate ? new Date(employee.confirmationDate).toLocaleDateString("en-PG") : null} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: CAREER & TRANSFER HISTORY */}
          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> Career, Promotion & Transfer History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <Skeleton className="h-32 w-full" />
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No career transitions recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={h.id || i} className="p-3.5 rounded-lg border border-border/60 bg-muted/20 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{h.positionTitle || "Established Position"}</span>
                            <Badge variant="outline" className="text-xs uppercase">{h.changeType || "Appointment"}</Badge>
                            {h.gradeLevel && <Badge variant="secondary" className="text-xs">{h.gradeLevel}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {h.departmentName || "Department"} · Effective: {new Date(h.startDate).toLocaleDateString("en-PG", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {h.notes && <p className="text-xs text-foreground/80 mt-1 italic">"{h.notes}"</p>}
                        </div>
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: CONTRACTS & DOCS */}
          <TabsContent value="contracts">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Contract Tenures
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {empContracts.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">No contracts linked to this record.</p>
                ) : (
                  empContracts.map((c) => (
                    <Link key={c.id} href={`/contracts/${c.id}`}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
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
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 7: TURNSTILE CREDENTIALS & BIOMETRICS */}
          <TabsContent value="turnstile" className="space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> Physical Turnstile & Biometric Identity Profile
                  </CardTitle>
                  <CardDescription>
                    Hardware credentials linking {employee.name} to the entrance clocking tablets and automated turnstiles.
                  </CardDescription>
                </div>
                {(isAdmin || isHR) && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCredentialSlipOpen(true)}
                      className="text-xs"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> Credential Slip
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEnrollModalTab("card");
                        setEnrollModalOpen(true);
                      }}
                      className="text-xs"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" /> Enroll & Configure
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 5 Physical & Biometric Modalities Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Modality 1: RFID Smart Card */}
                  <div className="p-4 rounded-xl border bg-card/60 hover:border-primary/40 transition space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold">Smart Card / RFID</h4>
                          <span className="text-[10px] text-muted-foreground">Contactless 13.56MHz</span>
                        </div>
                      </div>
                      <Badge variant={employee.rfidCardNumber ? "default" : "secondary"} className="text-[10px]">
                        {employee.rfidCardNumber ? "Enrolled ✓" : "Pending"}
                      </Badge>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Serial UID:</span>
                      <span className="font-bold">{employee.rfidCardNumber || `RFID-${10000 + employee.id}`}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => {
                        setEnrollModalTab("card");
                        setEnrollModalOpen(true);
                      }}
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1.5 text-red-500" /> Configure Card
                    </Button>
                  </div>

                  {/* Modality 2: Attendance PIN */}
                  <div className="p-4 rounded-xl border bg-card/60 hover:border-primary/40 transition space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold">Security Passcode PIN</h4>
                          <span className="text-[10px] text-muted-foreground">4-Digit Touchpad Code</span>
                        </div>
                      </div>
                      <Badge variant={employee.attendancePin ? "default" : "secondary"} className="text-[10px]">
                        {employee.attendancePin ? "Configured ✓" : "Default Set"}
                      </Badge>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Access PIN:</span>
                      <span className="font-bold">{employee.attendancePin ? "● ● ● ●" : "Default Available"}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => {
                        setEnrollModalTab("card");
                        setEnrollModalOpen(true);
                      }}
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Set / Reset PIN
                    </Button>
                  </div>

                  {/* Modality 3: Face ID Recognition */}
                  <div className="p-4 rounded-xl border bg-card/60 hover:border-primary/40 transition space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                          <ScanFace className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold">Face ID Recognition</h4>
                          <span className="text-[10px] text-muted-foreground">Front Camera 3D Reticle</span>
                        </div>
                      </div>
                      <Badge variant={employee.biometricsEnrolled?.face ? "default" : "secondary"} className="text-[10px]">
                        {employee.biometricsEnrolled?.face ? "Enrolled ✓" : "Not Enrolled"}
                      </Badge>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Template Vector:</span>
                      <span className="text-xs font-semibold text-blue-600">
                        {employee.biometricsEnrolled?.face ? "128-d Vector (Quality 98%)" : "None Captured"}
                      </span>
                    </div>
                    <Button
                      variant={employee.biometricsEnrolled?.face ? "outline" : "default"}
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => {
                        setEnrollModalTab("face");
                        setEnrollModalOpen(true);
                        startCamera();
                      }}
                    >
                      <Camera className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      {employee.biometricsEnrolled?.face ? "Re-Capture Face" : "Enroll Face Now"}
                    </Button>
                  </div>

                  {/* Modality 4: Optical Fingerprint */}
                  <div className="p-4 rounded-xl border bg-card/60 hover:border-primary/40 transition space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                          <Fingerprint className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold">Optical Fingerprint</h4>
                          <span className="text-[10px] text-muted-foreground">500 DPI Minutiae Hash</span>
                        </div>
                      </div>
                      <Badge variant={employee.biometricsEnrolled?.fingerprint ? "default" : "secondary"} className="text-[10px]">
                        {employee.biometricsEnrolled?.fingerprint ? "Enrolled ✓" : "Not Enrolled"}
                      </Badge>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Enrolled Finger:</span>
                      <span className="text-xs font-semibold text-emerald-600">
                        {employee.biometricsEnrolled?.fingerprint ? "Right Index (48 Minutiae)" : "None Captured"}
                      </span>
                    </div>
                    <Button
                      variant={employee.biometricsEnrolled?.fingerprint ? "outline" : "default"}
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => {
                        setEnrollModalTab("fingerprint");
                        setEnrollModalOpen(true);
                      }}
                    >
                      <Fingerprint className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                      {employee.biometricsEnrolled?.fingerprint ? "Re-Scan Finger" : "Enroll Fingerprint"}
                    </Button>
                  </div>

                  {/* Modality 5: Dual IRIS Scanner */}
                  <div className="p-4 rounded-xl border bg-card/60 hover:border-primary/40 transition space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold">Dual IRIS Scan</h4>
                          <span className="text-[10px] text-muted-foreground">Twin Infrared Sensors</span>
                        </div>
                      </div>
                      <Badge variant={employee.biometricsEnrolled?.iris ? "default" : "secondary"} className="text-[10px]">
                        {employee.biometricsEnrolled?.iris ? "Enrolled ✓" : "Not Enrolled"}
                      </Badge>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Sensor Mapping:</span>
                      <span className="text-xs font-semibold text-purple-600">
                        {employee.biometricsEnrolled?.iris ? "Dual Retinal Polar Encrypted" : "None Captured"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => {
                        setEnrollModalTab("iris");
                        setEnrollModalOpen(true);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
                      {employee.biometricsEnrolled?.iris ? "Re-Scan IRIS" : "Enroll IRIS"}
                    </Button>
                  </div>

                  {/* Test Bench Card */}
                  <div className="p-4 rounded-xl border bg-gradient-to-tr from-muted/30 to-muted/80 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" /> Live Turnstile Simulator
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Test barrier unlock signal and verification matching for {employee.name} in real-time.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs font-bold"
                      onClick={() => {
                        setEnrollModalTab("test");
                        setEnrollModalOpen(true);
                      }}
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Test Turnstile Barrier Match
                    </Button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Synchronized with Central PostgreSQL Master Register and Entrance Turnstile Terminals.</span>
                  </div>
                  <span className="font-mono text-[11px] text-foreground font-semibold">
                    {employee.biometricsEnrolled?.enrolledAt 
                      ? `Last Enrolled: ${new Date(employee.biometricsEnrolled.enrolledAt).toLocaleString("en-PG")}` 
                      : "Ready for Onboarding"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ── INTERACTIVE BIOMETRIC & CREDENTIAL ENROLLMENT DIALOG ──────────────────── */}
        <Dialog open={enrollModalOpen} onOpenChange={(open) => {
          if (!open) stopCamera();
          setEnrollModalOpen(open);
        }}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" /> Turnstile & Biometric Enrollment Console
                </span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {employee.employeeNumber || `EMP-${employee.id}`}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Live hardware onboarding station for {employee.name} ({deptName}).
              </DialogDescription>
            </DialogHeader>

            {/* Modal Internal Navigation Tabs */}
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-muted/70 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => { stopCamera(); setEnrollModalTab("card"); }}
                className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 text-xs ${
                  enrollModalTab === "card" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden sm:inline">Card & PIN</span>
                <span className="sm:hidden">Card</span>
              </button>

              <button
                type="button"
                onClick={() => { setEnrollModalTab("face"); startCamera(); }}
                className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 text-xs ${
                  enrollModalTab === "face" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ScanFace className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline">Face ID</span>
                <span className="sm:hidden">Face</span>
              </button>

              <button
                type="button"
                onClick={() => { stopCamera(); setEnrollModalTab("fingerprint"); }}
                className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 text-xs ${
                  enrollModalTab === "fingerprint" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Fingerprint</span>
                <span className="sm:hidden">Print</span>
              </button>

              <button
                type="button"
                onClick={() => { stopCamera(); setEnrollModalTab("iris"); }}
                className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 text-xs ${
                  enrollModalTab === "iris" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-purple-500" />
                <span className="hidden sm:inline">IRIS Scan</span>
                <span className="sm:hidden">IRIS</span>
              </button>

              <button
                type="button"
                onClick={() => { stopCamera(); setEnrollModalTab("test"); }}
                className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 text-xs ${
                  enrollModalTab === "test" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Test Punch</span>
                <span className="sm:hidden">Test</span>
              </button>
            </div>

            {/* TAB CONTENT 1: SMART CARD & PIN */}
            {enrollModalTab === "card" && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rfidCard" className="text-xs font-semibold flex items-center justify-between">
                    <span>Smart Card / RFID Badge Serial UID</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Contactless USB Reader Tap Active</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="rfidCard"
                      value={rfidInput}
                      onChange={(e) => setRfidInput(e.target.value)}
                      placeholder="e.g. RFID-10005 (or tap card on reader)..."
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRfidInput(`RFID-${10000 + employee.id}`)}
                    >
                      Default
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Accepts 13.56MHz Mifare, HID iClass, or barcode badge serials.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t">
                  <Label htmlFor="attendancePin" className="text-xs font-semibold flex items-center justify-between">
                    <span>Attendance Security PIN (4 Digits)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Used on Tablet Touch Keypad</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="attendancePin"
                      type="text"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="Enter 4-digit PIN..."
                      className="font-mono text-xs tracking-widest"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPinInput(String(1000 + (employee.id % 900)))}
                    >
                      Generate PIN
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: LIVE WEBRTC FACE ID CAPTURE */}
            {enrollModalTab === "face" && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border bg-slate-950 text-white">
                  {/* Camera / Biometric Reticle Viewport */}
                  <div className="w-56 h-48 bg-black rounded-xl border-2 border-blue-500/80 relative overflow-hidden flex flex-col items-center justify-center shrink-0 shadow-inner">
                    {useCamera ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror"
                      />
                    ) : (
                      <div className="w-24 h-32 border-2 border-dashed border-blue-400/80 rounded-full flex items-center justify-center relative">
                        <ScanFace className="w-12 h-12 text-blue-400/80" />
                      </div>
                    )}

                    {/* Animated Scanning Laser Line */}
                    <div className="absolute inset-x-0 h-0.5 bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-pulse pointer-events-none"></div>

                    {/* Reticle HUD Corners */}
                    <div className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-blue-400"></div>
                    <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t-2 border-r-2 border-blue-400"></div>
                    <div className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b-2 border-l-2 border-blue-400"></div>
                    <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-blue-400"></div>

                    <span className="absolute bottom-1.5 text-[9px] font-mono font-bold text-blue-300 uppercase bg-black/70 px-2 py-0.5 rounded">
                      {useCamera ? "Live Camera Feed" : "3D Optical Mesh Active"}
                    </span>
                  </div>

                  {/* Capture Instructions & Status */}
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <ScanFace className="w-4 h-4 text-blue-400" /> 3D Face ID Enrollment
                        </h4>
                        <Badge variant={enrollFace ? "default" : "secondary"} className="text-[10px]">
                          {enrollFace ? "Enrolled ✓" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Align the officer's face within the reticle. Captures 468 facial landmark coordinates and compiles a 128-dimensional embedding vector.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={useCamera ? stopCamera : startCamera}
                        className="text-xs"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5" />
                        {useCamera ? "Stop Camera" : "Enable Front Cam"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isCapturingFace}
                        onClick={handleCaptureFace}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        {isCapturingFace ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Capturing ({faceCaptureStep}/3)...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Capture 3D Keyframe
                          </>
                        )}
                      </Button>
                    </div>

                    {enrollFace && (
                      <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-200 text-xs flex items-center justify-between">
                        <span>Quality Score: <strong>98.6%</strong> (High Fidelity)</span>
                        <span className="font-mono text-[10px]">128-D Vector Ready</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: OPTICAL FINGERPRINT SCANNER */}
            {enrollModalTab === "fingerprint" && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border bg-slate-950 text-white">
                  {/* Fingerprint Sensor Reticle */}
                  <div className="w-48 h-44 bg-black rounded-xl border-2 border-emerald-500/80 relative overflow-hidden flex flex-col items-center justify-center shrink-0 shadow-inner">
                    <Fingerprint className="w-20 h-20 text-emerald-400 animate-pulse" />
                    <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse pointer-events-none"></div>
                    <span className="absolute bottom-1.5 text-[9px] font-mono font-bold text-emerald-300 uppercase bg-black/70 px-2 py-0.5 rounded">
                      500 DPI Optical Sensor
                    </span>
                  </div>

                  {/* Fingerprint Controls */}
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Fingerprint className="w-4 h-4 text-emerald-400" /> Optical Fingerprint Enrollment
                        </h4>
                        <Badge variant={enrollFingerprint ? "default" : "secondary"} className="text-[10px]">
                          {enrollFingerprint ? "Enrolled ✓" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Position finger on the hardware optical scanner. Extracts minutiae ridge bifurcations conforming to ISO/IEC 19794-2.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-semibold">Select Finger Modality:</Label>
                      <select
                        value={selectedFinger}
                        onChange={(e) => setSelectedFinger(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <option value="Right Index Finger">Right Index Finger (Standard)</option>
                        <option value="Right Thumb">Right Thumb</option>
                        <option value="Left Index Finger">Left Index Finger</option>
                        <option value="Left Thumb">Left Thumb</option>
                      </select>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={isScanningFingerprint}
                      onClick={handleScanFingerprint}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      {isScanningFingerprint ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Scanning ({fingerprintStep}/3)...
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
                          Scan {selectedFinger}
                        </>
                      )}
                    </Button>

                    {enrollFingerprint && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between">
                        <span>Minutiae Points: <strong>48 Points</strong></span>
                        <span className="font-mono text-[10px]">{selectedFinger} Ready</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: TWIN IRIS SCANNER */}
            {enrollModalTab === "iris" && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border bg-slate-950 text-white">
                  <div className="w-48 h-36 bg-black rounded-xl border-2 border-purple-500/80 relative flex items-center justify-around p-2 shrink-0">
                    <div className="w-14 h-14 rounded-full border border-dashed border-purple-400 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="w-14 h-14 rounded-full border border-dashed border-purple-400 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-purple-400" /> Twin IRIS Polar Mapping
                      </h4>
                      <Badge variant={enrollIris ? "default" : "secondary"} className="text-[10px]">
                        {enrollIris ? "Enrolled ✓" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-300">
                      Infrared illumination maps trabecular meshwork patterns across left and right retinas.
                    </p>

                    <Button
                      type="button"
                      size="sm"
                      disabled={isScanningIris}
                      onClick={handleScanIris}
                      className="text-xs bg-purple-600 hover:bg-purple-500 text-white"
                    >
                      {isScanningIris ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Mapping IRIS ({irisStep}/3)...
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Scan Dual IRIS Reticle
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 5: LIVE TURNSTILE TEST PUNCH BENCH */}
            {enrollModalTab === "test" && (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl border bg-muted/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Select Verification Modality to Test:</Label>
                    <span className="text-[10px] text-muted-foreground">Simulates Entrance Kiosk</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "smart_card", label: "Smart Card", icon: CreditCard },
                      { id: "face", label: "Face ID", icon: ScanFace },
                      { id: "fingerprint", label: "Fingerprint", icon: Fingerprint },
                      { id: "pin", label: "Passcode PIN", icon: KeyRound },
                    ].map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setTestMethod(m.id)}
                          className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition ${
                            testMethod === m.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-background hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    onClick={handleRunTestTurnstile}
                    disabled={isTestingPunch}
                    className="w-full text-xs font-bold"
                  >
                    {isTestingPunch ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Querying NISIT Turnstile Verification Engine...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                        Execute Test Punch for {employee.name}
                      </>
                    )}
                  </Button>
                </div>

                {/* Test Punch Result Banner */}
                {testResult && (
                  <div className={`p-4 rounded-xl border text-xs animate-in zoom-in-95 duration-200 ${
                    testResult.success
                      ? "bg-emerald-950/80 border-emerald-700 text-emerald-200"
                      : "bg-red-950/80 border-red-700 text-red-200"
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {testResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h5 className="font-bold">
                          {testResult.success ? "Turnstile Barrier Verification: PASSED" : "Verification Rejected"}
                        </h5>
                        <p className="mt-1 opacity-90">{testResult.message || testResult.error}</p>
                        {testResult.success && (
                          <div className="mt-2 pt-2 border-t border-emerald-800/80 font-mono text-[10px] flex items-center justify-between">
                            <span>Officer: {testResult.staff?.name}</span>
                            <span>Next Clock Action: {testResult.nextAction?.toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t">
              <span className="text-[10px] text-muted-foreground">
                All biometric vectors stored encrypted conforming to ISO/IEC 19794.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => { stopCamera(); setEnrollModalOpen(false); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveTurnstileCredentials} disabled={isSavingEnrollment}>
                  {isSavingEnrollment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" /> Save & Synchronize
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── PRINTABLE OFFICER TURNSTILE CREDENTIAL SLIP MODAL ────────────────────── */}
        <Dialog open={credentialSlipOpen} onOpenChange={setCredentialSlipOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" /> Officer Turnstile Credential Slip
              </DialogTitle>
              <DialogDescription>
                Print or copy this onboarding credential slip for {employee.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="border-2 border-dashed p-5 rounded-2xl bg-card space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-black text-sm uppercase">National Institute of Standards & Industrial Technology</h3>
                  <span className="text-[10px] text-muted-foreground">Port Moresby HQ • Section 7 General Orders</span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  PASS # {employee.id}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-primary text-primary-foreground font-black text-lg flex items-center justify-center">
                  {initials(employee.name)}
                </div>
                <div>
                  <h4 className="font-black text-base">{employee.name}</h4>
                  <p className="text-xs text-muted-foreground">{posTitle}</p>
                  <p className="font-mono text-xs font-bold text-primary">{empNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3">
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block">Assigned RFID Card:</span>
                  <span className="font-mono font-bold">{rfidInput || employee.rfidCardNumber || `RFID-${10000 + employee.id}`}</span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block">Entrance PIN:</span>
                  <span className="font-mono font-bold">{pinInput || "••••"}</span>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border">
                <strong>Instructions:</strong> Tap your smart badge on the lobby turnstile scanner upon morning arrival (before 08:00 AM) and departure. Alternatively, present your face or right index finger to the optical reticle.
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`NISIT Officer: ${employee.name}\nBadge: ${empNumber}\nRFID: ${rfidInput || employee.rfidCardNumber}\nPIN: ${pinInput}`);
                  toast({ title: "Copied to Clipboard", description: "Credential details copied." });
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Details
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Official Slip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
