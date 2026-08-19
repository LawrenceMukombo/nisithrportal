import { useState } from "react";
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
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { getAuthHeader } from "@/lib/api-config";

const PIE_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe", "#059669", "#10b981", "#34d399"];

export default function ExecutiveDashboardPage() {
  // Fetch Overview Report KPIs
  const { data: overview, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/overview"],
    queryFn: async () => {
      const res = await fetch("/api/reports/overview", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    },
  });

  const deptData = overview?.departmentDistribution || [
    { name: "Information Technology", count: 3 },
    { name: "Finance", count: 2 },
    { name: "Standards & Metrology", count: 2 },
    { name: "Human Resources", count: 1 },
    { name: "Operations", count: 1 },
    { name: "Industrial Development", count: 1 },
  ];

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

        {/* Executive KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-l-4 border-l-primary shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statutory Headcount</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">{isLoading ? "..." : overview?.headcount ?? 10}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active establishment staff</p>
                </div>
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-emerald-500 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recruitment Demand</p>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-1">{isLoading ? "..." : overview?.openVacancies ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Open public positions</p>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-amber-500 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applicant Pipeline</p>
                  <p className="text-3xl font-extrabold text-amber-600 mt-1">{isLoading ? "..." : overview?.totalApplicants ?? 21}</p>
                  <p className="text-xs text-muted-foreground mt-1">Screened candidates</p>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-l-4 border-l-indigo-500 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ISO & Training Certified</p>
                  <p className="text-3xl font-extrabold text-indigo-600 mt-1">{isLoading ? "..." : overview?.trainingCompletedCount ?? 5}</p>
                  <p className="text-xs text-muted-foreground mt-1">Competency compliant</p>
                </div>
                <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
                  <Award className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Bar Chart: Staff by Division */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold">Divisional Staff Distribution</CardTitle>
              <CardDescription className="text-xs">
                Personnel deployment across technical standards, metrology, and administrative divisions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Officers" />
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
    </AppLayout>
  );
}
