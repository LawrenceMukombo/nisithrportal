import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft, Building2, Briefcase, Calendar, Phone, Mail, User, MapPin,
  ShieldCheck, Clock, FileText, Award, HeartHandshake, History, Edit, CheckCircle2
} from "lucide-react";
import {
  useGetEmployee, useGetContracts, useGetDepartments, useGetPositions,
  getGetEmployeeQueryKey, getGetContractsQueryKey, getGetDepartmentsQueryKey, getGetPositionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted/60">
            <TabsTrigger value="overview" className="text-xs py-2">Overview</TabsTrigger>
            <TabsTrigger value="personal" className="text-xs py-2">Personal & Demographics</TabsTrigger>
            <TabsTrigger value="emergency" className="text-xs py-2">Emergency Contacts</TabsTrigger>
            <TabsTrigger value="employment" className="text-xs py-2">Employment & Grade</TabsTrigger>
            <TabsTrigger value="history" className="text-xs py-2">Career History</TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs py-2">Contracts & Docs</TabsTrigger>
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
        </Tabs>
      </div>
    </AppLayout>
  );
}
