import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HeartHandshake,
  ShieldPlus,
  Coins,
  Building2,
  Users,
  CheckCircle2,
  Sparkles,
  Plus,
  ArrowRight,
  Calculator,
} from "lucide-react";
import { useGetEmployees, getGetEmployeesQueryKey } from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";

interface Benefit {
  id: number;
  name: string;
  code?: string;
  category?: "superannuation" | "medical" | "life_insurance" | "housing" | "allowance" | string;
  type?: string;
  provider?: string | null;
  description?: string | null;
  defaultCoverage?: string | null;
  taxable?: boolean;
  employerContributionPercent?: string | null;
  employeeContributionPercent?: string | null;
  employerContributionPercentage?: string | null;
  employeeContributionPercentage?: string | null;
  isStatutory?: boolean;
  isActive?: boolean;
}

interface BenefitEnrollment {
  id: number;
  employeeId: number;
  employeeName?: string;
  benefitId: number;
  benefitName: string;
  benefitCategory?: string;
  benefitType?: string;
  benefitProvider?: string;
  policyNumber: string | null;
  coverageLevel: string | null;
  dependantsCount?: number;
  employeeContribution?: string | null;
  employerContribution?: string | null;
  status: "active" | "suspended" | "cancelled" | string;
  startDate?: string;
}

export default function BenefitsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [calcSalary, setCalcSalary] = useState("75000");
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedBenefitId, setSelectedBenefitId] = useState("");
  const [coverageLevel, setCoverageLevel] = useState("Standard Employee + Dependants");
  const [dependants, setDependants] = useState("2");
  const [policyNum, setPolicyNum] = useState("");

  const { data: rawEmployees = [] } = useGetEmployees(undefined, {
    query: { queryKey: getGetEmployeesQueryKey() },
  });
  const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

  // Fetch Benefits Catalogue
  const { data: benefits = [], isLoading: isLoadingBenefits } = useQuery<Benefit[]>({
    queryKey: ["/api/benefits"],
    queryFn: async () => {
      const res = await fetch("/api/benefits", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Enrollments
  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useQuery<BenefitEnrollment[]>({
    queryKey: ["/api/benefits/enrollments"],
    queryFn: async () => {
      const res = await fetch("/api/benefits/enrollments", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Superannuation Calculator calculations
  const annualSalaryNum = parseFloat(calcSalary) || 0;
  const fortnightlySalary = annualSalaryNum / 26;
  const employeeSuperFortnight = (fortnightlySalary * 0.06).toFixed(2);
  const employerSuperFortnight = (fortnightlySalary * 0.084).toFixed(2);
  const totalSuperFortnight = (parseFloat(employeeSuperFortnight) + parseFloat(employerSuperFortnight)).toFixed(2);

  // Enroll Mutation
  const enrollMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/benefits/enrollments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to enroll in benefit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/benefits/enrollments"] });
      toast({ title: "Enrolled in Benefit", description: "Coverage details registered successfully." });
      setIsEnrollOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Enrollment Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const benefitIdToUse = selectedBenefitId || String(benefits[0]?.id || 1);
    const effectiveEmployeeId = selectedEmployeeId
      ? parseInt(selectedEmployeeId)
      : (employees[0]?.id ? employees[0].id : 1);
    enrollMutation.mutate({
      employeeId: effectiveEmployeeId,
      benefitId: parseInt(benefitIdToUse),
      policyNumber: policyNum || `NISIT-POL-${Math.floor(100000 + Math.random() * 900000)}`,
      coverageLevel,
      effectiveDate: new Date().toISOString().split("T")[0],
      dependantsCount: parseInt(dependants) || 0,
      startDate: new Date().toISOString().split("T")[0],
    });
  };

  const getBenefitIcon = (type?: string) => {
    switch (type) {
      case "superannuation":
        return <Coins className="w-5 h-5 text-amber-500" />;
      case "medical":
      case "health_insurance":
        return <HeartHandshake className="w-5 h-5 text-rose-500" />;
      case "life_insurance":
        return <ShieldPlus className="w-5 h-5 text-emerald-500" />;
      default:
        return <Building2 className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff Benefits & Welfare</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Statutory Welfare
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Nasfund superannuation, comprehensive health insurance, and institutional welfare provisions
            </p>
          </div>
          <Button onClick={() => setIsEnrollOpen(true)} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Enrol in Benefit
          </Button>
        </div>

        {/* Benefits Catalogue Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            NISIT Benefits Catalogue
          </h2>

          {isLoadingBenefits ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4"><Skeleton className="h-32 w-full" /></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {benefits.map((b) => {
                const benefitType = b.type || b.category || "welfare";
                return (
                  <Card key={b.id} className="border-border/80 hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-muted/60">
                          {getBenefitIcon(benefitType)}
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {benefitType.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm font-bold text-foreground mt-3">{b.name}</CardTitle>
                      <CardDescription className="text-xs text-primary font-medium">{b.provider || "NISIT Corporate Services"}</CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 text-xs text-muted-foreground space-y-3">
                      <p className="line-clamp-2">{b.defaultCoverage || b.description || "Institutional welfare benefit"}</p>
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                        <span>Tax Status:</span>
                        <span className="font-semibold text-foreground">{b.taxable ? "Taxable" : "Exempt"}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Enrolments & Superannuation Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Coverages */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Active Officer Enrolments
            </h2>
            {isLoadingEnrollments ? (
              <Card className="p-5"><Skeleton className="h-28 w-full" /></Card>
            ) : enrollments.length === 0 ? (
              <Card className="p-8 text-center shadow-sm">
                <HeartHandshake className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold text-foreground">No active benefit enrolments</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click 'Enrol in Benefit' to register coverage.</p>
              </Card>
            ) : (
              enrollments.map((en) => {
                const enType = en.benefitType || en.benefitCategory || "welfare";
                return (
                  <Card key={en.id} className="shadow-xs hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary mt-0.5">
                          {getBenefitIcon(enType)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{en.benefitName}</p>
                          <p className="text-xs text-muted-foreground">{en.benefitProvider || "NISIT"} • Policy: {en.policyNumber || "Standard Statutory"}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Coverage: <span className="font-medium text-foreground">{en.coverageLevel || "Standard"}</span> {en.dependantsCount ? `• ${en.dependantsCount} Dependants` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active Coverage
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1.5">Enrolled: {en.startDate}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Superannuation Calculator */}
          <Card className="bg-card border-primary/20 shadow-sm h-fit">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                Nasfund Superannuation Calculator
              </CardTitle>
              <CardDescription className="text-xs">
                PNG Statutory 6% Employee / 8.4% Employer Contribution Split
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-1 space-y-4 text-xs">
              <div>
                <label className="font-medium text-muted-foreground block mb-1">Base Annual Remuneration (PGK)</label>
                <Input
                  type="number"
                  value={calcSalary}
                  onChange={(e) => setCalcSalary(e.target.value)}
                  className="font-mono font-bold"
                />
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fortnightly Base:</span>
                  <span className="font-mono font-bold">PGK {fortnightlySalary.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Employee Deduction (6%):</span>
                  <span className="font-mono font-bold text-amber-600">PGK {employeeSuperFortnight}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Employer Contribution (8.4%):</span>
                  <span className="font-mono font-bold text-emerald-600">PGK {employerSuperFortnight}</span>
                </div>
                <div className="pt-2 border-t border-border flex items-center justify-between font-bold text-sm">
                  <span>Total Fortnightly Savings:</span>
                  <span className="font-mono text-primary">PGK {totalSuperFortnight}</span>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                * Statutory superannuation is remitted directly to the National Superannuation Fund (Nasfund) on a fortnightly payroll basis.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enroll Modal */}
        <Dialog open={isEnrollOpen} onOpenChange={setIsEnrollOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleEnrollSubmit}>
              <DialogHeader>
                <DialogTitle>Enrol in Benefit Plan</DialogTitle>
                <DialogDescription>
                  Register employee or dependants for institutional medical or insurance coverage.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Staff Member *</label>
                  <Select
                    value={selectedEmployeeId || (employees[0]?.id ? String(employees[0].id) : "")}
                    onValueChange={setSelectedEmployeeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {employees.map((emp: any) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.name} ({emp.position?.title || `Staff #${emp.id}`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Select Benefit *</label>
                  <Select value={selectedBenefitId} onValueChange={setSelectedBenefitId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose benefit scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      {benefits.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name} ({b.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Coverage Scope</label>
                  <Input value={coverageLevel} onChange={(e) => setCoverageLevel(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Registered Dependants</label>
                    <Input type="number" min="0" max="10" value={dependants} onChange={(e) => setDependants(e.target.value)} />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Membership / Policy #</label>
                    <Input placeholder="Optional" value={policyNum} onChange={(e) => setPolicyNum(e.target.value)} />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEnrollOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={enrollMutation.isPending}>
                  {enrollMutation.isPending ? "Submitting..." : "Submit Enrolment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
