import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Building2,
  History,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  Lock,
  Mail,
  MailCheck,
  Send,
  Loader2,
  AlertTriangle,
  Award,
  PieChart as PieChartIcon,
  Play,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader, getToken } from "@/lib/api-config";
import { PeriodStatementView } from "@/components/payroll/period-statement-view";

export interface PayGradeScale {
  grade: string;
  level: number;
  title: string;
  annualBaseSalary: number;
  fortnightlyBase: number;
  hourlyRate: number;
  minSalary: number;
  maxSalary: number;
  defaultHousing: number;
  defaultUtility: number;
  defaultTransport: number;
  defaultRepresentation: number;
}

export const PNG_PAY_GRADE_SCALES: Record<string, PayGradeScale> = {
  "Grade 10": {
    grade: "Grade 10",
    level: 10,
    title: "Junior Technical / Administrative Officer",
    annualBaseSalary: 42000,
    fortnightlyBase: 1615.38,
    hourlyRate: 20.19,
    minSalary: 38000,
    maxSalary: 46000,
    defaultHousing: 350,
    defaultUtility: 100,
    defaultTransport: 120,
    defaultRepresentation: 0,
  },
  "Grade 11": {
    grade: "Grade 11",
    level: 11,
    title: "Technical Officer / Standards Analyst",
    annualBaseSalary: 48000,
    fortnightlyBase: 1846.15,
    hourlyRate: 23.08,
    minSalary: 44000,
    maxSalary: 52000,
    defaultHousing: 350,
    defaultUtility: 120,
    defaultTransport: 150,
    defaultRepresentation: 0,
  },
  "Grade 12": {
    grade: "Grade 12",
    level: 12,
    title: "Senior Inspector / Standards Officer",
    annualBaseSalary: 54000,
    fortnightlyBase: 2076.92,
    hourlyRate: 25.96,
    minSalary: 50000,
    maxSalary: 58000,
    defaultHousing: 400,
    defaultUtility: 120,
    defaultTransport: 150,
    defaultRepresentation: 0,
  },
  "Grade 13": {
    grade: "Grade 13",
    level: 13,
    title: "Senior Technical Officer / Metrologist",
    annualBaseSalary: 60000,
    fortnightlyBase: 2307.69,
    hourlyRate: 28.85,
    minSalary: 56000,
    maxSalary: 64000,
    defaultHousing: 450,
    defaultUtility: 140,
    defaultTransport: 180,
    defaultRepresentation: 0,
  },
  "Grade 14": {
    grade: "Grade 14",
    level: 14,
    title: "Standards Lead / Principal Officer",
    annualBaseSalary: 68000,
    fortnightlyBase: 2615.38,
    hourlyRate: 32.69,
    minSalary: 63000,
    maxSalary: 73000,
    defaultHousing: 500,
    defaultUtility: 150,
    defaultTransport: 200,
    defaultRepresentation: 0,
  },
  "Grade 15": {
    grade: "Grade 15",
    level: 15,
    title: "Chief Technical Specialist / QA Lead",
    annualBaseSalary: 76000,
    fortnightlyBase: 2923.08,
    hourlyRate: 36.54,
    minSalary: 70000,
    maxSalary: 82000,
    defaultHousing: 550,
    defaultUtility: 160,
    defaultTransport: 220,
    defaultRepresentation: 0,
  },
  "Grade 16": {
    grade: "Grade 16",
    level: 16,
    title: "Division Manager / Assistant Director",
    annualBaseSalary: 85000,
    fortnightlyBase: 3269.23,
    hourlyRate: 40.87,
    minSalary: 78000,
    maxSalary: 92000,
    defaultHousing: 600,
    defaultUtility: 180,
    defaultTransport: 250,
    defaultRepresentation: 0,
  },
  "Grade 17": {
    grade: "Grade 17",
    level: 17,
    title: "Deputy Director / Senior Manager",
    annualBaseSalary: 98000,
    fortnightlyBase: 3769.23,
    hourlyRate: 47.12,
    minSalary: 90000,
    maxSalary: 105000,
    defaultHousing: 700,
    defaultUtility: 200,
    defaultTransport: 280,
    defaultRepresentation: 200,
  },
  "Grade 18": {
    grade: "Grade 18",
    level: 18,
    title: "Director / Executive General Manager",
    annualBaseSalary: 110000,
    fortnightlyBase: 4230.77,
    hourlyRate: 52.88,
    minSalary: 102000,
    maxSalary: 120000,
    defaultHousing: 750,
    defaultUtility: 200,
    defaultTransport: 300,
    defaultRepresentation: 400,
  },
  "Grade 19": {
    grade: "Grade 19",
    level: 19,
    title: "Deputy Managing Director / Registrar",
    annualBaseSalary: 125000,
    fortnightlyBase: 4807.69,
    hourlyRate: 60.10,
    minSalary: 115000,
    maxSalary: 138000,
    defaultHousing: 850,
    defaultUtility: 250,
    defaultTransport: 350,
    defaultRepresentation: 500,
  },
  "Grade 20": {
    grade: "Grade 20",
    level: 20,
    title: "Managing Director / Director General",
    annualBaseSalary: 145000,
    fortnightlyBase: 5576.92,
    hourlyRate: 69.71,
    minSalary: 130000,
    maxSalary: 160000,
    defaultHousing: 1000,
    defaultUtility: 300,
    defaultTransport: 400,
    defaultRepresentation: 600,
  },
};

export function getPayGradeScale(grade?: string | null): PayGradeScale {
  if (!grade) return PNG_PAY_GRADE_SCALES["Grade 10"];
  const cleanGrade = grade.trim();
  if (PNG_PAY_GRADE_SCALES[cleanGrade]) {
    return PNG_PAY_GRADE_SCALES[cleanGrade];
  }
  const numMatch = cleanGrade.match(/\d+/);
  if (numMatch) {
    const key = `Grade ${numMatch[0]}`;
    if (PNG_PAY_GRADE_SCALES[key]) return PNG_PAY_GRADE_SCALES[key];
  }
  if (cleanGrade.toLowerCase().includes("director") || cleanGrade.toLowerCase().includes("executive")) {
    return PNG_PAY_GRADE_SCALES["Grade 18"];
  }
  if (cleanGrade.toLowerCase().includes("manager")) {
    return PNG_PAY_GRADE_SCALES["Grade 16"];
  }
  if (cleanGrade.toLowerCase().includes("senior") || cleanGrade.toLowerCase().includes("lead")) {
    return PNG_PAY_GRADE_SCALES["Grade 14"];
  }
  return PNG_PAY_GRADE_SCALES["Grade 10"];
}

interface PayrollPeriod {
  id: number;
  agencyId: number;
  periodCode: string;
  name: string;
  cycleType: string;
  year: number;
  periodNumber: number;
  startDate: string;
  endDate: string;
  payDate: string;
  status: "draft" | "calculating" | "pending_review" | "approved" | "disbursed" | "locked" | string;
  totalGross: string;
  totalTaxable: string;
  totalIrcTax: string;
  totalSuperEmployee: string;
  totalSuperEmployer: string;
  totalAllowances: string;
  totalDeductions: string;
  totalNet: string;
  employeeCount: number;
  currency: string;
  notes?: string;
  approvedAt?: string;
  disbursedAt?: string;
}

interface PayrollItem {
  id: number;
  periodId: number;
  employeeId: number;
  payslipNumber: string;
  baseSalary: string;
  regularHoursWorked: string;
  overtimeHours15: string;
  overtimeHours20: string;
  overtimePay: string;
  allowancesBreakdown: any;
  totalAllowances: string;
  grossPay: string;
  taxableIncome: string;
  ircTax: string;
  superannuationEmployee: string;
  superannuationEmployer: string;
  deductionsBreakdown: any;
  totalDeductions: string;
  netPay: string;
  currency: string;
  paymentStatus: "pending" | "cleared" | "failed" | string;
  paymentMethod: string;
  bankName?: string;
  bankAccountNumber?: string;
  attendanceDaysPresent?: number;
  unpaidLeaveDays?: string;
  unpaidLeaveDeduction?: string;
  employeeName?: string;
  employeeNumber?: string;
  gradeLevel?: string;
  departmentName?: string;
  positionTitle?: string;
  tin?: string;
  superFund?: string;
  superMemberNumber?: string;
  emailDeliveryStatus?: "not_sent" | "sent" | "failed" | string;
  emailSentTo?: string;
  emailSentAt?: string;
  emailDeliveryError?: string;
  privateEmail?: string;
  dateOfBirth?: string;
}

interface SalaryProfile {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNumber: string;
  employeeEmail?: string;
  departmentName?: string;
  positionTitle?: string;
  gradeLevel: string;
  annualBaseSalary: string;
  fortnightlyBaseSalary: string;
  hourlyRate: string;
  payCycle: string;
  paymentMethod: string;
  bankName: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  tin?: string;
  taxCode: string;
  superFund: string;
  superMemberNumber?: string;
  superVoluntaryRate?: string;
  superannuationType?: "percentage" | "fixed";
  superannuationFixedAmount?: string;
  housingAllowance?: string;
  housingAllowanceType?: "fixed" | "percentage";
  housingAllowanceRate?: string;
  utilityAllowance?: string;
  utilityAllowanceType?: "fixed" | "percentage";
  utilityAllowanceRate?: string;
  transportAllowance?: string;
  transportAllowanceType?: "fixed" | "percentage";
  transportAllowanceRate?: string;
  representationAllowance?: string;
  representationAllowanceType?: "fixed" | "percentage";
  representationAllowanceRate?: string;
  otherAllowances?: string;
  otherAllowancesType?: "fixed" | "percentage";
  otherAllowancesRate?: string;
  unionDues?: string;
  insuranceDeduction?: string;
  privateEmail?: string;
  payslipPasswordPin?: string;
  payslipPasswordType?: string;
  isActive: boolean;
}

interface PayrollAdjustment {
  id: number;
  employeeId: number;
  employeeName?: string;
  employeeNumber?: string;
  periodId?: number;
  periodCode?: string;
  type: string;
  category: string;
  amount: string;
  taxable: boolean;
  description: string;
  status: string;
  requestedByName?: string;
  createdAt: string;
}

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isHrOfficer, isExecutive } = useRole();
  const canManage = isAdmin || isHrOfficer;
  const canApprove = isAdmin || isExecutive || isHrOfficer;

  // Selected period filter for Payslips tab
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  // Active dialog states
  const [viewingPayslip, setViewingPayslip] = useState<PayrollItem | null>(null);
  const [editingProfile, setEditingProfile] = useState<SalaryProfile | null>(null);
  const [isNewPeriodOpen, setIsNewPeriodOpen] = useState(false);
  const [isNewAdjustmentOpen, setIsNewAdjustmentOpen] = useState(false);
  const [isCalculateConfirmOpen, setIsCalculateConfirmOpen] = useState(false);

  // Email distribution state
  const [distributingPeriod, setDistributingPeriod] = useState<PayrollPeriod | null>(null);
  const [isDistributeOpen, setIsDistributeOpen] = useState(false);
  const [distributeRequirePrivateOnly, setDistributeRequirePrivateOnly] = useState(true);
  const [distributeOverrideExisting, setDistributeOverrideExisting] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<any>(null);
  const [isSendingSingleEmail, setIsSendingSingleEmail] = useState(false);

  const handleSendSingleEmail = async (item: PayrollItem) => {
    try {
      setIsSendingSingleEmail(true);
      const res = await fetch(`/api/payroll/items/${item.id}/email`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send payslip email");
      }
      toast({
        title: "Payslip Dispatched via Email",
        description: `Password-protected PDF successfully sent to ${data.data?.sentTo}. Security password: ${data.data?.passwordHint}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/my-payslips"] });
    } catch (err: any) {
      toast({
        title: "Email Dispatch Failed",
        description: err.message || "Could not deliver email",
        variant: "destructive",
      });
    } finally {
      setIsSendingSingleEmail(false);
    }
  };

  const handleDistributePeriod = async () => {
    if (!distributingPeriod) return;
    try {
      setIsDistributing(true);
      const res = await fetch(`/api/payroll/periods/${distributingPeriod.id}/distribute-payslips`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirePrivateEmail: distributeRequirePrivateOnly,
          overrideExisting: distributeOverrideExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to distribute payslips");
      }
      setDistributionResult(data.data);
      toast({
        title: "Distribution Completed",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/overview"] });
    } catch (err: any) {
      toast({
        title: "Distribution Error",
        description: err.message || "Failed to distribute payslips",
        variant: "destructive",
      });
    } finally {
      setIsDistributing(false);
    }
  };

  // New period form state
  const [newPeriodForm, setNewPeriodForm] = useState({
    periodCode: "2026-FN16",
    name: "Fortnight 16 (August 2026)",
    cycleType: "fortnightly",
    year: 2026,
    periodNumber: 16,
    startDate: "2026-07-27",
    endDate: "2026-08-09",
    payDate: "2026-08-13",
    notes: "",
  });

  // New adjustment form state
  const [newAdjForm, setNewAdjForm] = useState({
    employeeId: "1",
    type: "allowance",
    category: "Acting Lead Allowance",
    amount: "250.00",
    taxable: true,
    description: "Temporary Higher Duties allowance during ISO 17025 laboratory assessment.",
  });

  // Module active tab state
  const [selectedTab, setSelectedTab] = useState<string>("payslips");

  // Simulator state
  const [simGrade, setSimGrade] = useState<string>("Grade 12");
  const [simSalary, setSimSalary] = useState<number>(54000);
  const [simOvertime, setSimOvertime] = useState<number>(4);
  const [simHousingType, setSimHousingType] = useState<"fixed" | "percentage">("fixed");
  const [simHousing, setSimHousing] = useState<number>(400);
  const [simHousingRate, setSimHousingRate] = useState<number>(15);
  const [simUtilityType, setSimUtilityType] = useState<"fixed" | "percentage">("fixed");
  const [simUtility, setSimUtility] = useState<number>(120);
  const [simUtilityRate, setSimUtilityRate] = useState<number>(4);
  const [simTransportType, setSimTransportType] = useState<"fixed" | "percentage">("fixed");
  const [simTransport, setSimTransport] = useState<number>(150);
  const [simTransportRate, setSimTransportRate] = useState<number>(5);
  const [simSuperType, setSimSuperType] = useState<"percentage" | "fixed">("percentage");
  const [simSuperFixed, setSimSuperFixed] = useState<number>(200);
  const [simSuperVol, setSimSuperVol] = useState<number>(0);

  // ==========================================
  // QUERIES
  // ==========================================
  const { data: overviewData, isLoading: isOverviewLoading } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/payroll/overview"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/overview", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to load payroll overview");
      return res.json();
    },
  });

  const overview = overviewData?.data;
  const activePeriod: PayrollPeriod | undefined = overview?.activePeriod;

  // Auto-select active period ID once loaded
  useMemo(() => {
    if (activePeriod && selectedPeriodId === null) {
      setSelectedPeriodId(activePeriod.id);
    }
  }, [activePeriod, selectedPeriodId]);

  const { data: periodsData, isLoading: isPeriodsLoading } = useQuery<{ success: boolean; data: PayrollPeriod[] }>({
    queryKey: ["/api/payroll/periods"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/periods?pageSize=50", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to load periods");
      return res.json();
    },
  });
  const periods = periodsData?.data || [];

  const { data: itemsData, isLoading: isItemsLoading } = useQuery<{ success: boolean; data: PayrollItem[] }>({
    queryKey: ["/api/payroll/periods", selectedPeriodId, "items"],
    queryFn: async () => {
      if (!selectedPeriodId) return { success: true, data: [] };
      const res = await fetch(`/api/payroll/periods/${selectedPeriodId}/items?pageSize=100`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to load items");
      return res.json();
    },
    enabled: !!selectedPeriodId,
  });
  const payrollItems = itemsData?.data || [];

  const { data: profilesData, isLoading: isProfilesLoading } = useQuery<{ success: boolean; data: SalaryProfile[] }>({
    queryKey: ["/api/payroll/employee-profiles"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/employee-profiles?pageSize=100", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to load profiles");
      return res.json();
    },
    enabled: canManage || canApprove,
  });
  const salaryProfiles = profilesData?.data || [];

  const { data: adjustmentsData, isLoading: isAdjLoading } = useQuery<{ success: boolean; data: PayrollAdjustment[] }>({
    queryKey: ["/api/payroll/adjustments"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/adjustments", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to load adjustments");
      return res.json();
    },
  });
  const adjustments = adjustmentsData?.data || [];

  const { data: myPayslipsData, isLoading: isMyPayslipsLoading } = useQuery<{ success: boolean; data: PayrollItem[] }>({
    queryKey: ["/api/payroll/my-payslips"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/my-payslips", { headers: getAuthHeader() });
      if (!res.ok) throw new Error("Failed to load my payslips");
      return res.json();
    },
  });
  const myPayslips = myPayslipsData?.data || [];

  // Salary Simulator Query
  const { data: simData } = useQuery({
    queryKey: [
      "/api/payroll/simulate",
      simSalary,
      simOvertime,
      simHousing,
      simHousingType,
      simHousingRate,
      simUtility,
      simUtilityType,
      simUtilityRate,
      simTransport,
      simTransportType,
      simTransportRate,
      simSuperType,
      simSuperFixed,
      simSuperVol,
    ],
    queryFn: async () => {
      const res = await fetch("/api/payroll/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          annualBaseSalary: simSalary,
          overtimeHours: simOvertime,
          housingAllowance: simHousing,
          housingAllowanceType: simHousingType,
          housingAllowanceRate: simHousingRate,
          utilityAllowance: simUtility,
          utilityAllowanceType: simUtilityType,
          utilityAllowanceRate: simUtilityRate,
          transportAllowance: simTransport,
          transportAllowanceType: simTransportType,
          transportAllowanceRate: simTransportRate,
          superannuationType: simSuperType,
          superannuationFixedAmount: simSuperFixed,
          voluntarySuperRate: simSuperVol,
        }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      return res.json();
    },
  });
  const simResult = simData?.data;

  // Pay Grade Scales Query
  const { data: payGradesData, isLoading: isGradesLoading } = useQuery<{ success: boolean; data: PayGradeScale[] }>({
    queryKey: ["/api/payroll/pay-grades"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/pay-grades", { headers: getAuthHeader() });
      if (!res.ok) return { success: true, data: Object.values(PNG_PAY_GRADE_SCALES) };
      return res.json();
    },
  });
  const payGradeScales = payGradesData?.data && payGradesData.data.length > 0
    ? payGradesData.data
    : Object.values(PNG_PAY_GRADE_SCALES);

  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    salaryProfiles.forEach((p) => {
      const g = p.gradeLevel ? p.gradeLevel.trim() : "Grade 10";
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [salaryProfiles]);

  // ==========================================
  // MUTATIONS
  // ==========================================
  const calculateMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const res = await fetch(`/api/payroll/periods/${periodId}/calculate`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to calculate payroll");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({
        title: "Payroll Calculated Successfully",
        description: data.message || "Remuneration calculated with attendance, overtime and IRC tax.",
      });
      setIsCalculateConfirmOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Calculation Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const res = await fetch(`/api/payroll/periods/${periodId}/approve`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to approve payroll");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({
        title: "Pay Period Approved",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({ title: "Approval Failed", description: err.message, variant: "destructive" });
    },
  });

  const disburseMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const res = await fetch(`/api/payroll/periods/${periodId}/disburse`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to disburse payroll");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({
        title: "Payroll Disbursed",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({ title: "Disbursement Failed", description: err.message, variant: "destructive" });
    },
  });

  const createPeriodMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payroll/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create period");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Pay Period Created", description: "Ready for remuneration calculation." });
      setIsNewPeriodOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { employeeId: number; data: any }) => {
      const res = await fetch(`/api/payroll/employee-profiles/${payload.employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update profile");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Remuneration Profile Updated", description: "Employee salary details saved." });
      setEditingProfile(null);
    },
    onError: (err: any) => {
      toast({ title: "Update Error", description: err.message, variant: "destructive" });
    },
  });

  const createAdjMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payroll/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ ...payload, periodId: selectedPeriodId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save adjustment");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Adjustment Recorded", description: "Will be applied to the upcoming pay run." });
      setIsNewAdjustmentOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Export handlers
  const handleDownloadAba = async (periodId: number, periodCode: string) => {
    try {
      const res = await fetch(`/api/payroll/export/bank-aba/${periodId}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to download ABA file" }));
        throw new Error(data.message || "Failed to download ABA file");
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NISIT_BANK_EFT_${periodCode}.aba`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Banking ABA File Downloaded",
        description: `Direct Credit file generated for BSP and Kina Bank (${periodCode}).`,
      });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDownloadIrcSchedule = async (periodId: number) => {
    try {
      const res = await fetch(`/api/payroll/export/irc-tax/${periodId}`, { headers: getAuthHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to export IRC schedule");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NISIT_IRC_SWT_SCHEDULE_${data.data.periodCode}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "IRC Tax Schedule Exported", description: "Form P2 / P3 compliance statement." });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDownloadSuperSchedule = async (periodId: number) => {
    try {
      const res = await fetch(`/api/payroll/export/superannuation/${periodId}`, { headers: getAuthHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to export Superannuation schedule");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NISIT_NASFUND_SUPER_SCHEDULE_${data.data.periodCode}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Superannuation Schedule Exported", description: "Nasfund & Nambawan Super electronic schedule." });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    }
  };

  // Helper formatters
  const formatPGK = (val: string | number | undefined) => {
    const num = Number(val) || 0;
    return `K${num.toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Status badge styling
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "disbursed":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Disbursed (Paid)</Badge>;
      case "approved":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium">Executive Approved</Badge>;
      case "pending_review":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium">Pending Review</Badge>;
      case "calculating":
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-medium animate-pulse">Calculating...</Badge>;
      case "locked":
        return <Badge variant="outline" className="text-muted-foreground border-border">Locked</Badge>;
      default:
        return <Badge variant="secondary" className="font-medium">Draft Run</Badge>;
    }
  };

  // ==========================================
  // DATA TABLE COLUMNS
  // ==========================================
  // 1. Pay Periods Table Columns
  const periodColumns: DataTableColumn<PayrollPeriod>[] = [
    {
      key: "periodCode",
      label: "Period Code",
      sortable: true,
      render: (p) => (
        <div className="font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span>{p.periodCode}</span>
        </div>
      ),
      sortValue: (p) => p.periodNumber,
    },
    {
      key: "name",
      label: "Cycle Description",
      sortable: true,
      render: (p) => <div className="text-sm">{p.name}</div>,
    },
    {
      key: "payDate",
      label: "Pay Date",
      sortable: true,
      render: (p) => <span className="font-mono text-xs">{p.payDate}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (p) => renderStatusBadge(p.status),
    },
    {
      key: "employeeCount",
      label: "Staff Count",
      sortable: true,
      render: (p) => <span className="font-medium">{p.employeeCount}</span>,
      sortValue: (p) => p.employeeCount,
    },
    {
      key: "totalGross",
      label: "Total Gross (PGK)",
      sortable: true,
      render: (p) => <span className="font-mono font-medium">{formatPGK(p.totalGross)}</span>,
      sortValue: (p) => Number(p.totalGross),
    },
    {
      key: "totalIrcTax",
      label: "IRC Tax (SWT)",
      sortable: true,
      render: (p) => <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">{formatPGK(p.totalIrcTax)}</span>,
      sortValue: (p) => Number(p.totalIrcTax),
    },
    {
      key: "totalSuperEmployee",
      label: "Super (6% + 8.4%)",
      sortable: true,
      render: (p) => (
        <span className="font-mono text-blue-600 dark:text-blue-400 text-xs">
          {formatPGK(Number(p.totalSuperEmployee) + Number(p.totalSuperEmployer))}
        </span>
      ),
      sortValue: (p) => Number(p.totalSuperEmployee),
    },
    {
      key: "totalNet",
      label: "Total Net Disbursed",
      sortable: true,
      render: (p) => <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{formatPGK(p.totalNet)}</span>,
      sortValue: (p) => Number(p.totalNet),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => {
              setSelectedPeriodId(p.id);
            }}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Payslips
          </Button>
          {canManage && p.status !== "disbursed" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setSelectedPeriodId(p.id);
                setIsCalculateConfirmOpen(true);
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Recalculate
            </Button>
          )}
          {canManage && p.status !== "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                setDistributingPeriod(p);
                setDistributionResult(null);
                setIsDistributeOpen(true);
              }}
            >
              <Mail className="w-3.5 h-3.5 mr-1" />
              Email Payslips
            </Button>
          )}
        </div>
      ),
    },
  ];

  // 2. Payslips Table Columns
  const payslipColumns: DataTableColumn<PayrollItem>[] = [
    {
      key: "payslipNumber",
      label: "Payslip ID",
      sortable: true,
      render: (item) => (
        <span className="font-mono text-xs font-semibold text-primary">{item.payslipNumber}</span>
      ),
      sortValue: (item) => item.payslipNumber,
    },
    {
      key: "employeeName",
      label: "Employee & Role",
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{item.employeeName}</span>
          <span className="text-xs text-muted-foreground">{item.employeeNumber} · {item.gradeLevel}</span>
        </div>
      ),
      sortValue: (item) => item.employeeName || "",
    },
    {
      key: "departmentName",
      label: "Division",
      sortable: true,
      render: (item) => <Badge variant="outline" className="text-xs">{item.departmentName || "General"}</Badge>,
      sortValue: (item) => item.departmentName || "",
    },
    {
      key: "baseSalary",
      label: "Fortnight Base",
      sortable: true,
      render: (item) => <span className="font-mono text-xs">{formatPGK(item.baseSalary)}</span>,
      sortValue: (item) => Number(item.baseSalary),
    },
    {
      key: "overtimePay",
      label: "Overtime Pay",
      sortable: true,
      render: (item) => (
        <span className="font-mono text-xs text-muted-foreground">
          {Number(item.overtimePay) > 0 ? formatPGK(item.overtimePay) : "—"}
        </span>
      ),
      sortValue: (item) => Number(item.overtimePay),
    },
    {
      key: "totalAllowances",
      label: "Allowances",
      sortable: true,
      render: (item) => <span className="font-mono text-xs text-muted-foreground">{formatPGK(item.totalAllowances)}</span>,
      sortValue: (item) => Number(item.totalAllowances),
    },
    {
      key: "grossPay",
      label: "Gross Pay",
      sortable: true,
      render: (item) => <span className="font-mono font-medium text-foreground">{formatPGK(item.grossPay)}</span>,
      sortValue: (item) => Number(item.grossPay),
    },
    {
      key: "ircTax",
      label: "IRC Tax (SWT)",
      sortable: true,
      render: (item) => <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-medium">-{formatPGK(item.ircTax)}</span>,
      sortValue: (item) => Number(item.ircTax),
    },
    {
      key: "superannuationEmployee",
      label: "Nasfund Super (6%)",
      sortable: true,
      render: (item) => <span className="font-mono text-xs text-blue-600 dark:text-blue-400">-{formatPGK(item.superannuationEmployee)}</span>,
      sortValue: (item) => Number(item.superannuationEmployee),
    },
    {
      key: "netPay",
      label: "Net Take-Home",
      sortable: true,
      render: (item) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
          {formatPGK(item.netPay)}
        </span>
      ),
      sortValue: (item) => Number(item.netPay),
    },
    {
      key: "bankName",
      label: "Bank Account",
      sortable: true,
      render: (item) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-medium text-foreground">{item.bankName || "BSP"}</span>
          <span className="text-muted-foreground">{item.bankAccountNumber || "—"}</span>
        </div>
      ),
    },
    {
      key: "paymentStatus",
      label: "Status",
      sortable: true,
      render: (item) => (
        <Badge
          variant={item.paymentStatus === "cleared" ? "default" : "outline"}
          className={item.paymentStatus === "cleared" ? "bg-emerald-600 text-white" : "text-amber-600 border-amber-300 dark:border-amber-700"}
        >
          {item.paymentStatus === "cleared" ? "EFT Cleared" : "Pending"}
        </Badge>
      ),
    },
    {
      key: "emailDeliveryStatus",
      label: "Private Email Delivery",
      sortable: true,
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          {item.emailDeliveryStatus === "sent" ? (
            <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[11px] font-medium flex items-center gap-1 w-fit">
              <MailCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Delivered</span>
            </Badge>
          ) : item.emailDeliveryStatus === "failed" ? (
            <Badge variant="destructive" className="text-[11px] font-medium flex items-center gap-1 w-fit">
              <AlertTriangle className="w-3 h-3" />
              <span>Failed</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground font-normal flex items-center gap-1 w-fit">
              <Clock className="w-3 h-3" />
              <span>Not Sent</span>
            </Badge>
          )}
          {item.emailSentTo ? (
            <span className="text-[10px] text-muted-foreground truncate max-w-[130px]" title={item.emailSentTo}>
              {item.emailSentTo}
            </span>
          ) : item.privateEmail ? (
            <span className="text-[10px] text-muted-foreground truncate max-w-[130px]" title={`Registered: ${item.privateEmail}`}>
              {item.privateEmail}
            </span>
          ) : (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">No private email</span>
          )}
        </div>
      ),
      sortValue: (item) => item.emailDeliveryStatus || "not_sent",
    },
    {
      key: "actions",
      label: "Payslip Actions",
      sortable: false,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-medium"
            onClick={() => setViewingPayslip(item)}
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-primary" />
            View
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            title="View complete period record, attendance & statutory statement"
            onClick={() => {
              setSelectedPeriodId(item.periodId);
              setSelectedTab("statement");
            }}
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            360 Record
          </Button>
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-primary hover:bg-primary/10"
              title={`Email password-protected payslip to ${item.privateEmail || "registered private email"}`}
              disabled={isSendingSingleEmail}
              onClick={() => handleSendSingleEmail(item)}
            >
              <Mail className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // 3. Employee Salary Profiles Table Columns
  const profileColumns: DataTableColumn<SalaryProfile>[] = [
    {
      key: "employeeName",
      label: "Employee",
      sortable: true,
      render: (prof) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{prof.employeeName}</span>
          <span className="text-xs text-muted-foreground">{prof.employeeNumber} · {prof.employeeEmail}</span>
        </div>
      ),
      sortValue: (prof) => prof.employeeName,
    },
    {
      key: "departmentName",
      label: "Department & Role",
      sortable: true,
      render: (prof) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">{prof.positionTitle || "Specialist"}</span>
          <span className="text-muted-foreground">{prof.departmentName || "General"}</span>
        </div>
      ),
    },
    {
      key: "gradeLevel",
      label: "Pay Grade",
      sortable: true,
      render: (prof) => <Badge variant="secondary" className="font-mono text-xs">{prof.gradeLevel}</Badge>,
      sortValue: (prof) => prof.gradeLevel,
    },
    {
      key: "annualBaseSalary",
      label: "Annual Base",
      sortable: true,
      render: (prof) => <span className="font-mono font-medium">{formatPGK(prof.annualBaseSalary)}</span>,
      sortValue: (prof) => Number(prof.annualBaseSalary),
    },
    {
      key: "fortnightlyBaseSalary",
      label: "Fortnight Base",
      sortable: true,
      render: (prof) => <span className="font-mono font-semibold text-primary">{formatPGK(prof.fortnightlyBaseSalary)}</span>,
      sortValue: (prof) => Number(prof.fortnightlyBaseSalary),
    },
    {
      key: "bankName",
      label: "Bank Account (EFT)",
      sortable: true,
      render: (prof) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-medium text-foreground">{prof.bankName}</span>
          <span className="text-muted-foreground">{prof.bankAccountNumber}</span>
        </div>
      ),
    },
    {
      key: "tin",
      label: "IRC TIN",
      sortable: true,
      render: (prof) => <span className="font-mono text-xs text-muted-foreground">{prof.tin || "—"}</span>,
    },
    {
      key: "allowances",
      label: "Allowances (Fixed / %)",
      sortable: false,
      render: (prof) => {
        const hLabel = prof.housingAllowanceType === "percentage"
          ? `${prof.housingAllowanceRate}% (${formatPGK(prof.housingAllowance || 0)})`
          : formatPGK(prof.housingAllowance || 0);
        const uLabel = prof.utilityAllowanceType === "percentage"
          ? `${prof.utilityAllowanceRate}%`
          : formatPGK(prof.utilityAllowance || 0);
        const tLabel = prof.transportAllowanceType === "percentage"
          ? `${prof.transportAllowanceRate}%`
          : formatPGK(prof.transportAllowance || 0);
        return (
          <div className="flex flex-col text-[11px] font-mono leading-tight">
            <span className="text-foreground">Housing: <span className="font-semibold text-primary">{hLabel}</span></span>
            <span className="text-muted-foreground">Utility: {uLabel} · Transport: {tLabel}</span>
          </div>
        );
      },
    },
    {
      key: "superFund",
      label: "Superannuation Fund",
      sortable: true,
      render: (prof) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-blue-600 dark:text-blue-400">{prof.superFund}</span>
          <span className="font-mono text-muted-foreground text-[11px]">
            {prof.superannuationType === "fixed"
              ? `Fixed ${formatPGK(prof.superannuationFixedAmount || 0)}/FN`
              : `${6.0 + (Number(prof.superVoluntaryRate) || 0)}% of Base`}
          </span>
          <span className="font-mono text-muted-foreground text-[10px]">{prof.superMemberNumber || "—"}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Edit",
      sortable: false,
      render: (prof) => (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => setEditingProfile(prof)}
        >
          <Sliders className="w-3.5 h-3.5 mr-1" />
          Configure
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* ================================================= */}
        {/* TOP HEADER & ACTION BAR */}
        {/* ================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Statutory Payroll & Remuneration
                  <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                    PNG Public Service Ready
                  </Badge>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Fortnightly remuneration processing, IRC Salary & Wages Tax (SWT), Nasfund/Superannuation, and Commercial Bank Direct Credit EFT.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && activePeriod && activePeriod.status !== "disbursed" && (
              <Button
                variant="default"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                onClick={() => setIsCalculateConfirmOpen(true)}
              >
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                Calculate {activePeriod.periodCode}
              </Button>
            )}

            {canManage && (
              <Button variant="outline" onClick={() => setIsNewPeriodOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                New Pay Period
              </Button>
            )}

            <Link href="/time-history">
              <Button variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                <History className="w-4 h-4 text-primary" />
                Time in History
              </Button>
            </Link>

            {activePeriod && (
              <Button
                variant="secondary"
                onClick={() => handleDownloadAba(activePeriod.id, activePeriod.periodCode)}
                className="font-medium"
              >
                <Landmark className="w-4 h-4 mr-1.5 text-blue-600" />
                Download Bank ABA
              </Button>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* ACTIVE FORTNIGHT LIFECYCLE BANNER */}
        {/* ================================================= */}
        {activePeriod && (
          <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  FN{activePeriod.periodNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">{activePeriod.name}</span>
                    {renderStatusBadge(activePeriod.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cycle: {activePeriod.startDate} to {activePeriod.endDate} · Pay Date: <span className="font-semibold text-foreground">{activePeriod.payDate}</span> · {activePeriod.employeeCount} Enrolled Staff
                  </p>
                </div>
              </div>

              {/* Approval & Disbursement Quick Controls */}
              <div className="flex items-center gap-2 self-start md:self-auto">
                {canApprove && (activePeriod.status === "pending_review" || activePeriod.status === "draft") && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(activePeriod.id)}
                  >
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    Approve Run
                  </Button>
                )}

                {canApprove && activePeriod.status === "approved" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    disabled={disburseMutation.isPending}
                    onClick={() => disburseMutation.mutate(activePeriod.id)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Disburse & Release EFT
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownloadIrcSchedule(activePeriod.id)}
                  title="Download IRC SWT Tax Schedule"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1 text-amber-600" />
                  IRC SWT
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownloadSuperSchedule(activePeriod.id)}
                  title="Download Nasfund Superannuation Schedule"
                >
                  <Coins className="w-4 h-4 mr-1 text-blue-600" />
                  Nasfund Super
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* KPI METRIC CARDS */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Fortnight Gross Remuneration</span>
                <Coins className="w-4 h-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-foreground">
                {formatPGK(activePeriod?.totalGross || 0)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Allowances: {formatPGK(activePeriod?.totalAllowances || 0)}</span>
              {overview?.variance?.grossPct !== undefined && (
                <span className={`inline-flex items-center gap-0.5 font-medium ${overview.variance.grossPct >= 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {overview.variance.grossPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {overview.variance.grossPct}% vs prev
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Net Take-Home Pay (EFT)</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatPGK(activePeriod?.totalNet || 0)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Total Deductions: {formatPGK(activePeriod?.totalDeductions || 0)}</span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                Direct Credit
              </Badge>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>IRC Tax Withheld (SWT)</span>
                <Landmark className="w-4 h-4 text-amber-600" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {formatPGK(activePeriod?.totalIrcTax || 0)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Statutory Form P2/P3</span>
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">YTD: {formatPGK(overview?.ytd?.ircTax || 0)}</span>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Superannuation (Nasfund)</span>
                <ShieldCheck className="w-4 h-4 text-blue-600" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {formatPGK(Number(activePeriod?.totalSuperEmployee || 0) + Number(activePeriod?.totalSuperEmployer || 0))}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Employee 6% · Employer 8.4%</span>
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">YTD: {formatPGK(Number(overview?.ytd?.superEmployee || 0) + Number(overview?.ytd?.superEmployer || 0))}</span>
            </CardContent>
          </Card>
        </div>

        {/* ================================================= */}
        {/* INTERACTIVE ANALYTICS CHARTS ROW */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Departmental Remuneration Cost Bar Chart */}
          <Card className="lg:col-span-2 border border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Department Remuneration & Tax Distribution ({activePeriod?.periodCode || "Current"})
              </CardTitle>
              <CardDescription className="text-xs">
                Gross salary, IRC tax withheld, and net disbursed across statutory directorates.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64 pt-2">
              {overview?.departmentCosts?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.departmentCosts} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="department_name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `K${val / 1000}k`} />
                    <RechartsTooltip
                      formatter={(val: any) => formatPGK(val)}
                      contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    <Bar dataKey="gross_pay" name="Gross Remuneration" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="irc_tax" name="IRC Tax (SWT)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net_pay" name="Net Take-Home" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No departmental records found for this period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pay Trends Line Chart */}
          <Card className="border border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Pay Run History (2026 Trends)
              </CardTitle>
              <CardDescription className="text-xs">
                Historical gross vs net payouts over consecutive fortnights.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64 pt-2">
              {overview?.trends?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overview.trends} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="period_code" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `K${val / 1000}k`} />
                    <RechartsTooltip
                      formatter={(val: any) => formatPGK(val)}
                      contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="total_gross" name="Gross" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="total_net" name="Net" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Run initial payroll to display historical trends.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ================================================= */}
        {/* MAIN MODULE TABS */}
        {/* ================================================= */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="flex flex-wrap p-1 bg-muted/60 border border-border/70 rounded-xl h-auto gap-1">
            <TabsTrigger value="payslips" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
              <Banknote className="w-4 h-4" />
              Employee Payslips
            </TabsTrigger>
            <TabsTrigger value="statement" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
              <FileText className="w-4 h-4 text-primary" />
              Period 360 Statement
            </TabsTrigger>
            <TabsTrigger value="periods" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
              <Calendar className="w-4 h-4" />
              Pay Cycles & Runs
            </TabsTrigger>
            {(canManage || canApprove) && (
              <TabsTrigger value="profiles" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
                <Users className="w-4 h-4" />
                Salary Profiles
              </TabsTrigger>
            )}
            {(canManage || canApprove) && (
              <TabsTrigger value="adjustments" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
                <Sliders className="w-4 h-4" />
                Adjustments & Claims
              </TabsTrigger>
            )}
            <TabsTrigger value="compliance" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
              <Landmark className="w-4 h-4" />
              IRC & Banking Center
            </TabsTrigger>
            <TabsTrigger value="pay-grades" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
              <Award className="w-4 h-4" />
              Pay Grade Scales
            </TabsTrigger>
            <TabsTrigger value="simulator" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Salary Simulator
            </TabsTrigger>
            <TabsTrigger value="my-payslips" className="flex items-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-medium">
              <FileCheck2 className="w-4 h-4" />
              My Payslips (ESS)
            </TabsTrigger>
          </TabsList>

          {/* ================================================= */}
          {/* TAB 1: EMPLOYEE PAYSLIPS (ENTERPRISE DATA TABLE) */}
          {/* ================================================= */}
          <TabsContent value="payslips" className="space-y-4">
            <Card className="border border-border/80">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold">Fortnight Employee Remuneration Records</CardTitle>
                    <CardDescription className="text-xs">
                      Enterprise ledger of individual earnings, IRC SWT tax, superannuation and net payments.
                    </CardDescription>
                  </div>

                  {/* Period Switcher */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Pay Period:</span>
                    <Select
                      value={selectedPeriodId ? String(selectedPeriodId) : ""}
                      onValueChange={(val) => setSelectedPeriodId(Number(val))}
                    >
                      <SelectTrigger className="w-56 h-9 text-xs">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                            {p.periodCode} — {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <DataTable
                  columns={payslipColumns}
                  rows={payrollItems}
                  getRowId={(row) => row.id}
                  isLoading={isItemsLoading}
                  tableId="payroll-payslips-table"
                  exportFilename={`NISIT_PAYROLL_${selectedPeriodId || "RECORDS"}`}
                  searchPlaceholder="Search staff by name, payroll ID, or payslip number..."
                  emptyState={
                    <div className="py-12 text-center space-y-2">
                      <Banknote className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                      <p className="font-semibold text-foreground">No Payslip Records for This Period</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Click "Calculate" on this period to generate payslips from staff salary profiles and biometric timesheets.
                      </p>
                      {canManage && selectedPeriodId && (
                        <Button
                          size="sm"
                          onClick={() => setIsCalculateConfirmOpen(true)}
                          className="mt-2 font-medium"
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Calculate Remuneration
                        </Button>
                      )}
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================= */}
          {/* TAB: PERIOD 360 STATEMENT & FULL RECORD */}
          {/* ================================================= */}
          <TabsContent value="statement" className="space-y-4">
            <PeriodStatementView initialPeriodId={selectedPeriodId} />
          </TabsContent>

          {/* ================================================= */}
          {/* TAB 2: PAY CYCLES & RUNS TABLE */}
          {/* ================================================= */}
          <TabsContent value="periods" className="space-y-4">
            <Card className="border border-border/80">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">Statutory Pay Cycles & Fortnight Schedules</CardTitle>
                    <CardDescription className="text-xs">
                      Master calendar of 2026 pay fortnights, approval milestones, and electronic disbursement records.
                    </CardDescription>
                  </div>
                  {canManage && (
                    <Button size="sm" onClick={() => setIsNewPeriodOpen(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Create Fortnight
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <DataTable
                  columns={periodColumns}
                  rows={periods}
                  getRowId={(row) => row.id}
                  isLoading={isPeriodsLoading}
                  tableId="payroll-periods-table"
                  exportFilename="NISIT_PAYROLL_PERIODS_2026"
                  searchPlaceholder="Filter pay periods..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================= */}
          {/* TAB 3: EMPLOYEE SALARY PROFILES */}
          {/* ================================================= */}
          {(canManage || canApprove) && (
            <TabsContent value="profiles" className="space-y-4">
              <Card className="border border-border/80">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Employee Remuneration & Banking Packages</CardTitle>
                      <CardDescription className="text-xs">
                        Statutory grade levels, annual/fortnightly base salaries, bank account details for EFT, and Nasfund member numbers.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <DataTable
                    columns={profileColumns}
                    rows={salaryProfiles}
                    getRowId={(row) => row.id}
                    isLoading={isProfilesLoading}
                    tableId="payroll-profiles-table"
                    exportFilename="NISIT_STAFF_REMUNERATION_PROFILES"
                    searchPlaceholder="Search staff name, payroll ID, bank, or TIN..."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ================================================= */}
          {/* TAB 4: ADJUSTMENTS & ARREARS */}
          {/* ================================================= */}
          {(canManage || canApprove) && (
            <TabsContent value="adjustments" className="space-y-4">
              <Card className="border border-border/80">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Remuneration Variations & Ad-Hoc Claims</CardTitle>
                      <CardDescription className="text-xs">
                        Acting allowances, special project honorariums, expense reimbursements, or salary advance recoveries.
                      </CardDescription>
                    </div>
                    {canManage && (
                      <Button size="sm" onClick={() => setIsNewAdjustmentOpen(true)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Variation
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <DataTable
                    columns={[
                      {
                        key: "employeeName",
                        label: "Employee",
                        sortable: true,
                        render: (a) => (
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{a.employeeName}</span>
                            <span className="text-xs text-muted-foreground">{a.employeeNumber}</span>
                          </div>
                        ),
                        sortValue: (a) => a.employeeName || "",
                      },
                      {
                        key: "category",
                        label: "Claim Category",
                        sortable: true,
                        render: (a) => <Badge variant="secondary" className="font-medium text-xs">{a.category}</Badge>,
                        sortValue: (a) => a.category,
                      },
                      {
                        key: "type",
                        label: "Classification",
                        sortable: true,
                        render: (a) => (
                          <span className={`text-xs font-semibold ${a.type === "allowance" ? "text-emerald-600" : "text-amber-600"}`}>
                            {a.type.toUpperCase()}
                          </span>
                        ),
                      },
                      {
                        key: "amount",
                        label: "Amount (PGK)",
                        sortable: true,
                        render: (a) => <span className="font-mono font-bold">{formatPGK(a.amount)}</span>,
                        sortValue: (a) => Number(a.amount),
                      },
                      {
                        key: "description",
                        label: "Justification & Notes",
                        render: (a) => <span className="text-xs text-muted-foreground">{a.description}</span>,
                      },
                      {
                        key: "status",
                        label: "Status",
                        sortable: true,
                        render: (a) => <Badge className="bg-emerald-600 text-white font-medium text-xs">Approved</Badge>,
                      },
                    ]}
                    rows={adjustments}
                    getRowId={(row) => row.id}
                    isLoading={isAdjLoading}
                    tableId="payroll-adjustments-table"
                    exportFilename="NISIT_PAYROLL_ADJUSTMENTS"
                    searchPlaceholder="Search adjustments..."
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ================================================= */}
          {/* TAB 5: STATUTORY & BANKING COMPLIANCE CENTER */}
          {/* ================================================= */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* IRC Card */}
              <Card className="border border-border/80 shadow-xs">
                <CardHeader>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 w-fit mb-2">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold">IRC Salary & Wages Tax (SWT)</CardTitle>
                  <CardDescription className="text-xs">
                    Statutory PNG personal income tax compliance under the Income Tax Act. Generates Form P2 / P3 monthly statements.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Threshold:</span>
                      <span className="font-semibold text-foreground">0% under K20,000 / yr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Standard Brackets:</span>
                      <span className="font-semibold text-foreground">22% · 30% · 35% · 40%</span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-1 mt-1">
                      <span className="text-muted-foreground">Active Run Withholding:</span>
                      <span className="font-mono font-bold text-amber-600">{formatPGK(activePeriod?.totalIrcTax || 0)}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full text-xs font-semibold"
                    variant="outline"
                    onClick={() => activePeriod && handleDownloadIrcSchedule(activePeriod.id)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Export IRC Statement JSON
                  </Button>
                </CardContent>
              </Card>

              {/* Nasfund Super Card */}
              <Card className="border border-border/80 shadow-xs">
                <CardHeader>
                  <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 w-fit mb-2">
                    <Coins className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold">Superannuation Schedule</CardTitle>
                  <CardDescription className="text-xs">
                    Compliant with the Superannuation (General Provisions) Act 2000. Employee 6.0% and Employer 8.4% statutory contributions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primary Fund:</span>
                      <span className="font-semibold text-blue-600">Nasfund & Nambawan Super</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Contribution:</span>
                      <span className="font-semibold text-foreground">14.4% of Fortnight Base</span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-1 mt-1">
                      <span className="text-muted-foreground">Fortnight Contribution:</span>
                      <span className="font-mono font-bold text-blue-600">
                        {formatPGK(Number(activePeriod?.totalSuperEmployee || 0) + Number(activePeriod?.totalSuperEmployer || 0))}
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full text-xs font-semibold"
                    variant="outline"
                    onClick={() => activePeriod && handleDownloadSuperSchedule(activePeriod.id)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Export Nasfund Schedule JSON
                  </Button>
                </CardContent>
              </Card>

              {/* Commercial Banking EFT Card */}
              <Card className="border border-border/80 shadow-xs">
                <CardHeader>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 w-fit mb-2">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold">Banking EFT & Direct Credit</CardTitle>
                  <CardDescription className="text-xs">
                    Australian / PNG Standard ABA Direct Credit format. Seamlessly uploaded to BSP Business Banking, Kina Bank, and Westpac.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clearing Format:</span>
                      <span className="font-semibold text-foreground">Direct Credit .ABA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supported Banks:</span>
                      <span className="font-semibold text-foreground">BSP, Kina, Westpac, ANZ</span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-1 mt-1">
                      <span className="text-muted-foreground">Batch Total Disbursed:</span>
                      <span className="font-mono font-bold text-emerald-600">{formatPGK(activePeriod?.totalNet || 0)}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => activePeriod && handleDownloadAba(activePeriod.id, activePeriod.periodCode)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download Bank Batch (.ABA)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ================================================= */}
          {/* TAB 6: SALARY & TAX SIMULATOR */}
          {/* ================================================= */}
          <TabsContent value="simulator" className="space-y-6">
            <Card className="border border-border/80">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Forward-Looking Remuneration & IRC Tax Simulator
                </CardTitle>
                <CardDescription className="text-xs">
                  Run what-if simulations for promotions, pay grade shifts, statutory overtime adjustments, and take-home net remuneration.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Input sliders & controls */}
                  <div className="space-y-5">
                    {/* Pay Grade Scale Presets */}
                    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5" />
                          <span>Tie to Public Service Pay Grade</span>
                        </label>
                        <span className="text-[10px] text-muted-foreground font-mono">Official PNG Scale</span>
                      </div>
                      <Select
                        value={simGrade}
                        onValueChange={(val) => {
                          setSimGrade(val);
                          const sc = PNG_PAY_GRADE_SCALES[val] || getPayGradeScale(val);
                          setSimSalary(sc.annualBaseSalary);
                          setSimHousing(sc.defaultHousing);
                          setSimUtility(sc.defaultUtility);
                          setSimTransport(sc.defaultTransport);
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background">
                          <SelectValue placeholder="Select a pay grade scale to auto-fill" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(PNG_PAY_GRADE_SCALES).map((sc) => (
                            <SelectItem key={sc.grade} value={sc.grade}>
                              {sc.grade} — {sc.title} (Base: K{sc.annualBaseSalary.toLocaleString()}/yr)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Selecting a grade locks annual base pay, standard statutory allowances, and hourly rate.
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-semibold text-foreground">Annual Base Salary (PGK)</label>
                        <span className="font-mono font-bold text-primary text-sm">{formatPGK(simSalary)}</span>
                      </div>
                      <Input
                        type="number"
                        step={1000}
                        value={simSalary}
                        onChange={(e) => setSimSalary(Number(e.target.value) || 0)}
                        className="font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Equivalent to {formatPGK(simSalary / 26)} / fortnight ({formatPGK((simSalary / 26) / 80)} / hr).
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-border/80 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground block">Fortnight Overtime (Hours)</label>
                        <span className="text-[10px] text-muted-foreground">Standard 1.5x Excess</span>
                      </div>
                      <Input
                        type="number"
                        value={simOvertime}
                        onChange={(e) => setSimOvertime(Number(e.target.value) || 0)}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Housing Allowance */}
                    <div className="p-3 rounded-lg border border-border/80 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                          <span>Housing Allowance</span>
                        </label>
                        <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSimHousingType("fixed")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simHousingType === "fixed"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Fixed PGK
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimHousingType("percentage")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simHousingType === "percentage"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            % of Base
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-center">
                        {simHousingType === "percentage" ? (
                          <div>
                            <Input
                              type="number"
                              step="0.5"
                              value={simHousingRate}
                              onChange={(e) => setSimHousingRate(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">{simHousingRate}% of fortnight base</span>
                          </div>
                        ) : (
                          <div>
                            <Input
                              type="number"
                              step="10"
                              value={simHousing}
                              onChange={(e) => setSimHousing(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Fixed amount in PGK</span>
                          </div>
                        )}
                        <div className="p-2 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                          <span className="text-muted-foreground text-[10px]">Simulated Amount</span>
                          <span className="font-bold text-foreground">
                            {formatPGK(simResult?.allowancesBreakdown?.housing ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Utility Allowance */}
                    <div className="p-3 rounded-lg border border-border/80 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Utility Allowance</span>
                        </label>
                        <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSimUtilityType("fixed")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simUtilityType === "fixed"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Fixed PGK
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimUtilityType("percentage")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simUtilityType === "percentage"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            % of Base
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-center">
                        {simUtilityType === "percentage" ? (
                          <div>
                            <Input
                              type="number"
                              step="0.5"
                              value={simUtilityRate}
                              onChange={(e) => setSimUtilityRate(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">{simUtilityRate}% of fortnight base</span>
                          </div>
                        ) : (
                          <div>
                            <Input
                              type="number"
                              step="5"
                              value={simUtility}
                              onChange={(e) => setSimUtility(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Fixed amount in PGK</span>
                          </div>
                        )}
                        <div className="p-2 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                          <span className="text-muted-foreground text-[10px]">Simulated Amount</span>
                          <span className="font-bold text-foreground">
                            {formatPGK(simResult?.allowancesBreakdown?.utility ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transport Allowance */}
                    <div className="p-3 rounded-lg border border-border/80 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Transport Allowance</span>
                        </label>
                        <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSimTransportType("fixed")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simTransportType === "fixed"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Fixed PGK
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimTransportType("percentage")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simTransportType === "percentage"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            % of Base
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-center">
                        {simTransportType === "percentage" ? (
                          <div>
                            <Input
                              type="number"
                              step="0.5"
                              value={simTransportRate}
                              onChange={(e) => setSimTransportRate(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">{simTransportRate}% of fortnight base</span>
                          </div>
                        ) : (
                          <div>
                            <Input
                              type="number"
                              step="10"
                              value={simTransport}
                              onChange={(e) => setSimTransport(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Fixed amount in PGK</span>
                          </div>
                        )}
                        <div className="p-2 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                          <span className="text-muted-foreground text-[10px]">Simulated Amount</span>
                          <span className="font-bold text-foreground">
                            {formatPGK(simResult?.allowancesBreakdown?.transport ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Superannuation Simulator */}
                    <div className="p-3 rounded-lg border border-border/80 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Superannuation Fund Contribution</span>
                        </label>
                        <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSimSuperType("percentage")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simSuperType === "percentage"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Statutory % (6% + Vol)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimSuperType("fixed")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              simSuperType === "fixed"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Fixed PGK
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-center">
                        {simSuperType === "fixed" ? (
                          <div>
                            <Input
                              type="number"
                              step="10"
                              value={simSuperFixed}
                              onChange={(e) => setSimSuperFixed(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Fixed employee super in PGK</span>
                          </div>
                        ) : (
                          <div>
                            <Input
                              type="number"
                              step="0.5"
                              value={simSuperVol}
                              onChange={(e) => setSimSuperVol(Number(e.target.value) || 0)}
                              className="font-mono text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Voluntary % (on top of 6% employee mandatory)</span>
                          </div>
                        )}
                        <div className="p-2 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                          <span className="text-muted-foreground text-[10px]">Employee Deduction</span>
                          <span className="font-bold text-foreground">
                            {formatPGK(simResult?.superannuationEmployee ?? 0)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">Employer: {formatPGK(simResult?.superannuationEmployer ?? 0)} (8.4%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Simulated Breakdown Output */}
                  {simResult && (
                    <div className="p-5 rounded-xl border border-primary/20 bg-muted/30 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-border/60">
                        <div>
                          <span className="text-xs text-muted-foreground">Estimated Fortnight Net Pay</span>
                          <p className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                            {formatPGK(simResult.netPay)}
                          </p>
                        </div>
                        <Badge className="bg-emerald-600 text-white font-medium text-xs">
                          {simResult.taxDetails.marginalBracket}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fortnightly Gross Earnings:</span>
                          <span className="font-mono font-semibold">{formatPGK(simResult.grossPay)}</span>
                        </div>
                        <div className="flex justify-between pl-3 text-muted-foreground border-l-2 border-primary/30">
                          <span>Base Salary (80 hrs):</span>
                          <span className="font-mono">{formatPGK(simResult.baseSalary)}</span>
                        </div>
                        <div className="flex justify-between pl-3 text-muted-foreground border-l-2 border-primary/30">
                          <span>Overtime Pay (1.5x):</span>
                          <span className="font-mono">{formatPGK(simResult.overtimePay)}</span>
                        </div>
                        <div className="flex justify-between pl-3 text-muted-foreground border-l-2 border-primary/30">
                          <span>Cash Allowances:</span>
                          <span className="font-mono">{formatPGK(simResult.totalAllowances)}</span>
                        </div>

                        <div className="border-t border-border/60 pt-2 flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                          <span>IRC Salary & Wages Tax (SWT):</span>
                          <span className="font-mono">-{formatPGK(simResult.ircTax)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground text-right">
                          Effective tax rate: {simResult.taxDetails.effectiveTaxRate}%
                        </p>

                        <div className="flex justify-between text-blue-600 dark:text-blue-400 font-medium">
                          <span>Nasfund Superannuation (Employee):</span>
                          <span className="font-mono">-{formatPGK(simResult.superannuationEmployee)}</span>
                        </div>

                        <div className="flex justify-between text-muted-foreground">
                          <span>Union Dues (PEA) & Insurance:</span>
                          <span className="font-mono">-{formatPGK(simResult.deductionsBreakdown.unionDues + simResult.deductionsBreakdown.insurance)}</span>
                        </div>

                        <div className="border-t border-border/60 pt-3 flex justify-between font-bold text-foreground text-sm">
                          <span>Total Deductions:</span>
                          <span className="font-mono">-{formatPGK(simResult.totalDeductions)}</span>
                        </div>
                      </div>

                      {/* Employer Cost Callout */}
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
                        <span className="font-semibold text-primary block">Employer Statutory Obligation</span>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Employer Nasfund Super (8.4%):</span>
                          <span className="font-mono font-medium text-foreground">{formatPGK(simResult.superannuationEmployer)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Total Cost to NISIT (Fortnight):</span>
                          <span className="font-mono font-bold text-foreground">
                            {formatPGK(simResult.grossPay + simResult.superannuationEmployer)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================= */}
          {/* TAB 7: MY PAYSLIPS (EMPLOYEE SELF SERVICE) */}
          {/* ================================================= */}
          <TabsContent value="my-payslips" className="space-y-4">
            <Card className="border border-border/80">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-lg font-bold">My Personal Payslips & Statements</CardTitle>
                <CardDescription className="text-xs">
                  Direct access to your official remuneration statements, tax certificates, and superannuation deductions.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <DataTable
                  columns={[
                    {
                      key: "payslipNumber",
                      label: "Payslip ID",
                      sortable: true,
                      render: (item) => <span className="font-mono text-xs font-semibold text-primary">{item.payslipNumber}</span>,
                    },
                    {
                      key: "periodName",
                      label: "Pay Period",
                      sortable: true,
                      render: (item: any) => (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{item.periodName}</span>
                          <span className="text-xs text-muted-foreground">Paid: {item.payDate}</span>
                        </div>
                      ),
                    },
                    {
                      key: "grossPay",
                      label: "Gross Pay",
                      sortable: true,
                      render: (item) => <span className="font-mono text-xs">{formatPGK(item.grossPay)}</span>,
                    },
                    {
                      key: "ircTax",
                      label: "IRC Tax (SWT)",
                      sortable: true,
                      render: (item) => <span className="font-mono text-xs text-amber-600">-{formatPGK(item.ircTax)}</span>,
                    },
                    {
                      key: "superannuationEmployee",
                      label: "Nasfund (6%)",
                      sortable: true,
                      render: (item) => <span className="font-mono text-xs text-blue-600">-{formatPGK(item.superannuationEmployee)}</span>,
                    },
                    {
                      key: "netPay",
                      label: "Net Paid (EFT)",
                      sortable: true,
                      render: (item) => (
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatPGK(item.netPay)}
                        </span>
                      ),
                    },
                    {
                      key: "bankName",
                      label: "Account",
                      render: (item) => (
                        <span className="text-xs font-mono text-muted-foreground">{item.bankName} ···{String(item.bankAccountNumber || "").slice(-4)}</span>
                      ),
                    },
                    {
                      key: "emailDeliveryStatus",
                      label: "Delivery to Private Email",
                      render: (item: any) => (
                        <div className="flex flex-col gap-0.5">
                          {item.emailDeliveryStatus === "sent" ? (
                            <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[11px] font-medium flex items-center gap-1 w-fit">
                              <MailCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Emailed</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground font-normal flex items-center gap-1 w-fit">
                              <Clock className="w-3 h-3" />
                              <span>Not Sent</span>
                            </Badge>
                          )}
                          {item.emailSentTo && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[130px]" title={item.emailSentTo}>
                              {item.emailSentTo}
                            </span>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "actions",
                      label: "Statement Actions",
                      render: (item: any) => (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium"
                            onClick={() => setViewingPayslip(item)}
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Payslip
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs font-semibold bg-primary text-primary-foreground shadow-xs"
                            title="View your complete 360 period record and timesheet"
                            onClick={() => {
                              setSelectedPeriodId(item.periodId);
                              setSelectedTab("statement");
                            }}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            Full Record
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-primary hover:bg-primary/10"
                            title="Email password-protected payslip to my private email"
                            disabled={isSendingSingleEmail}
                            onClick={() => handleSendSingleEmail(item)}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                  rows={myPayslips}
                  getRowId={(row) => row.id}
                  isLoading={isMyPayslipsLoading}
                  tableId="my-payslips-table"
                  exportFilename="MY_NISIT_PAYSLIPS"
                  searchPlaceholder="Search my payslips..."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================= */}
          {/* TAB 8: PNG PUBLIC SERVICE PAY GRADE SCALES */}
          {/* ================================================= */}
          <TabsContent value="pay-grades" className="space-y-6">
            <Card className="border border-border/80">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" />
                      PNG Public Service Standard Salary Grade Structure
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Official statutory pay scales (Grades 10 through 20) tying public service job classifications directly to annual base pay, fortnightly base, and hourly rates.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs px-2.5 py-1 border-primary/30 text-primary font-mono w-fit">
                    26 Fortnights / Annum (80h/FN)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <DataTable
                  columns={[
                    {
                      key: "grade",
                      label: "Pay Grade",
                      sortable: true,
                      render: (sc) => (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/10 text-primary border border-primary/20 font-bold font-mono text-xs">
                            {sc.grade}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">Level {sc.level}</span>
                        </div>
                      ),
                      sortValue: (sc) => sc.level,
                    },
                    {
                      key: "title",
                      label: "Official Classification Band / Role",
                      sortable: true,
                      render: (sc) => <span className="font-semibold text-xs text-foreground">{sc.title}</span>,
                      sortValue: (sc) => sc.title,
                    },
                    {
                      key: "annualBaseSalary",
                      label: "Annual Base Pay (PGK)",
                      sortable: true,
                      render: (sc) => (
                        <span className="font-mono font-bold text-xs text-primary">
                          {formatPGK(sc.annualBaseSalary)}
                        </span>
                      ),
                      sortValue: (sc) => sc.annualBaseSalary,
                    },
                    {
                      key: "fortnightlyBase",
                      label: "Fortnight Base",
                      sortable: true,
                      render: (sc) => (
                        <span className="font-mono text-xs font-medium text-foreground">
                          {formatPGK(sc.fortnightlyBase)}
                        </span>
                      ),
                      sortValue: (sc) => sc.fortnightlyBase,
                    },
                    {
                      key: "hourlyRate",
                      label: "Standard Hourly",
                      sortable: true,
                      render: (sc) => (
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatPGK(sc.hourlyRate)}/hr
                        </span>
                      ),
                      sortValue: (sc) => sc.hourlyRate,
                    },
                    {
                      key: "bandRange",
                      label: "Salary Step Band",
                      render: (sc) => (
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatPGK(sc.minSalary)} – {formatPGK(sc.maxSalary)}
                        </span>
                      ),
                    },
                    {
                      key: "defaultAllowances",
                      label: "Statutory Fortnight Allowances",
                      render: (sc) => (
                        <div className="flex flex-wrap gap-1 text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-muted font-mono" title="Housing Allowance">
                            H: {formatPGK(sc.defaultHousing)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-muted font-mono" title="Utility Allowance">
                            U: {formatPGK(sc.defaultUtility)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-muted font-mono" title="Transport Allowance">
                            T: {formatPGK(sc.defaultTransport)}
                          </span>
                        </div>
                      ),
                    },
                    {
                      key: "assignedCount",
                      label: "Active Staff",
                      sortable: true,
                      render: (sc) => {
                        const count = gradeDistribution[sc.grade] || 0;
                        return (
                          <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs font-mono">
                            {count} staff
                          </Badge>
                        );
                      },
                      sortValue: (sc) => gradeDistribution[sc.grade] || 0,
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (sc) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs font-medium text-primary hover:bg-primary/10"
                          onClick={() => {
                            setSimGrade(sc.grade);
                            setSimSalary(sc.annualBaseSalary);
                            setSimHousing(sc.defaultHousing);
                            setSimUtility(sc.defaultUtility);
                            setSimTransport(sc.defaultTransport);
                            setSelectedTab("simulator");
                          }}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Simulate
                        </Button>
                      ),
                    },
                  ]}
                  rows={payGradeScales}
                  getRowId={(row) => row.level}
                  isLoading={isGradesLoading}
                  tableId="payroll-pay-grades-table"
                  exportFilename="NISIT_PUBLIC_SERVICE_PAY_GRADES"
                  searchPlaceholder="Search pay grades or classification bands..."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ================================================= */}
        {/* MODAL 1: OFFICIAL STATUTORY PAYSLIP DOCUMENT */}
        {/* ================================================= */}
        <Dialog open={!!viewingPayslip} onOpenChange={(open) => !open && setViewingPayslip(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-full">
            {viewingPayslip && (
              <div className="space-y-6 pt-2">
                {/* Official Letterhead Header */}
                <div className="flex items-start justify-between border-b-2 border-primary/40 pb-4">
                  <div className="flex items-center gap-3">
                    <img src="/nisit-logo.png" alt="NISIT" className="w-12 h-12 object-contain rounded" />
                    <div>
                      <h2 className="text-base font-extrabold tracking-tight text-foreground uppercase">
                        PNG National Institute of Standards & Industrial Technology
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Official Statutory Remuneration Statement · Fortnight Pay Advice
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        Spring Garden Road, Gordon, Port Moresby, NCD, Papua New Guinea
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                      {viewingPayslip.payslipNumber}
                    </Badge>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Currency: <strong className="text-foreground">PNG Kina (PGK)</strong>
                    </p>
                  </div>
                </div>

                {/* Staff Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                  <div>
                    <span className="text-muted-foreground block">Employee Name:</span>
                    <strong className="text-foreground text-sm">{viewingPayslip.employeeName}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Staff ID & Grade:</span>
                    <span className="font-mono">{viewingPayslip.employeeNumber} · {viewingPayslip.gradeLevel}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Directorate / Unit:</span>
                    <span>{viewingPayslip.departmentName || "Standards Wing"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">IRC Tax File No (TIN):</span>
                    <span className="font-mono">{viewingPayslip.tin || "500123987"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Superannuation Fund:</span>
                    <span className="font-medium text-blue-600">{viewingPayslip.superFund || "Nasfund"} ({viewingPayslip.superMemberNumber || "NF-29101"})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Direct Deposit Bank:</span>
                    <span className="font-mono font-medium">{viewingPayslip.bankName} (···{String(viewingPayslip.bankAccountNumber).slice(-4)})</span>
                  </div>
                </div>

                {/* Two-Column Breakdown: Earnings vs Deductions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Earnings */}
                  <div className="p-3.5 rounded-lg border border-border/80 bg-card space-y-2 text-xs">
                    <span className="font-bold text-foreground text-xs uppercase tracking-wider block border-b border-border pb-1 text-primary">
                      Gross Earnings
                    </span>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Fortnight Base Salary (80 hrs):</span>
                      <span className="font-mono font-semibold">{formatPGK(viewingPayslip.baseSalary)}</span>
                    </div>
                    {Number(viewingPayslip.overtimePay) > 0 && (
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Overtime Pay ({viewingPayslip.overtimeHours15} hrs @ 1.5x):</span>
                        <span className="font-mono">{formatPGK(viewingPayslip.overtimePay)}</span>
                      </div>
                    )}
                    {Number(viewingPayslip.totalAllowances) > 0 && (
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Statutory Cash Allowances:</span>
                        <span className="font-mono">{formatPGK(viewingPayslip.totalAllowances)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-t border-border font-bold text-foreground text-sm pt-2">
                      <span>Total Gross Pay:</span>
                      <span className="font-mono">{formatPGK(viewingPayslip.grossPay)}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="p-3.5 rounded-lg border border-border/80 bg-card space-y-2 text-xs">
                    <span className="font-bold text-foreground text-xs uppercase tracking-wider block border-b border-border pb-1 text-amber-600">
                      Statutory & Authorized Deductions
                    </span>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">IRC Salary & Wages Tax (SWT):</span>
                      <span className="font-mono font-semibold text-amber-600">-{formatPGK(viewingPayslip.ircTax)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Nasfund Superannuation (6%):</span>
                      <span className="font-mono font-semibold text-blue-600">-{formatPGK(viewingPayslip.superannuationEmployee)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Public Employees Union (PEA):</span>
                      <span className="font-mono">-K15.00</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Medical Scheme & Insurance:</span>
                      <span className="font-mono">-K25.00</span>
                    </div>
                    <div className="flex justify-between py-1 border-t border-border font-bold text-foreground text-sm pt-2">
                      <span>Total Deductions:</span>
                      <span className="font-mono">-{formatPGK(viewingPayslip.totalDeductions)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Remuneration Banner */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Net Take-Home Pay (Direct Credit)
                    </span>
                    <p className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                      {formatPGK(viewingPayslip.netPay)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-emerald-600 text-white font-medium">
                      Payment {viewingPayslip.paymentStatus.toUpperCase()}
                    </Badge>
                    <p className="text-[11px] text-muted-foreground mt-1">EFT Cleared via {viewingPayslip.bankName}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Shield className="w-4 h-4 text-primary" />
                      <span>NISIT Certified Public Service Remuneration Advice</span>
                    </div>
                    {viewingPayslip.privateEmail ? (
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        Private Delivery Address: <strong className="text-foreground">{viewingPayslip.privateEmail}</strong>
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        No private personal email registered (will default to work email)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendSingleEmail(viewingPayslip)}
                      disabled={isSendingSingleEmail}
                      className="border-primary/30 text-primary hover:bg-primary/10 font-medium"
                    >
                      {isSendingSingleEmail ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Email Protected Payslip
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()} className="font-medium">
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      Print Payslip
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ================================================= */}
        {/* MODAL 2: EDIT SALARY PROFILE */}
        {/* ================================================= */}
        <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                Configure Remuneration Package & Allowances
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure base pay grade, banking EFT details, and select either a configurable percentage or an absolute amount for all allowances and superannuation for {editingProfile?.employeeName}.
              </DialogDescription>
            </DialogHeader>
            {editingProfile && (() => {
              const currentFnBase = (Number(editingProfile.annualBaseSalary) || 0) / 26;

              return (
              <div className="space-y-4 pt-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold block">Pay Grade Level</label>
                      <span className="text-[10px] text-primary font-bold">Standard Scale</span>
                    </div>
                    <Select
                      value={editingProfile.gradeLevel}
                      onValueChange={(val) => {
                        const sc = PNG_PAY_GRADE_SCALES[val] || getPayGradeScale(val);
                        setEditingProfile({
                          ...editingProfile,
                          gradeLevel: val,
                          annualBaseSalary: String(sc.annualBaseSalary),
                          housingAllowance: editingProfile.housingAllowance || String(sc.defaultHousing),
                          utilityAllowance: editingProfile.utilityAllowance || String(sc.defaultUtility),
                          transportAllowance: editingProfile.transportAllowance || String(sc.defaultTransport),
                          representationAllowance: editingProfile.representationAllowance || String(sc.defaultRepresentation),
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PNG_PAY_GRADE_SCALES).map((sc) => (
                          <SelectItem key={sc.grade} value={sc.grade}>
                            {sc.grade} — {sc.title} (K{sc.annualBaseSalary.toLocaleString()}/yr)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold block">Annual Base Salary (PGK)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const sc = getPayGradeScale(editingProfile.gradeLevel);
                          setEditingProfile({ ...editingProfile, annualBaseSalary: String(sc.annualBaseSalary) });
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold"
                        title="Reset to official PNG Public Service salary scale"
                      >
                        Reset to Grade Base
                      </button>
                    </div>
                    <Input
                      type="number"
                      value={editingProfile.annualBaseSalary}
                      onChange={(e) => setEditingProfile({ ...editingProfile, annualBaseSalary: e.target.value })}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Grade and Base Pay Metrics callout */}
                <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/70 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Fortnight Base: </span>
                    <span className="font-mono font-bold text-foreground">
                      {formatPGK(currentFnBase)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hourly Rate: </span>
                    <span className="font-mono font-bold text-foreground">
                      {formatPGK(currentFnBase / 80)}/hr
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-mono">
                    {getPayGradeScale(editingProfile.gradeLevel).title}
                  </Badge>
                </div>

                {/* SUPERANNUATION FUND CONFIGURATION */}
                <div className="p-3 rounded-lg border border-border/80 bg-card space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Superannuation Fund & Contribution Method</span>
                    </div>
                    <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setEditingProfile({ ...editingProfile, superannuationType: "percentage" })}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          (editingProfile.superannuationType || "percentage") === "percentage"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Statutory % (6% + Vol)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProfile({ ...editingProfile, superannuationType: "fixed" })}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          editingProfile.superannuationType === "fixed"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Fixed PGK Amount
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1 text-[11px]">Superannuation Provider</label>
                      <Select
                        value={editingProfile.superFund}
                        onValueChange={(val) => setEditingProfile({ ...editingProfile, superFund: val })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Nasfund">Nasfund (PNG National)</SelectItem>
                          <SelectItem value="Nambawan Super">Nambawan Super</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1 text-[11px]">Member ID / Account #</label>
                      <Input
                        value={editingProfile.superMemberNumber || ""}
                        placeholder="e.g. NF-88291"
                        onChange={(e) => setEditingProfile({ ...editingProfile, superMemberNumber: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {editingProfile.superannuationType === "fixed" ? (
                    <div className="grid grid-cols-2 gap-3 items-center pt-1">
                      <div>
                        <label className="font-semibold block mb-1 text-[11px]">Fixed Fortnightly Employee Deduction (PGK)</label>
                        <Input
                          type="number"
                          step="10"
                          placeholder="e.g. 250"
                          value={editingProfile.superannuationFixedAmount || ""}
                          onChange={(e) => setEditingProfile({ ...editingProfile, superannuationFixedAmount: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="p-2 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                        <span className="text-muted-foreground text-[10px]">Employee Fixed Deduction</span>
                        <span className="font-bold text-foreground">
                          {formatPGK(Number(editingProfile.superannuationFixedAmount) || 0)} / FN
                        </span>
                        <span className="text-[10px] text-muted-foreground">Employer Statutory: {formatPGK(currentFnBase * 0.084)} (8.4%)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 items-center pt-1">
                      <div>
                        <label className="font-semibold block mb-1 text-[11px]">Voluntary Addition % (over mandatory 6%)</label>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="0.0"
                          value={editingProfile.superVoluntaryRate || "0"}
                          onChange={(e) => setEditingProfile({ ...editingProfile, superVoluntaryRate: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="p-2 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                        <span className="text-muted-foreground text-[10px]">Employee Contribution: {6.0 + (Number(editingProfile.superVoluntaryRate) || 0)}%</span>
                        <span className="font-bold text-foreground">
                          {formatPGK(currentFnBase * ((6.0 + (Number(editingProfile.superVoluntaryRate) || 0)) / 100))} / FN
                        </span>
                        <span className="text-[10px] text-muted-foreground">Employer Statutory: {formatPGK(currentFnBase * 0.084)} (8.4%)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ALLOWANCES SECTION: Configurable Percentage or Absolute Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-primary" />
                      Statutory & Operational Allowances
                    </label>
                    <span className="text-[10px] text-muted-foreground">Choose Fixed PGK or % of Fortnight Base</span>
                  </div>

                  {/* HOUSING ALLOWANCE */}
                  <div className="p-2.5 rounded-lg border border-border/80 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                        Housing Allowance
                      </span>
                      <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.housingAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "15";
                            setEditingProfile({
                              ...editingProfile,
                              housingAllowanceType: "fixed",
                              housingAllowanceRate: calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            (editingProfile.housingAllowanceType || "fixed") === "fixed"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Fixed PGK
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.housingAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "15";
                            setEditingProfile({
                              ...editingProfile,
                              housingAllowanceType: "percentage",
                              housingAllowanceRate: editingProfile.housingAllowanceRate || calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            editingProfile.housingAllowanceType === "percentage"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          % of Base
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        {editingProfile.housingAllowanceType === "percentage" ? (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="e.g. 15.0"
                              value={editingProfile.housingAllowanceRate || ""}
                              onChange={(e) => {
                                const rate = Number(e.target.value) || 0;
                                const fixed = Math.round((currentFnBase * (rate / 100)) * 100) / 100;
                                setEditingProfile({
                                  ...editingProfile,
                                  housingAllowanceRate: e.target.value,
                                  housingAllowance: fixed.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Rate: {editingProfile.housingAllowanceRate || 0}% of Fortnight Base
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="10"
                              placeholder="e.g. 400"
                              value={editingProfile.housingAllowance || ""}
                              onChange={(e) => {
                                const fixed = Number(e.target.value) || 0;
                                const rate = currentFnBase > 0 ? Math.round((fixed / currentFnBase) * 10000) / 100 : 0;
                                setEditingProfile({
                                  ...editingProfile,
                                  housingAllowance: e.target.value,
                                  housingAllowanceRate: rate.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Amount: K{editingProfile.housingAllowance || 0} / fortnight
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="px-2.5 py-1.5 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                        <span className="text-muted-foreground text-[10px]">Effective Fortnightly</span>
                        <span className="font-bold text-foreground">
                          {editingProfile.housingAllowanceType === "percentage"
                            ? formatPGK((currentFnBase * (Number(editingProfile.housingAllowanceRate) || 0)) / 100)
                            : formatPGK(editingProfile.housingAllowance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* UTILITY ALLOWANCE */}
                  <div className="p-2.5 rounded-lg border border-border/80 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Utility Allowance
                      </span>
                      <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.utilityAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "4";
                            setEditingProfile({
                              ...editingProfile,
                              utilityAllowanceType: "fixed",
                              utilityAllowanceRate: calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            (editingProfile.utilityAllowanceType || "fixed") === "fixed"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Fixed PGK
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.utilityAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "4";
                            setEditingProfile({
                              ...editingProfile,
                              utilityAllowanceType: "percentage",
                              utilityAllowanceRate: editingProfile.utilityAllowanceRate || calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            editingProfile.utilityAllowanceType === "percentage"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          % of Base
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        {editingProfile.utilityAllowanceType === "percentage" ? (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="e.g. 4.0"
                              value={editingProfile.utilityAllowanceRate || ""}
                              onChange={(e) => {
                                const rate = Number(e.target.value) || 0;
                                const fixed = Math.round((currentFnBase * (rate / 100)) * 100) / 100;
                                setEditingProfile({
                                  ...editingProfile,
                                  utilityAllowanceRate: e.target.value,
                                  utilityAllowance: fixed.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Rate: {editingProfile.utilityAllowanceRate || 0}% of Fortnight Base
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="5"
                              placeholder="e.g. 120"
                              value={editingProfile.utilityAllowance || ""}
                              onChange={(e) => {
                                const fixed = Number(e.target.value) || 0;
                                const rate = currentFnBase > 0 ? Math.round((fixed / currentFnBase) * 10000) / 100 : 0;
                                setEditingProfile({
                                  ...editingProfile,
                                  utilityAllowance: e.target.value,
                                  utilityAllowanceRate: rate.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Amount: K{editingProfile.utilityAllowance || 0} / fortnight
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="px-2.5 py-1.5 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                        <span className="text-muted-foreground text-[10px]">Effective Fortnightly</span>
                        <span className="font-bold text-foreground">
                          {editingProfile.utilityAllowanceType === "percentage"
                            ? formatPGK((currentFnBase * (Number(editingProfile.utilityAllowanceRate) || 0)) / 100)
                            : formatPGK(editingProfile.utilityAllowance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TRANSPORT ALLOWANCE */}
                  <div className="p-2.5 rounded-lg border border-border/80 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                        Transport Allowance
                      </span>
                      <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.transportAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "6";
                            setEditingProfile({
                              ...editingProfile,
                              transportAllowanceType: "fixed",
                              transportAllowanceRate: calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            (editingProfile.transportAllowanceType || "fixed") === "fixed"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Fixed PGK
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.transportAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "6";
                            setEditingProfile({
                              ...editingProfile,
                              transportAllowanceType: "percentage",
                              transportAllowanceRate: editingProfile.transportAllowanceRate || calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            editingProfile.transportAllowanceType === "percentage"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          % of Base
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        {editingProfile.transportAllowanceType === "percentage" ? (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="e.g. 6.0"
                              value={editingProfile.transportAllowanceRate || ""}
                              onChange={(e) => {
                                const rate = Number(e.target.value) || 0;
                                const fixed = Math.round((currentFnBase * (rate / 100)) * 100) / 100;
                                setEditingProfile({
                                  ...editingProfile,
                                  transportAllowanceRate: e.target.value,
                                  transportAllowance: fixed.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Rate: {editingProfile.transportAllowanceRate || 0}% of Fortnight Base
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="10"
                              placeholder="e.g. 150"
                              value={editingProfile.transportAllowance || ""}
                              onChange={(e) => {
                                const fixed = Number(e.target.value) || 0;
                                const rate = currentFnBase > 0 ? Math.round((fixed / currentFnBase) * 10000) / 100 : 0;
                                setEditingProfile({
                                  ...editingProfile,
                                  transportAllowance: e.target.value,
                                  transportAllowanceRate: rate.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Amount: K{editingProfile.transportAllowance || 0} / fortnight
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="px-2.5 py-1.5 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                        <span className="text-muted-foreground text-[10px]">Effective Fortnightly</span>
                        <span className="font-bold text-foreground">
                          {editingProfile.transportAllowanceType === "percentage"
                            ? formatPGK((currentFnBase * (Number(editingProfile.transportAllowanceRate) || 0)) / 100)
                            : formatPGK(editingProfile.transportAllowance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* REPRESENTATION ALLOWANCE (Executive / Leadership) */}
                  <div className="p-2.5 rounded-lg border border-border/80 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                        <Award className="w-3.5 h-3.5 text-purple-600" />
                        Representation / Special Responsibility Allowance
                      </span>
                      <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted/50 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.representationAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "5";
                            setEditingProfile({
                              ...editingProfile,
                              representationAllowanceType: "fixed",
                              representationAllowanceRate: calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            (editingProfile.representationAllowanceType || "fixed") === "fixed"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Fixed PGK
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentFixed = Number(editingProfile.representationAllowance) || 0;
                            const calcRate = currentFnBase > 0 ? (Math.round((currentFixed / currentFnBase) * 1000) / 10).toString() : "5";
                            setEditingProfile({
                              ...editingProfile,
                              representationAllowanceType: "percentage",
                              representationAllowanceRate: editingProfile.representationAllowanceRate || calcRate,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            editingProfile.representationAllowanceType === "percentage"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          % of Base
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        {editingProfile.representationAllowanceType === "percentage" ? (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="e.g. 5.0"
                              value={editingProfile.representationAllowanceRate || ""}
                              onChange={(e) => {
                                const rate = Number(e.target.value) || 0;
                                const fixed = Math.round((currentFnBase * (rate / 100)) * 100) / 100;
                                setEditingProfile({
                                  ...editingProfile,
                                  representationAllowanceRate: e.target.value,
                                  representationAllowance: fixed.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Rate: {editingProfile.representationAllowanceRate || 0}% of Fortnight Base
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              step="20"
                              placeholder="e.g. 200"
                              value={editingProfile.representationAllowance || ""}
                              onChange={(e) => {
                                const fixed = Number(e.target.value) || 0;
                                const rate = currentFnBase > 0 ? Math.round((fixed / currentFnBase) * 10000) / 100 : 0;
                                setEditingProfile({
                                  ...editingProfile,
                                  representationAllowance: e.target.value,
                                  representationAllowanceRate: rate.toString(),
                                });
                              }}
                              className="h-8 text-xs font-mono"
                            />
                            <span className="text-[10px] text-muted-foreground block">
                              Amount: K{editingProfile.representationAllowance || 0} / fortnight
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="px-2.5 py-1.5 rounded bg-muted/60 text-[11px] font-mono flex flex-col justify-center">
                        <span className="text-muted-foreground text-[10px]">Effective Fortnightly</span>
                        <span className="font-bold text-foreground">
                          {editingProfile.representationAllowanceType === "percentage"
                            ? formatPGK((currentFnBase * (Number(editingProfile.representationAllowanceRate) || 0)) / 100)
                            : formatPGK(editingProfile.representationAllowance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BANKING & TAX IDENTIFIERS */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Commercial Bank Name</label>
                    <Select
                      value={editingProfile.bankName}
                      onValueChange={(val) => setEditingProfile({ ...editingProfile, bankName: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BSP Financial Group">BSP Financial Group</SelectItem>
                        <SelectItem value="Kina Bank">Kina Bank</SelectItem>
                        <SelectItem value="Westpac PNG">Westpac PNG</SelectItem>
                        <SelectItem value="ANZ PNG">ANZ PNG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Bank Account Number</label>
                    <Input
                      value={editingProfile.bankAccountNumber || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, bankAccountNumber: e.target.value })}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">IRC Tax File Number (TIN)</label>
                    <Input
                      value={editingProfile.tin || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, tin: e.target.value })}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Tax Code</label>
                    <Select
                      value={editingProfile.taxCode || "primary"}
                      onValueChange={(val) => setEditingProfile({ ...editingProfile, taxCode: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary Employment (Tax-Free Threshold)</SelectItem>
                        <SelectItem value="secondary">Secondary Employment (Standard SWT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Confidential Payslip Email Delivery & Security</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">Registered Private Email Address</label>
                      <Input
                        type="email"
                        placeholder="e.g. staff.personal@gmail.com"
                        value={editingProfile.privateEmail || ""}
                        onChange={(e) => setEditingProfile({ ...editingProfile, privateEmail: e.target.value })}
                        className="h-9 text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Encrypted PDF payslips will be sent to this personal address.
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">Custom Security PIN (Optional)</label>
                      <Input
                        type="password"
                        placeholder="Default: Date of Birth (DDMMYYYY)"
                        value={editingProfile.payslipPasswordPin || ""}
                        onChange={(e) => setEditingProfile({ ...editingProfile, payslipPasswordPin: e.target.value })}
                        className="h-9 text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Leave blank to use staff Date of Birth or TIN.
                      </span>
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-3 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => setEditingProfile(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="font-semibold"
                    disabled={updateProfileMutation.isPending}
                    onClick={() => {
                      updateProfileMutation.mutate({
                        employeeId: editingProfile.employeeId,
                        data: editingProfile,
                      });
                    }}
                  >
                    Save Remuneration Package
                  </Button>
                </DialogFooter>
              </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ================================================= */}
        {/* MODAL 3: CREATE NEW PAY PERIOD */}
        {/* ================================================= */}
        <Dialog open={isNewPeriodOpen} onOpenChange={setIsNewPeriodOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Create New Pay Fortnight</DialogTitle>
              <DialogDescription className="text-xs">
                Schedule an upcoming statutory pay run cycle for NISIT personnel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Period Code</label>
                  <Input
                    value={newPeriodForm.periodCode}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, periodCode: e.target.value })}
                    className="h-9 font-mono text-xs"
                    placeholder="2026-FN16"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Fortnight Number (1-26)</label>
                  <Input
                    type="number"
                    value={newPeriodForm.periodNumber}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, periodNumber: Number(e.target.value) })}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Fortnight Name</label>
                <Input
                  value={newPeriodForm.name}
                  onChange={(e) => setNewPeriodForm({ ...newPeriodForm, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={newPeriodForm.startDate}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, startDate: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">End Date</label>
                  <Input
                    type="date"
                    value={newPeriodForm.endDate}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, endDate: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Disbursement Pay Date</label>
                <Input
                  type="date"
                  value={newPeriodForm.payDate}
                  onChange={(e) => setNewPeriodForm({ ...newPeriodForm, payDate: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <DialogFooter className="pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setIsNewPeriodOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="font-semibold"
                  disabled={createPeriodMutation.isPending}
                  onClick={() => createPeriodMutation.mutate(newPeriodForm)}
                >
                  Create Fortnight
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* ================================================= */}
        {/* MODAL 4: RECORD AD-HOC ADJUSTMENT */}
        {/* ================================================= */}
        <Dialog open={isNewAdjustmentOpen} onOpenChange={setIsNewAdjustmentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Record Remuneration Adjustment</DialogTitle>
              <DialogDescription className="text-xs">
                Log a variation, acting allowance, or expense reimbursement for an employee.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="font-semibold block mb-1">Select Employee</label>
                <Select
                  value={newAdjForm.employeeId}
                  onValueChange={(val) => setNewAdjForm({ ...newAdjForm, employeeId: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salaryProfiles.map((p) => (
                      <SelectItem key={p.employeeId} value={String(p.employeeId)} className="text-xs">
                        {p.employeeName} ({p.gradeLevel})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Adjustment Type</label>
                  <Select
                    value={newAdjForm.type}
                    onValueChange={(val) => setNewAdjForm({ ...newAdjForm, type: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowance">Allowance (Addition)</SelectItem>
                      <SelectItem value="acting_arrears">Acting Arrears</SelectItem>
                      <SelectItem value="reimbursement">Reimbursement</SelectItem>
                      <SelectItem value="deduction">Deduction (Recovery)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Amount (PGK)</label>
                  <Input
                    type="number"
                    value={newAdjForm.amount}
                    onChange={(e) => setNewAdjForm({ ...newAdjForm, amount: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Category Title</label>
                <Input
                  value={newAdjForm.category}
                  onChange={(e) => setNewAdjForm({ ...newAdjForm, category: e.target.value })}
                  className="h-9 text-xs"
                  placeholder="e.g. Higher Duties Acting Allowance"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Justification Description</label>
                <Input
                  value={newAdjForm.description}
                  onChange={(e) => setNewAdjForm({ ...newAdjForm, description: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setIsNewAdjustmentOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="font-semibold"
                  disabled={createAdjMutation.isPending}
                  onClick={() => createAdjMutation.mutate(newAdjForm)}
                >
                  Apply Adjustment
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* ================================================= */}
        {/* MODAL 5: CONFIRM BATCH CALCULATION */}
        {/* ================================================= */}
        <Dialog open={isCalculateConfirmOpen} onOpenChange={setIsCalculateConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Play className="w-4 h-4 text-primary fill-current" />
                Run Batch Payroll Calculation?
              </DialogTitle>
              <DialogDescription className="text-xs">
                This will automatically compute gross earnings, sync approved biometric overtime & unpaid absences, apply statutory PNG IRC Salary & Wages Tax brackets, and deduct Nasfund superannuation for all enrolled staff.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 text-xs space-y-2 text-muted-foreground">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                <div className="flex justify-between text-foreground font-semibold">
                  <span>Target Fortnight:</span>
                  <span>{activePeriod?.periodCode} — {activePeriod?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Enrolled Personnel:</span>
                  <span>{salaryProfiles.length} active employee profiles</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsCalculateConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={calculateMutation.isPending || !selectedPeriodId}
                onClick={() => selectedPeriodId && calculateMutation.mutate(selectedPeriodId)}
              >
                {calculateMutation.isPending ? "Calculating..." : "Execute Batch Calculation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ================================================= */}
        {/* MODAL 6: BATCH DISTRIBUTE PAYSLIPS VIA EMAIL */}
        {/* ================================================= */}
        <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">
                    Distribute Password-Protected Payslips via Email
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {distributingPeriod?.name} ({distributingPeriod?.periodCode})
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Statutory Security & Encryption Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Each staff payslip is individually compiled into a separate, password-encrypted PDF.
                  The document is delivered directly to the staff member's registered personal/private email address.
                  Staff decrypt using their registered PIN or Date of Birth (DDMMYYYY).
                </p>
              </div>

              <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={distributeRequirePrivateOnly}
                    onChange={(e) => setDistributeRequirePrivateOnly(e.target.checked)}
                    className="mt-0.5 rounded border-border"
                  />
                  <div>
                    <span className="font-semibold block text-foreground">Send only to registered private email addresses</span>
                    <span className="text-[11px] text-muted-foreground block">
                      Staff without a registered private personal email will be flagged and skipped.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-border/60">
                  <input
                    type="checkbox"
                    checked={distributeOverrideExisting}
                    onChange={(e) => setDistributeOverrideExisting(e.target.checked)}
                    className="mt-0.5 rounded border-border"
                  />
                  <div>
                    <span className="font-semibold block text-foreground">Re-send to employees who have already received their payslip</span>
                    <span className="text-[11px] text-muted-foreground block">
                      If unchecked, only employees who haven't received their payslip yet will be emailed.
                    </span>
                  </div>
                </label>
              </div>

              {distributionResult && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                  <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold">
                    <span>Distribution Summary</span>
                    <Badge className="bg-emerald-600 text-white font-mono">
                      {distributionResult.sentCount} Dispatched
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="p-1.5 rounded bg-background/60 border border-emerald-500/20">
                      <span className="text-muted-foreground block">Sent</span>
                      <strong className="text-emerald-600 text-sm">{distributionResult.sentCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-background/60 border border-emerald-500/20">
                      <span className="text-muted-foreground block">Skipped</span>
                      <strong className="text-muted-foreground text-sm">{distributionResult.skippedCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-background/60 border border-emerald-500/20">
                      <span className="text-muted-foreground block">Failed</span>
                      <strong className="text-red-500 text-sm">{distributionResult.failedCount}</strong>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setIsDistributeOpen(false)}>
                  {distributionResult ? "Close" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  className="font-semibold bg-primary"
                  disabled={isDistributing}
                  onClick={handleDistributePeriod}
                >
                  {isDistributing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Dispatching Encrypted Payslips...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Start Email Distribution
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
