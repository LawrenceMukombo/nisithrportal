import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Building,
  Key,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  AlertCircle,
  Sparkles,
  Check,
  X,
  FileCheck,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useGetEmployees, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { getAuthHeader } from "@/lib/api-config";

interface HousingScheme {
  id: number;
  title: string;
  code: string;
  type: "institutional" | "home_ownership" | "commercial_rental" | "allowance";
  description: string | null;
  maxMonthlyAllowance: string | null;
  isActive: boolean;
}

interface HousingApplication {
  id: number;
  employeeId: number;
  employeeName: string;
  positionTitle?: string | null;
  employeePosition?: string | null;
  departmentName?: string | null;
  schemeId: number;
  schemeTitle: string;
  propertyAddress: string;
  landlordName: string | null;
  monthlyRentRequested: string;
  monthlyAllowanceApproved?: string | null;
  approvedAmount?: string | null;
  approvedAt?: string | null;
  leasePeriodMonths: number | null;
  status: "pending" | "submitted" | "under_review" | "approved" | "rejected" | "terminated" | string;
  reviewComments: string | null;
  createdAt: string;
}

export default function HousingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isHR, isExecutive } = useRole();
  const canManageHousing = isAdmin || isHR || isExecutive;
  const canReview = canManageHousing;

  const [activeTab, setActiveTab] = useState("applications");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedSchemeId, setSelectedSchemeId] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [leaseMonths, setLeaseMonths] = useState("12");

  const { data: rawEmployees = [] } = useGetEmployees(undefined, {
    query: { queryKey: getGetEmployeesQueryKey() },
  });
  const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    app: HousingApplication | null;
    status: "approved" | "rejected";
    approvedAmount: string;
    comments: string;
  }>({
    open: false,
    app: null,
    status: "approved",
    approvedAmount: "",
    comments: "",
  });

  // Fetch Schemes
  const { data: schemes = [], isLoading: isLoadingSchemes } = useQuery<HousingScheme[]>({
    queryKey: ["/api/housing/schemes"],
    queryFn: async () => {
      const res = await fetch("/api/housing/schemes");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Applications
  const { data: applications = [], isLoading: isLoadingApps } = useQuery<HousingApplication[]>({
    queryKey: ["/api/housing/applications"],
    queryFn: async () => {
      const res = await fetch("/api/housing/applications", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Submit Application Mutation
  const applyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/housing/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit housing application");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/housing/applications"] });
      toast({ title: "Application Lodged", description: "Your housing scheme request has been submitted for review." });
      setIsApplyOpen(false);
      setPropertyAddress("");
      setLandlordName("");
      setMonthlyRent("");
    },
    onError: (err: any) => {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    },
  });

  // Review Application Mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewComments, approvedAmount }: any) => {
      const res = await fetch(`/api/housing/applications/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status, reviewComments, approvedAmount }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/housing/applications"] });
      toast({ title: "Decision Saved", description: "Housing application updated successfully." });
      setReviewDialog({ open: false, app: null, status: "approved", approvedAmount: "", comments: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchemeId || !propertyAddress || !monthlyRent) return;
    const effectiveEmployeeId = selectedEmployeeId
      ? parseInt(selectedEmployeeId)
      : (employees[0]?.id ? employees[0].id : 1);
    applyMutation.mutate({
      employeeId: effectiveEmployeeId,
      schemeId: parseInt(selectedSchemeId),
      propertyAddress,
      landlordName,
      monthlyRentRequested: monthlyRent,
      leasePeriodMonths: parseInt(leaseMonths) || 12,
    });
  };

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchSearch =
        app.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
        app.propertyAddress?.toLowerCase().includes(search.toLowerCase()) ||
        app.landlordName?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || app.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [applications, search, statusFilter]);

  const totalPages = Math.ceil(filteredApps.length / pageSize) || 1;
  const paginatedApps = filteredApps.slice((page - 1) * pageSize, page * pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "under_review":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Under Review</Badge>;
      default:
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Submitted</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">NISIT Housing Scheme</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Accommodation Assistance
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Institutional staff rental assistance, homeownership advances, and residential subsidies
            </p>
          </div>
          <Button onClick={() => setIsApplyOpen(true)} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Apply for Housing Scheme
          </Button>
        </div>

        {/* Housing Schemes Catalogue */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Approved Housing Programmes
          </h2>
          {isLoadingSchemes ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4"><Skeleton className="h-36 w-full" /></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {schemes.map((s) => (
                <Card key={s.id} className="border-border/80 hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between">
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                        <Home className="w-5 h-5" />
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {(s.type || "scheme").replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-bold text-foreground mt-3">{s.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {s.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-3 text-xs">
                    <div className="p-2.5 bg-muted/40 rounded-lg text-muted-foreground text-[11px]">
                      <span className="font-semibold text-foreground">Eligibility:</span> {s.description || "Permanent & Contract Public Service Staff"}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                      <span className="text-muted-foreground font-medium">Max Allowance:</span>
                      <span className="font-bold text-primary">
                        {s.maxMonthlyAllowance ? `PGK ${s.maxMonthlyAllowance}/mo` : "Case-by-case"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Housing Applications Table */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 border-b border-border/60">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search staff, property address, landlord..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 bg-background"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40 text-xs bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Applications</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            {isLoadingApps ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : paginatedApps.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Home className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-base font-semibold text-foreground">No Housing Applications</p>
                <p className="text-xs text-muted-foreground">Click 'Apply for Housing Scheme' to submit a request.</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                  <tr>
                    <th className="p-3.5 pl-6">Applicant</th>
                    <th className="p-3.5">Scheme Type</th>
                    <th className="p-3.5">Property Location</th>
                    <th className="p-3.5">Landlord</th>
                    <th className="p-3.5">Rent / Allowance</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedApps.map((app) => (
                    <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 pl-6 font-semibold text-foreground">
                        {app.employeeName || "Active Officer"}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {app.employeePosition || "Officer"}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-foreground">{app.schemeTitle}</td>
                      <td className="p-3.5 text-muted-foreground max-w-xs truncate" title={app.propertyAddress}>
                        {app.propertyAddress}
                      </td>
                      <td className="p-3.5 text-muted-foreground">{app.landlordName || "NHC / Direct"}</td>
                      <td className="p-3.5 font-bold text-foreground">
                        PGK {app.approvedAmount || app.monthlyRentRequested}
                        <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                      </td>
                      <td className="p-3.5">{getStatusBadge(app.status)}</td>
                      <td className="p-3.5 pr-6 text-right">
                        {app.status === "submitted" && canReview ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                              onClick={() =>
                                setReviewDialog({
                                  open: true,
                                  app,
                                  status: "approved",
                                  approvedAmount: app.monthlyRentRequested,
                                  comments: "",
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
                                  app,
                                  status: "rejected",
                                  approvedAmount: "0",
                                  comments: "",
                                })
                              }
                            >
                              <X className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {app.status === "approved" ? "Active Lease" : "Processed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            {filteredApps.length > 0 && (
              <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredApps.length)} of{" "}
                  {filteredApps.length} applications
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
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleApplySubmit}>
              <DialogHeader>
                <DialogTitle>Housing Scheme Application</DialogTitle>
                <DialogDescription>
                  Apply for rental assistance or homeownership subsidy.
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
                  <label className="font-medium text-foreground block mb-1">Target Housing Scheme *</label>
                  <Select value={selectedSchemeId} onValueChange={setSelectedSchemeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      {schemes.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.title} (Max: PGK {s.maxMonthlyAllowance || "N/A"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Property Location / Address *</label>
                  <Input
                    placeholder="Section, Lot, Street, Suburb, Port Moresby"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Landlord / Owner Name</label>
                    <Input
                      placeholder="e.g. Pacific Properties Ltd"
                      value={landlordName}
                      onChange={(e) => setLandlordName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Monthly Rent (PGK) *</label>
                    <Input
                      type="number"
                      placeholder="2500"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Lease Duration (Months)</label>
                  <Input type="number" min="1" max="36" value={leaseMonths} onChange={(e) => setLeaseMonths(e.target.value)} />
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

        {/* Review Dialog */}
        <Dialog
          open={reviewDialog.open}
          onOpenChange={(open) => !open && setReviewDialog({ ...reviewDialog, open: false })}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {reviewDialog.status === "approved" ? "Approve Housing Assistance" : "Reject Housing Application"}
              </DialogTitle>
              <DialogDescription>
                {reviewDialog.app?.employeeName} • {reviewDialog.app?.schemeTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              {reviewDialog.status === "approved" && (
                <div>
                  <label className="font-medium text-foreground block mb-1">Approved Monthly Subsidy (PGK)</label>
                  <Input
                    type="number"
                    value={reviewDialog.approvedAmount}
                    onChange={(e) => setReviewDialog({ ...reviewDialog, approvedAmount: e.target.value })}
                    required
                  />
                </div>
              )}

              <div>
                <label className="font-medium text-foreground block mb-1">Review Committee Remarks</label>
                <Textarea
                  placeholder="Notes on committee decision or tenancy conditions..."
                  value={reviewDialog.comments}
                  onChange={(e) => setReviewDialog({ ...reviewDialog, comments: e.target.value })}
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
                  if (reviewDialog.app) {
                    reviewMutation.mutate({
                      id: reviewDialog.app.id,
                      status: reviewDialog.status,
                      reviewComments: reviewDialog.comments,
                      approvedAmount: reviewDialog.approvedAmount,
                    });
                  }
                }}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? "Saving..." : `Confirm ${reviewDialog.status === "approved" ? "Approval" : "Rejection"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
