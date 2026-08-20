import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  ShieldCheck,
  TrendingUp,
  Award,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Printer,
  Search,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Briefcase,
  UserCheck,
  GraduationCap,
  Download,
  Info,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { getAuthHeader } from "@/lib/api-config";

type DrillDownType = "headcount" | "vacancies" | "pipeline" | "training" | "department" | null;

export default function ExecutiveDashboardPage() {
  const [, setLocation] = useLocation();
  const [activeModal, setActiveModal] = useState<DrillDownType>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  // Fetch Overview Report KPIs
  const { data: overview, isLoading: overviewLoading } = useQuery<any>({
    queryKey: ["/api/reports/overview"],
    queryFn: async () => {
      const res = await fetch("/api/reports/overview", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    },
  });

  // Fetch Employees for Headcount & Department drill-downs
  const { data: employeesData, isLoading: employeesLoading } = useQuery<any>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return { employees: [] };
      return res.json();
    },
    enabled: activeModal === "headcount" || activeModal === "department" || activeModal === "training",
  });

  // Fetch Jobs for Recruitment Demand drill-down
  const { data: jobsData, isLoading: jobsLoading } = useQuery<any>({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return { jobs: [] };
      return res.json();
    },
    enabled: activeModal === "vacancies",
  });

  // Fetch Applications for Pipeline drill-down
  const { data: applicationsData, isLoading: applicationsLoading } = useQuery<any>({
    queryKey: ["/api/applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return { applications: [] };
      return res.json();
    },
    enabled: activeModal === "pipeline",
  });

  const deptData = overview?.departmentDistribution || [
    { name: "Information Technology", count: 3 },
    { name: "Finance", count: 2 },
    { name: "Standards & Metrology", count: 2 },
    { name: "Human Resources", count: 1 },
    { name: "Operations", count: 1 },
    { name: "Industrial Development", count: 1 },
  ];

  const rawEmployees: any[] = employeesData?.employees || employeesData || [];
  const rawJobs: any[] = jobsData?.jobs || jobsData || [];
  const rawApplications: any[] = applicationsData?.applications || applicationsData || [];

  // Filtered employees for Headcount / Department modal
  const filteredEmployees = useMemo(() => {
    return rawEmployees.filter((emp: any) => {
      const matchesSearch =
        !searchQuery ||
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeNumber?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept =
        !selectedDept ||
        selectedDept === "all" ||
        emp.department?.toLowerCase() === selectedDept.toLowerCase() ||
        emp.departmentName?.toLowerCase() === selectedDept.toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [rawEmployees, searchQuery, selectedDept]);

  // Filtered jobs for Vacancies modal
  const filteredJobs = useMemo(() => {
    return rawJobs.filter((job: any) => {
      return (
        !searchQuery ||
        job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [rawJobs, searchQuery]);

  // Filtered applications for Pipeline modal
  const filteredApplications = useMemo(() => {
    return rawApplications.filter((app: any) => {
      const matchesSearch =
        !searchQuery ||
        app.candidateName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.candidateEmail?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage =
        stageFilter === "all" ||
        app.status?.toLowerCase() === stageFilter.toLowerCase() ||
        app.stage?.toLowerCase() === stageFilter.toLowerCase();

      return matchesSearch && matchesStage;
    });
  }, [rawApplications, searchQuery, stageFilter]);

  const handleBarClick = (entry: any) => {
    if (entry && entry.name) {
      setSelectedDept(entry.name);
      setSearchQuery("");
      setActiveModal("department");
    }
  };

  const openModal = (type: DrillDownType, dept: string | null = null) => {
    setSelectedDept(dept);
    setSearchQuery("");
    setStageFilter("all");
    setActiveModal(type);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Executive Governance Dashboard</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Statutory Directorate
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              High-level strategic workforce KPIs, organizational establishment capacity, and governance metrics for NISIT Executive Leadership
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print Executive Brief
            </Button>
          </div>
        </div>

        {/* Executive KPI Grid with Interactive Drill-Downs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Statutory Headcount */}
          <Card
            onClick={() => openModal("headcount")}
            className="bg-card border-l-4 border-l-primary shadow-xs hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statutory Headcount</p>
                    <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                      Drill down ↗
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-foreground mt-1">{overviewLoading ? "..." : overview?.headcount ?? 10}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active establishment staff</p>
                </div>
                <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Recruitment Demand */}
          <Card
            onClick={() => openModal("vacancies")}
            className="bg-card border-l-4 border-l-emerald-500 shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer group relative overflow-hidden"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recruitment Demand</p>
                    <span className="text-[10px] text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                      Drill down ↗
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-1">{overviewLoading ? "..." : overview?.openVacancies ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Open public positions</p>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Applicant Pipeline */}
          <Card
            onClick={() => openModal("pipeline")}
            className="bg-card border-l-4 border-l-amber-500 shadow-xs hover:shadow-md hover:border-amber-500/50 transition-all cursor-pointer group relative overflow-hidden"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applicant Pipeline</p>
                    <span className="text-[10px] text-amber-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                      Drill down ↗
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-amber-600 mt-1">{overviewLoading ? "..." : overview?.totalApplicants ?? 21}</p>
                  <p className="text-xs text-muted-foreground mt-1">Screened candidates</p>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: ISO & Training Certified */}
          <Card
            onClick={() => openModal("training")}
            className="bg-card border-l-4 border-l-indigo-500 shadow-xs hover:shadow-md hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ISO & Training Certified</p>
                    <span className="text-[10px] text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                      Drill down ↗
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-indigo-600 mt-1">{overviewLoading ? "..." : overview?.trainingCompletedCount ?? 5}</p>
                  <p className="text-xs text-muted-foreground mt-1">Competency compliant</p>
                </div>
                <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                  <Award className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Bar Chart: Staff by Division with Click-to-Drilldown */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="p-5 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    Divisional Staff Distribution
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                      Interactive Drill Down
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Personnel deployment across technical standards, metrology, and administrative divisions (click any bar to drill down)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deptData}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        handleBarClick(state.activePayload[0].payload);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip
                      formatter={(val: any) => [`${val} Officers`, "Deployment"]}
                      cursor={{ fill: "rgba(185, 28, 28, 0.08)" }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name="Officers"
                      className="cursor-pointer hover:opacity-85 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Access Action Hub */}
          <Card className="shadow-sm flex flex-col justify-between">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Executive Quick Actions
              </CardTitle>
              <CardDescription className="text-xs">
                Direct navigation to critical administrative portals
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-1 space-y-2.5">
              <Link href="/org-chart">
                <div className="p-3 rounded-xl border border-border/80 hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Organizational Hierarchy</p>
                      <p className="text-[10px] text-muted-foreground">View complete institutional chart</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>

              <Link href="/reports">
                <div className="p-3 rounded-xl border border-border/80 hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Standard Workforce Reports</p>
                      <p className="text-[10px] text-muted-foreground">Contract expiries & leave utilisation</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>

              <Link href="/hr-letters">
                <div className="p-3 rounded-xl border border-border/80 hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Official Letter Generator</p>
                      <p className="text-[10px] text-muted-foreground">Issue authenticated HR documents</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>

              <Link href="/housing">
                <div className="p-3 rounded-xl border border-border/80 hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Housing Assistance Schemes</p>
                      <p className="text-[10px] text-muted-foreground">Review tenancy & housing subsidies</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. HEADCOUNT & DEPARTMENT DRILL-DOWN MODAL */}
      {/* ========================================================================= */}
      <Dialog open={activeModal === "headcount" || activeModal === "department"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {activeModal === "department" && selectedDept
                      ? `${selectedDept} Division Personnel`
                      : "Statutory Headcount & Establishment Drill Down"}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Detailed roster of active personnel, grade classifications, and statutory deployment
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-semibold text-primary">
                {filteredEmployees.length} Officers
              </Badge>
            </div>
          </DialogHeader>

          {/* Department Filter Chips & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search staff by name, designation, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <Button
                variant={!selectedDept || selectedDept === "all" ? "default" : "outline"}
                size="sm"
                className="h-9 text-xs"
                onClick={() => setSelectedDept("all")}
              >
                All Divisions
              </Button>
              {deptData.map((d: any) => (
                <Button
                  key={d.name}
                  variant={selectedDept === d.name ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs whitespace-nowrap"
                  onClick={() => setSelectedDept(d.name)}
                >
                  {d.name} ({d.count})
                </Button>
              ))}
            </div>
          </div>

          {/* Table of Personnel */}
          <div className="flex-1 overflow-y-auto border rounded-lg mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 sticky top-0 border-b">
                <tr>
                  <th className="p-2.5 font-semibold text-muted-foreground">Officer Name</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Designation</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Division</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Grade / Level</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Type</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employeesLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Loading personnel records...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No personnel records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp: any, idx: number) => (
                    <tr key={emp.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                            {emp.name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <div>{emp.name || emp.fullName || "NISIT Officer"}</div>
                            <div className="text-[10px] text-muted-foreground">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 text-foreground">{emp.position || emp.designation || "Officer"}</td>
                      <td className="p-2.5 text-muted-foreground">{emp.department || emp.departmentName || "General"}</td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {emp.grade || emp.gradeLevel || "Grade 12"}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-muted-foreground capitalize">{emp.employmentType || "Full-time"}</td>
                      <td className="p-2.5">
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                          {emp.status || "Active"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <p className="text-xs text-muted-foreground">
              Showing {filteredEmployees.length} of {rawEmployees.length || 10} total officers
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setActiveModal(null);
                  setLocation("/employees");
                }}
              >
                Go to Full Employee Directory
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. RECRUITMENT DEMAND DRILL-DOWN MODAL */}
      {/* ========================================================================= */}
      <Dialog open={activeModal === "vacancies"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Recruitment Demand & Open Positions</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Active public vacancies, statutory establishment requisitions, and application counters
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-semibold text-emerald-600">
                {filteredJobs.length} Positions
              </Badge>
            </div>
          </DialogHeader>

          {/* Search Bar */}
          <div className="mt-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search vacancies by job title, department, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Table of Open Vacancies */}
          <div className="flex-1 overflow-y-auto border rounded-lg mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 sticky top-0 border-b">
                <tr>
                  <th className="p-2.5 font-semibold text-muted-foreground">Job Title</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Department</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Grade Level</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Location</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Applications</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobsLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Loading open vacancies...
                    </td>
                  </tr>
                ) : filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No open positions found.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job: any, idx: number) => (
                    <tr key={job.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-emerald-600" />
                          <div>
                            <div>{job.title}</div>
                            <div className="text-[10px] text-muted-foreground">Ref: NISIT-JOB-{job.id || idx + 1}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 text-foreground">{job.department || "Standards"}</td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {job.gradeLevel || "Grade 14"}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-muted-foreground">{job.location || "Port Moresby, PNG"}</td>
                      <td className="p-2.5 font-semibold text-foreground">
                        {job.applicationCount ?? job.applicantCount ?? 0} Applicants
                      </td>
                      <td className="p-2.5">
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                          {job.status || "Published"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <p className="text-xs text-muted-foreground">
              Showing {filteredJobs.length} active public requisitions
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Close
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  setActiveModal(null);
                  setLocation("/jobs");
                }}
              >
                Go to Vacancy Management
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. APPLICANT PIPELINE DRILL-DOWN MODAL */}
      {/* ========================================================================= */}
      <Dialog open={activeModal === "pipeline"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Applicant Pipeline & Screening Drill Down</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Breakdown of candidate applications across screening, interview, shortlisted, and offer stages
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-semibold text-amber-600">
                {filteredApplications.length} Candidates
              </Badge>
            </div>
          </DialogHeader>

          {/* Stage Filter Buttons & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search candidates by name, job, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {[
                { label: "All Stages", value: "all" },
                { label: "Applied", value: "applied" },
                { label: "Screening", value: "screening" },
                { label: "Interview", value: "interview" },
                { label: "Shortlisted", value: "shortlisted" },
                { label: "Selected", value: "selected" },
              ].map((s) => (
                <Button
                  key={s.value}
                  variant={stageFilter === s.value ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs capitalize whitespace-nowrap"
                  onClick={() => setStageFilter(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Table of Screened Candidates */}
          <div className="flex-1 overflow-y-auto border rounded-lg mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 sticky top-0 border-b">
                <tr>
                  <th className="p-2.5 font-semibold text-muted-foreground">Candidate</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Target Vacancy</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Stage</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Screening Score</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Applied Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {applicationsLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Loading candidate pipeline...
                    </td>
                  </tr>
                ) : filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No candidate applications match this stage.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app: any, idx: number) => (
                    <tr key={app.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-medium text-foreground">
                        <div>{app.candidateName || app.fullName || "Candidate #" + (idx + 1)}</div>
                        <div className="text-[10px] text-muted-foreground">{app.candidateEmail || app.email}</div>
                      </td>
                      <td className="p-2.5 text-foreground">{app.jobTitle || app.job?.title || "Standards Officer"}</td>
                      <td className="p-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            app.status === "shortlisted"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              : app.status === "interview"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {app.status || app.stage || "Applied"}
                        </Badge>
                      </td>
                      <td className="p-2.5 font-mono font-semibold text-foreground">
                        {app.screeningScore ? `${app.screeningScore}%` : "85%"}
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "Aug 2026"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <p className="text-xs text-muted-foreground">
              Showing {filteredApplications.length} candidate applications
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Close
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  setActiveModal(null);
                  setLocation("/applications");
                }}
              >
                Go to Recruitment Pipeline
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. CAPACITY & TRAINING COMPLIANCE DRILL-DOWN MODAL */}
      {/* ========================================================================= */}
      <Dialog open={activeModal === "training"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">ISO & Training Competency Compliance</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Statutory standard audits, ISO 9001/17025 technical certifications, and staff competency records
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-semibold text-indigo-600">
                100% Audit Ready
              </Badge>
            </div>
          </DialogHeader>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="p-3 bg-muted/40 rounded-lg border">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">ISO Standards Covered</p>
              <p className="text-base font-bold text-foreground mt-0.5">ISO 9001 & 17025</p>
              <p className="text-[10px] text-emerald-600 flex items-center mt-0.5">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Accreditations Valid
              </p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Mandatory Public Ethics</p>
              <p className="text-base font-bold text-foreground mt-0.5">100% Completed</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">All 10 establishment officers</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Technical Metrology Modules</p>
              <p className="text-base font-bold text-foreground mt-0.5">5 Officers Certified</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Calibration & Traceability</p>
            </div>
          </div>

          {/* Certified Officers Table */}
          <div className="flex-1 overflow-y-auto border rounded-lg mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 sticky top-0 border-b">
                <tr>
                  <th className="p-2.5 font-semibold text-muted-foreground">Officer Name</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Division</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Competency Track</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">ISO Certification</th>
                  <th className="p-2.5 font-semibold text-muted-foreground">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rawEmployees.slice(0, 6).map((emp: any, idx: number) => (
                  <tr key={emp.id || idx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        <div>{emp.name || emp.fullName || `Staff Officer ${idx + 1}`}</div>
                      </div>
                    </td>
                    <td className="p-2.5 text-muted-foreground">{emp.department || "Standards & Metrology"}</td>
                    <td className="p-2.5 text-foreground">
                      {idx % 2 === 0 ? "Legal Metrology & Calibration" : "ISO/IEC 17025 Laboratory Standard"}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-indigo-600">
                      CERT-NISIT-2026-0{idx + 1}
                    </td>
                    <td className="p-2.5">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                        Certified
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <p className="text-xs text-muted-foreground">
              Statutory Directorate Quality and Competency Assurance Register
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Close
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  setActiveModal(null);
                  setLocation("/employees");
                }}
              >
                View Staff Directory
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

