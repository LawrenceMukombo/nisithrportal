import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Target,
  Award,
  TrendingUp,
  Star,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";

interface PerformanceCycle {
  id: number;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "completed" | "archived";
  description: string | null;
}

interface Goal {
  id: number;
  employeeId: number;
  employeeName: string;
  title: string;
  category: "strategic" | "operational" | "metrology_technical" | "development";
  description: string | null;
  weight: number;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  status: "draft" | "in_progress" | "achieved" | "deferred";
  dueDate: string | null;
  progressPercent: number;
}

interface PerformanceReview {
  id: number;
  cycleId: number;
  cycleTitle: string;
  employeeId: number;
  employeeName: string;
  employeePosition: string | null;
  status: "draft" | "submitted" | "manager_review" | "finalized";
  selfRating: string | null;
  managerRating: string | null;
  finalRating: string | null;
  strengths: string | null;
  improvementAreas: string | null;
  createdAt: string;
}

export default function PerformancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR, isHiringManager } = useRole();

  const [activeTab, setActiveTab] = useState("okrs");
  const [isGoalOpen, setIsGoalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState("operational");
  const [goalTarget, setGoalTarget] = useState("100");
  const [goalCurrent, setGoalCurrent] = useState("25");
  const [goalUnit, setGoalUnit] = useState("%");
  const [goalWeight, setGoalWeight] = useState("20");
  const [goalDueDate, setGoalDueDate] = useState("2026-12-31");
  const [goalDescription, setGoalDescription] = useState("");

  // Fetch Cycles
  const { data: cycles = [] } = useQuery<PerformanceCycle[]>({
    queryKey: ["/api/performance/cycles"],
    queryFn: async () => {
      const res = await fetch("/api/performance/cycles", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Goals / OKRs
  const { data: goals = [], isLoading: isLoadingGoals } = useQuery<Goal[]>({
    queryKey: ["/api/performance/goals"],
    queryFn: async () => {
      const res = await fetch("/api/performance/goals", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Reviews
  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery<PerformanceReview[]>({
    queryKey: ["/api/performance/reviews"],
    queryFn: async () => {
      const res = await fetch("/api/performance/reviews", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeReview = reviews[0] || null;

  // Add Goal Mutation
  const addGoalMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/performance/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/reviews"] });
      toast({ title: "Goal Created", description: "Strategic objective registered." });
      setIsGoalOpen(false);
      setGoalTitle("");
      setGoalDescription("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Update Progress Mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ goalId, progressPercentage }: { goalId: number; progressPercentage: number }) => {
      const res = await fetch(`/api/performance/goals/${goalId}/progress`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ progressPercentage }),
      });
      if (!res.ok) throw new Error("Failed to update goal progress");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/reviews"] });
    },
  });

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle) return;
    addGoalMutation.mutate({
      employeeId: 1,
      title: goalTitle,
      category: goalCategory,
      targetValue: goalTarget,
      currentValue: goalCurrent,
      unit: goalUnit,
      weightage: parseInt(goalWeight) || 20,
      targetDate: goalDueDate,
      description: goalDescription,
    });
  };

  const activeCycle = cycles[0] || { title: "2026 NISIT Annual Appraisal & OKR Cycle", type: "Annual" };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Performance & Strategic OKRs</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                KPI & Appraisal
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Annual performance reviews, competency ratings, and organizational OKR progress tracking
            </p>
          </div>
          <Button onClick={() => setIsGoalOpen(true)} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Set New OKR Goal
          </Button>
        </div>

        {/* Active Cycle Banner */}
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-sm">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-xs">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider mb-1">
                  Active Cycle
                </Badge>
                <h2 className="text-base font-bold text-foreground">{activeCycle.title}</h2>
                <p className="text-xs text-muted-foreground">
                  Evaluation Period: 01 Jan 2026 – 31 Dec 2026 • Statutory Merit Review
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mid-Year Phase Active
            </Badge>
          </CardContent>
        </Card>

        {/* Tabs: OKRs vs Appraisal Reviews */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="okrs" className="text-xs font-semibold">
              <Target className="w-3.5 h-3.5 mr-1.5" /> Objectives & Key Results (OKRs)
            </TabsTrigger>
            <TabsTrigger value="reviews" className="text-xs font-semibold">
              <Star className="w-3.5 h-3.5 mr-1.5" /> Performance Reviews & Ratings
            </TabsTrigger>
          </TabsList>

          {/* OKRs Tab */}
          <TabsContent value="okrs" className="space-y-4">
            {isLoadingGoals ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-5"><Skeleton className="h-32 w-full" /></Card>
                ))}
              </div>
            ) : goals.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <Target className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold text-foreground">No OKR Goals Configured</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                  Define strategic, technical calibration, or operational goals to track quarterly and annual outcomes.
                </p>
                <Button onClick={() => setIsGoalOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Add First Objective
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((goal) => {
                  const targetNum = parseFloat(goal.targetValue || "100") || 100;
                  const currentNum = parseFloat(goal.currentValue || "0") || 0;
                  const pct = Math.min(100, Math.round((currentNum / targetNum) * 100));

                  return (
                    <Card key={goal.id} className="border-border/80 hover:border-primary/40 transition-all shadow-xs">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold mb-1.5">
                              {goal.category.replace("_", " ")}
                            </Badge>
                            <CardTitle className="text-sm font-bold text-foreground">{goal.title}</CardTitle>
                          </div>
                          <Badge variant="secondary" className="text-xs font-bold">
                            Weight: {goal.weight}%
                          </Badge>
                        </div>
                        {goal.description && (
                          <CardDescription className="text-xs mt-1 line-clamp-2">{goal.description}</CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="p-5 pt-1 space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Achievement Progress</span>
                            <span className="font-bold text-foreground">
                              {goal.currentValue ?? 0} / {goal.targetValue ?? 100} {goal.unit || "%"} ({pct}%)
                            </span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                          <span>Assigned: {goal.employeeName}</span>
                          <span>Due: {goal.dueDate || "31 Dec 2026"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            {isLoadingReviews ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <Award className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold text-foreground">No Appraisals Logged</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Annual appraisal submissions will appear here once self-assessments are lodged by staff.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <Card key={rev.id} className="shadow-xs hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground">{rev.employeeName}</p>
                          <Badge variant="outline" className="text-xs">
                            {rev.employeePosition || "Staff Officer"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Cycle: {rev.cycleTitle}</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Self Rating</p>
                          <p className="text-sm font-bold text-foreground">{rev.selfRating ? `${rev.selfRating} / 5` : "Pending"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Manager Rating</p>
                          <p className="text-sm font-bold text-foreground">{rev.managerRating ? `${rev.managerRating} / 5` : "Pending"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Final Rating</p>
                          <Badge className="bg-primary/15 text-primary border-primary/30 font-bold">
                            {rev.finalRating ? `${rev.finalRating} / 5.0` : "In Review"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Set Goal Modal */}
        <Dialog open={isGoalOpen} onOpenChange={setIsGoalOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateGoal}>
              <DialogHeader>
                <DialogTitle>Set OKR / Performance Objective</DialogTitle>
                <DialogDescription>
                  Define measurable key result for the 2026 statutory performance period.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Objective Title *</label>
                  <Input
                    placeholder="e.g. Complete ISO 17025 surveillance audit for Metrology Lab"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Category</label>
                    <Select value={goalCategory} onValueChange={setGoalCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strategic">Strategic Priority</SelectItem>
                        <SelectItem value="operational">Operational & Delivery</SelectItem>
                        <SelectItem value="metrology_technical">Standards & Metrology</SelectItem>
                        <SelectItem value="development">Professional Growth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1">Weight (%)</label>
                    <Input type="number" min="5" max="100" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Target</label>
                    <Input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Current</label>
                    <Input value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Unit</label>
                    <Input value={goalUnit} onChange={(e) => setGoalUnit(e.target.value)} placeholder="%, audits, etc" />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Target Completion Date</label>
                  <Input type="date" value={goalDueDate} onChange={(e) => setGoalDueDate(e.target.value)} />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Description & Verification Method</label>
                  <Textarea
                    placeholder="Provide specific metrics and evidence required..."
                    value={goalDescription}
                    onChange={(e) => setGoalDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsGoalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addGoalMutation.isPending}>
                  {addGoalMutation.isPending ? "Saving..." : "Create Objective"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
