import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserMinus,
  CheckCircle2,
  Clock,
  Laptop,
  KeyRound,
  FileText,
  DollarSign,
  Search,
  Plus,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
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

interface OffboardingTask {
  id: number;
  workflowId: number;
  title: string;
  category: "hr" | "it" | "finance" | "assets" | "admin" | string;
  assignedRole?: string | null;
  assignedToUserId?: number | null;
  status: "pending" | "completed" | "cleared" | "waived" | "flagged" | string;
  completedAt?: string | null;
  clearedAt?: string | null;
  clearedBy?: string | null;
  notes: string | null;
}

interface OffboardingWorkflow {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string | null;
  employeePosition: string | null;
  reason?: string;
  separationType?: string;
  separationDate?: string;
  lastWorkingDay?: string;
  status?: string;
  clearanceStatus?: string;
  exitInterviewDone?: boolean;
  exitInterviewNotes: string | null;
  handoverCompleted?: boolean;
  createdAt: string;
  tasks: OffboardingTask[];
}

export default function OffboardingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR } = useRole();

  const [search, setSearch] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [separationType, setSeparationType] = useState("resignation");
  const [lastDay, setLastDay] = useState(new Date().toISOString().split("T")[0]);
  const [exitNotes, setExitNotes] = useState("");

  // Fetch Offboarding Workflows
  const { data: workflows = [], isLoading } = useQuery<OffboardingWorkflow[]>({
    queryKey: ["/api/offboarding"],
    queryFn: async () => {
      const res = await fetch("/api/offboarding", {
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

  const activeWorkflow = useMemo(() => {
    if (selectedWorkflowId) {
      return workflows.find((w) => w.id === selectedWorkflowId) || workflows[0] || null;
    }
    return workflows[0] || null;
  }, [workflows, selectedWorkflowId]);

  // Initiate Offboarding Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/offboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to initiate offboarding");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/offboarding"] });
      toast({ title: "Offboarding Initiated", description: "Standard separation checklist created." });
      setIsNewOpen(false);
      setSelectedWorkflowId(data.id);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Toggle Clearance Task Mutation with Optimistic UI Update
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const res = await fetch(`/api/offboarding/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status, notes: `Marked ${status} via HR Portal` }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update clearance task");
      }
      return res.json();
    },
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/offboarding"] });
      const previousWorkflows = queryClient.getQueryData<OffboardingWorkflow[]>(["/api/offboarding"]);

      if (previousWorkflows) {
        queryClient.setQueryData<OffboardingWorkflow[]>(["/api/offboarding"], (old) => {
          if (!old) return [];
          return old.map((wf) => {
            const hasTask = (wf.tasks ?? []).some((t) => t.id === taskId);
            if (!hasTask) return wf;
            const updatedTasks = (wf.tasks ?? []).map((t) =>
              t.id === taskId ? { ...t, status } : t
            );
            return { ...wf, tasks: updatedTasks };
          });
        });
      }

      return { previousWorkflows };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousWorkflows) {
        queryClient.setQueryData(["/api/offboarding"], context.previousWorkflows);
      }
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/offboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
    onSuccess: () => {
      toast({ title: "Clearance Task Updated" });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !separationType || !lastDay) return;
    createMutation.mutate({
      employeeId: parseInt(selectedEmployeeId, 10),
      reason: separationType,
      separationDate: lastDay,
      exitInterviewNotes: exitNotes,
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "assets":
        return <Laptop className="w-4 h-4 text-blue-500" />;
      case "it":
        return <KeyRound className="w-4 h-4 text-rose-500" />;
      case "finance":
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileText className="w-4 h-4 text-purple-500" />;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Offboarding & Clearance</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Separation Protocol
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Asset return, IT access revocation, exit interviews, and final gratuity clearance workflows
            </p>
          </div>
          {(isAdmin || isHR) && (
            <Button onClick={() => setIsNewOpen(true)} className="shadow-sm" variant="destructive">
              <UserMinus className="w-4 h-4 mr-2" />
              Initiate Offboarding
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
            <UserMinus className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No Active Offboarding Workflows</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              All personnel are currently active in service. Initiate an offboarding workflow when an officer separates or retires.
            </p>
            {(isAdmin || isHR) && (
              <Button size="sm" variant="outline" onClick={() => setIsNewOpen(true)}>
                Initiate Separation
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Workflows List */}
            <Card className="shadow-sm h-fit">
              <CardHeader className="p-4 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Separations ({workflows.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {workflows.map((wf) => {
                  const isSelected = activeWorkflow?.id === wf.id;
                  const tasks = wf.tasks ?? [];
                  const totalTasks = tasks.length;
                  const completedTasks = tasks.filter((t) => t.status === "completed" || t.status === "cleared").length;
                  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                  const isCleared = wf.status === "completed" || wf.clearanceStatus === "cleared" || (totalTasks > 0 && completedTasks === totalTasks);

                  return (
                    <button
                      key={wf.id}
                      onClick={() => setSelectedWorkflowId(wf.id)}
                      className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                        isSelected
                          ? "bg-rose-500/10 border-rose-500/40 text-foreground shadow-xs"
                          : "border-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-xs text-foreground">{wf.employeeName || `Employee #${wf.employeeId}`}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">Type: {(wf.reason || wf.separationType || "separation").replace("_", " ")}</p>
                        </div>
                        <Badge
                          variant={isCleared ? "default" : "secondary"}
                          className="text-[10px] uppercase font-semibold"
                        >
                          {isCleared ? "Cleared" : `${pct}% Done`}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <Progress value={pct} className="h-1.5" />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Date: {wf.separationDate || wf.lastWorkingDay || "Pending"}</span>
                          <span>{completedTasks} / {totalTasks} Cleared</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Right Column: Workflow Detail & Clearance Checklist */}
            {activeWorkflow && (
              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold">{activeWorkflow.employeeName || `Employee #${activeWorkflow.employeeId}`}</CardTitle>
                        <Badge variant="outline" className="text-xs capitalize">
                          {(activeWorkflow.reason || activeWorkflow.separationType || "separation").replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        Separation Effective Date: {activeWorkflow.separationDate || activeWorkflow.lastWorkingDay || "Pending"} • Designation: {activeWorkflow.employeePosition || "Officer"}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {(activeWorkflow.status === "completed" || activeWorkflow.clearanceStatus === "cleared" || (activeWorkflow.tasks?.length > 0 && activeWorkflow.tasks.every(t => t.status === "completed" || t.status === "cleared"))) ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Fully Cleared & Archived
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
                          <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Clearance Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {activeWorkflow.exitInterviewNotes && (
                    <div className="mt-3 p-3 bg-background rounded-lg border border-border/60 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Exit Notes:</span> {activeWorkflow.exitInterviewNotes}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Statutory Separation Checklist & Sign-Offs
                  </p>

                  <div className="space-y-2.5">
                    {(activeWorkflow.tasks ?? []).map((task, idx) => {
                      const isCompleted = task.status === "completed" || task.status === "cleared";
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
                                <span className="uppercase">{(task.category || "general").replace("_", " ")}</span>
                              </Badge>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {isCompleted ? (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                                Cleared
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

        {/* Initiate Offboarding Modal */}
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle>Initiate Officer Separation</DialogTitle>
                <DialogDescription>
                  Start statutory asset return and clearance workflow.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Select Employee *</label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose employee" />
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

                <div>
                  <label className="font-medium text-foreground block mb-1">Separation Reason *</label>
                  <Select value={separationType} onValueChange={setSeparationType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resignation">Voluntary Resignation</SelectItem>
                      <SelectItem value="retirement">Statutory Retirement</SelectItem>
                      <SelectItem value="contract_end">Contract Completion / Expiry</SelectItem>
                      <SelectItem value="redundancy">Organisational Restructuring</SelectItem>
                      <SelectItem value="termination">Disciplinary Separation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Effective Separation Date *</label>
                  <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} required />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Exit Interview Notes</label>
                  <Textarea
                    placeholder="Key feedback, handover officer designation, or special arrangements..."
                    value={exitNotes}
                    onChange={(e) => setExitNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Initiating..." : "Launch Separation Workflow"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
