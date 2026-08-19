import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  CheckCircle2,
  Clock,
  Laptop,
  Shield,
  Briefcase,
  FileCheck,
  Search,
  Plus,
  AlertCircle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";

interface OnboardingTask {
  id: number;
  workflowId: number;
  title: string;
  description: string | null;
  category: "hr" | "it" | "manager" | "employee";
  assignedRole: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completedAt: string | null;
  notes: string | null;
}

interface OnboardingWorkflow {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string | null;
  employeePosition: string | null;
  status: "in_progress" | "completed" | "cancelled";
  startDate: string;
  targetCompletionDate: string | null;
  notes: string | null;
  createdAt: string;
  tasks: OnboardingTask[];
}

export default function OnboardingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR } = useRole();

  const [search, setSearch] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch Onboarding Workflows
  const { data: workflows = [], isLoading } = useQuery<OnboardingWorkflow[]>({
    queryKey: ["/api/onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Employees for dropdown
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Auto select first workflow
  const activeWorkflow = useMemo(() => {
    if (selectedWorkflowId) {
      return workflows.find((w) => w.id === selectedWorkflowId) || workflows[0] || null;
    }
    return workflows[0] || null;
  }, [workflows, selectedWorkflowId]);

  // Initiate Onboarding Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to initiate onboarding");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      toast({ title: "Onboarding Initiated", description: "Standard checklist created for employee." });
      setIsNewOpen(false);
      setSelectedWorkflowId(data.id);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Toggle Task Mutation
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const res = await fetch(`/api/onboarding/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !startDate) return;
    createMutation.mutate({
      employeeId: parseInt(selectedEmployeeId),
      startDate,
      targetCompletionDate: targetDate || null,
      notes,
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "it":
        return <Laptop className="w-4 h-4 text-blue-500" />;
      case "manager":
        return <Briefcase className="w-4 h-4 text-amber-500" />;
      case "employee":
        return <FileCheck className="w-4 h-4 text-purple-500" />;
      default:
        return <Shield className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Employee Onboarding</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Cross-Functional Workflow
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Structured 7-step induction, hardware provisioning, and compliance checklist for new NISIT appointees
            </p>
          </div>
          {(isAdmin || isHR) && (
            <Button onClick={() => setIsNewOpen(true)} className="shadow-sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Initiate Onboarding
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-5"><Skeleton className="h-64 w-full" /></Card>
            <Card className="lg:col-span-2 p-5"><Skeleton className="h-64 w-full" /></Card>
          </div>
        ) : workflows.length === 0 ? (
          <Card className="p-12 text-center shadow-sm">
            <UserCheck className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-bold text-foreground">No Onboarding Workflows Active</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              When new staff members are appointed, initiate an onboarding workflow to coordinate IT, HR, and manager tasks.
            </p>
            <Button onClick={() => setIsNewOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Start First Onboarding
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Workflows List */}
            <Card className="shadow-sm h-fit">
              <CardHeader className="p-4 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Active Workflows ({workflows.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {workflows.map((wf) => {
                  const isSelected = (activeWorkflow?.id === wf.id);
                  const totalTasks = wf.tasks.length;
                  const completedTasks = wf.tasks.filter((t) => t.status === "completed").length;
                  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                  return (
                    <button
                      key={wf.id}
                      onClick={() => setSelectedWorkflowId(wf.id)}
                      className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                        isSelected
                          ? "bg-primary/10 border-primary/40 text-foreground shadow-xs"
                          : "border-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-xs text-foreground">{wf.employeeName}</p>
                          <p className="text-[11px] text-muted-foreground">{wf.employeePosition || "Appointed Officer"}</p>
                        </div>
                        <Badge
                          variant={wf.status === "completed" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-semibold"
                        >
                          {wf.status === "completed" ? "Completed" : `${pct}% Done`}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <Progress value={pct} className="h-1.5" />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Start: {wf.startDate}</span>
                          <span>{completedTasks} / {totalTasks} Tasks</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Right Column: Workflow Detail & Checklist */}
            {activeWorkflow && (
              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold">{activeWorkflow.employeeName}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {activeWorkflow.employeePosition || "Statutory Staff"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        Commenced: {activeWorkflow.startDate} • Email: {activeWorkflow.employeeEmail || "Pending Provisioning"}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeWorkflow.status === "completed" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Onboarding Cleared
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          <Clock className="w-3.5 h-3.5 mr-1" /> In Progress
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Onboarding Checklist & Milestones
                  </p>

                  <div className="space-y-2.5">
                    {activeWorkflow.tasks.map((task, idx) => {
                      const isCompleted = task.status === "completed";
                      return (
                        <div
                          key={task.id}
                          className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all ${
                            isCompleted
                              ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                              : "bg-card border-border hover:border-primary/40 shadow-xs"
                          }`}
                        >
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={(checked) => {
                                toggleTaskMutation.mutate({
                                  taskId: task.id,
                                  status: checked ? "completed" : "pending",
                                });
                              }}
                              className="w-4 h-4"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-semibold ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {idx + 1}. {task.title}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 flex items-center gap-1">
                                {getCategoryIcon(task.category)}
                                <span className="uppercase">{task.category}</span>
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            {isCompleted ? (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                                Done
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Initiate Modal */}
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle>Initiate Staff Onboarding</DialogTitle>
                <DialogDescription>
                  Generate standard 7-step checklist for a new NISIT employee.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Select Employee *</label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose appointee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.name} ({emp.title || "Officer"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Commencement Date *</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Target 90-Day Probation</label>
                    <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Induction Notes / Instructions</label>
                  <Textarea
                    placeholder="Specific equipment, security clearance, or mentor assignment notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Initiating..." : "Launch Onboarding"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
