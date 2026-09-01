import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Filter,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";

interface LeaveType {
  id: number;
  name: string;
  code: string;
  defaultDays: number;
  carryOverMax: number;
  isPaid: boolean;
  description: string;
}

interface LeaveBalance {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  leaveTypeName: string;
  leaveTypeCode: string;
  year: number;
  allocatedDays: string;
  usedDays: string;
  pendingDays: string;
}

interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approverComment: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export default function LeaveManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isHR, isHiringManager } = useRole();
  const canApprove = isAdmin || isHR || isHiringManager;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: rawEmployees = [] } = useGetEmployees(undefined, {
    query: { queryKey: getGetEmployeesQueryKey() },
  });
  const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    request: LeaveRequest | null;
    status: "approved" | "rejected";
    comment: string;
  }>({
    open: false,
    request: null,
    status: "approved",
    comment: "",
  });

  // Calculate days between start and end date
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [startDate, endDate]);

  // Fetch Leave Types
  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ["/api/leave/types"],
    queryFn: async () => {
      const res = await fetch("/api/leave/types");
      if (!res.ok) throw new Error("Failed to fetch leave types");
      return res.json();
    },
  });

  // Fetch Balances for active employee
  const { data: balances = [], isLoading: isLoadingBalances } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave/balances"],
    queryFn: async () => {
      const res = await fetch("/api/leave/balances", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Leave Requests
  const { data: requests = [], isLoading: isLoadingRequests } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave/requests"],
    queryFn: async () => {
      const res = await fetch("/api/leave/requests", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Submit Leave Request Mutation
  const applyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/leave/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      toast({ title: "Success", description: "Leave request submitted successfully for approval." });
      setIsApplyOpen(false);
      setSelectedType("");
      setStartDate("");
      setEndDate("");
      setReason("");
    },
    onError: (err: any) => {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, approverComment }: { id: number; status: string; approverComment: string }) => {
      const res = await fetch(`/api/leave/requests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status, approverComment }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/balances"] });
      toast({ title: "Status Updated", description: "Leave request decision recorded successfully." });
      setReviewDialog({ open: false, request: null, status: "approved", comment: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !startDate || !endDate || !reason) {
      toast({ title: "Incomplete Form", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (endDate < startDate || calculatedDays < 1) {
      toast({ title: "Invalid leave dates", description: "The end date must be on or after the start date.", variant: "destructive" });
      return;
    }
    const effectiveEmployeeId = selectedEmployeeId
      ? parseInt(selectedEmployeeId)
      : (employees[0]?.id ? employees[0].id : 1);

    applyMutation.mutate({
      employeeId: effectiveEmployeeId,
      leaveTypeId: parseInt(selectedType),
      startDate,
      endDate,
      days: calculatedDays,
      reason,
    });
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch =
        r.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
        r.reason?.toLowerCase().includes(search.toLowerCase()) ||
        r.leaveTypeName?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchType = typeFilter === "all" || String(r.leaveTypeId) === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [requests, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Pending</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave & Absence Management</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                ESS & Approvals
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Apply for annual, medical, or study leave and track departmental leave approvals
            </p>
          </div>
          <Button onClick={() => setIsApplyOpen(true)} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Apply for Leave
          </Button>
        </div>

        {/* Leave Balances Grid */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            2026 Entitlements & Balances
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {isLoadingBalances ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            ) : balances.length === 0 ? (
              leaveTypes.map((lt) => (
                <Card key={lt.id} className="bg-card border-border/80">
                  <CardContent className="p-3.5">
                    <p className="text-xs font-semibold text-muted-foreground truncate">{lt.name}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{lt.defaultDays} <span className="text-xs font-normal text-muted-foreground">days</span></p>
                    <p className="text-[10px] text-muted-foreground mt-1">Standard Entitlement</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              balances.map((b) => {
                const total = parseFloat(b.allocatedDays) || 0;
                const used = parseFloat(b.usedDays) || 0;
                const pending = parseFloat(b.pendingDays) || 0;
                const remaining = Math.max(0, total - used - pending);
                return (
                  <Card key={b.id} className="bg-card border-border/80 hover:border-primary/40 transition-colors">
                    <CardContent className="p-3.5">
                      <p className="text-xs font-semibold text-muted-foreground truncate">{b.leaveTypeName}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {remaining}{" "}
                        <span className="text-xs font-normal text-muted-foreground">/ {total}d</span>
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                        <span>Used: {used}d</span>
                        {pending > 0 && <span className="text-amber-600 font-medium">Pending: {pending}d</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Requests Filter & Search Bar */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 border-b border-border/60">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search staff, leave type, reason..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 bg-background"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-36 text-xs bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-44 text-xs bg-background">
                    <SelectValue placeholder="Leave Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          {/* Table */}
          <CardContent className="p-0 overflow-x-auto">
            {isLoadingRequests ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : paginatedRequests.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <p className="text-base font-semibold text-foreground">No leave requests found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Submit a new request or adjust your search filters above.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                  <tr>
                    <th className="p-3.5 pl-6">Officer Name</th>
                    <th className="p-3.5">Leave Type</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5">Days</th>
                    <th className="p-3.5">Reason / Justification</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 pl-6 font-semibold text-foreground">{req.employeeName || "Active Officer"}</td>
                      <td className="p-3.5">
                        <span className="font-medium text-foreground">{req.leaveTypeName}</span>
                      </td>
                      <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                        {req.startDate} to {req.endDate}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="secondary" className="font-semibold">
                          {req.days} days
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="p-3.5">{getStatusBadge(req.status)}</td>
                      <td className="p-3.5 pr-6 text-right">
                        {req.status === "pending" && canApprove ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                              onClick={() =>
                                setReviewDialog({
                                  open: true,
                                  request: req,
                                  status: "approved",
                                  comment: "",
                                })
                              }
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() =>
                                setReviewDialog({
                                  open: true,
                                  request: req,
                                  status: "rejected",
                                  comment: "",
                                })
                              }
                            >
                              <X className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            {req.status === "pending" ? "Awaiting Review" : "Processed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            {filteredRequests.length > 0 && (
              <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredRequests.length)} of{" "}
                  {filteredRequests.length} requests
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-2 font-medium text-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Apply Modal */}
        <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleApply}>
              <DialogHeader>
                <DialogTitle>Submit Leave Application</DialogTitle>
                <DialogDescription>
                  Apply for scheduled absence in compliance with NISIT HR policies and General Orders.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Staff Member *</label>
                  <Select
                    value={selectedEmployeeId || (employees[0]?.id ? String(employees[0].id) : "")}
                    onValueChange={setSelectedEmployeeId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select staff member" />
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
                  <label className="font-medium text-foreground block mb-1.5">Leave Category *</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select leave entitlement" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.defaultDays} days default)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1.5">Start Date *</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1.5">End Date *</label>
                    <Input type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Calculated Calendar Days:</span>
                    <Badge variant="outline" className="font-bold text-foreground bg-background">
                      {calculatedDays} Days
                    </Badge>
                  </div>
                )}

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Reason & Handover Details *</label>
                  <Textarea
                    placeholder="Provide purpose of leave and designated officer covering urgent duties..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsApplyOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Review Approval Modal */}
        <Dialog
          open={reviewDialog.open}
          onOpenChange={(open) => !open && setReviewDialog({ ...reviewDialog, open: false })}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {reviewDialog.status === "approved" ? "Approve Leave Request" : "Reject Leave Request"}
              </DialogTitle>
              <DialogDescription>
                {reviewDialog.request?.employeeName} • {reviewDialog.request?.days} days ({reviewDialog.request?.leaveTypeName})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Duration:</span> {reviewDialog.request?.startDate} to{" "}
                  {reviewDialog.request?.endDate}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Reason:</span> {reviewDialog.request?.reason}
                </p>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1.5">Approver Comments (Optional)</label>
                <Textarea
                  placeholder="Add notes or conditional approvals..."
                  value={reviewDialog.comment}
                  onChange={(e) => setReviewDialog({ ...reviewDialog, comment: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog({ ...reviewDialog, open: false })}>
                Cancel
              </Button>
              <Button
                variant={reviewDialog.status === "approved" ? "default" : "destructive"}
                onClick={() => {
                  if (reviewDialog.request) {
                    updateStatusMutation.mutate({
                      id: reviewDialog.request.id,
                      status: reviewDialog.status,
                      approverComment: reviewDialog.comment,
                    });
                  }
                }}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Recording..." : `Confirm ${reviewDialog.status === "approved" ? "Approval" : "Rejection"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
