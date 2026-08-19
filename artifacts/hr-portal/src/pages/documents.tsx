import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderLock,
  FileText,
  FileCheck,
  Upload,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileBadge,
} from "lucide-react";
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

interface EmployeeDoc {
  id: number;
  employeeId: number;
  employeeName: string;
  category: "contract" | "identification" | "qualification" | "medical" | "appraisal" | "disciplinary" | "other";
  title: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  expiryDate: string | null;
  createdAt: string;
}

export default function DocumentsVaultPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR } = useRole();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("identification");
  const [docUrl, setDocUrl] = useState("https://storage.nisit.gov.pg/documents/sample-doc.pdf");
  const [docExpiry, setDocExpiry] = useState("");

  // Fetch Documents
  const { data: documents = [], isLoading } = useQuery<EmployeeDoc[]>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to register document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document Stored", description: "File securely registered in employee records." });
      setIsUploadOpen(false);
      setDocTitle("");
      setDocExpiry("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Deleted", description: "Document record removed." });
    },
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docUrl) return;
    uploadMutation.mutate({
      employeeId: 1,
      category: docCategory,
      title: docTitle,
      fileUrl: docUrl,
      fileSize: 1024 * 350,
      mimeType: "application/pdf",
      expiryDate: docExpiry || null,
    });
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchSearch =
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.employeeName?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "all" || doc.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [documents, search, categoryFilter]);

  const totalPages = Math.ceil(filteredDocs.length / pageSize) || 1;
  const paginatedDocs = filteredDocs.slice((page - 1) * pageSize, page * pageSize);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "contract":
        return <Badge variant="outline" className="text-primary border-primary/30">Contract</Badge>;
      case "identification":
        return <Badge variant="outline" className="text-blue-600 border-blue-500/30">National ID / Passport</Badge>;
      case "qualification":
        return <Badge variant="outline" className="text-purple-600 border-purple-500/30">Degree / Qualification</Badge>;
      case "medical":
        return <Badge variant="outline" className="text-rose-600 border-rose-500/30">Medical Clearance</Badge>;
      default:
        return <Badge variant="secondary">{category}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Employee Document Vault</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Statutory Records
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Secure centralized repository for official contracts, qualifications, national IDs, and medical records
            </p>
          </div>
          <Button onClick={() => setIsUploadOpen(true)} className="shadow-sm">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Filters & Search */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 border-b border-border/60">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search document title or employee..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 bg-background"
                />
              </div>

              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setCategoryFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48 text-xs bg-background">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Document Types</SelectItem>
                  <SelectItem value="contract">Contracts & Appointments</SelectItem>
                  <SelectItem value="identification">National IDs & Passports</SelectItem>
                  <SelectItem value="qualification">Degrees & Certifications</SelectItem>
                  <SelectItem value="medical">Medical Clearances</SelectItem>
                  <SelectItem value="appraisal">Appraisals & Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : paginatedDocs.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <FolderLock className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-base font-semibold text-foreground">No documents found</p>
                <p className="text-xs text-muted-foreground">Upload official records or adjust filter criteria.</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/80">
                  <tr>
                    <th className="p-3.5 pl-6">Document Title</th>
                    <th className="p-3.5">Owner / Officer</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Expiry / Validity</th>
                    <th className="p-3.5">Upload Date</th>
                    <th className="p-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 pl-6 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span>{doc.title}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-foreground">{doc.employeeName || "Active Officer"}</td>
                      <td className="p-3.5">{getCategoryBadge(doc.category)}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {doc.expiryDate ? (
                          <span className="flex items-center gap-1">
                            {doc.expiryDate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/70">Permanent</span>
                        )}
                      </td>
                      <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => window.open(doc.fileUrl, "_blank")}
                            title="View Document"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          {(isAdmin || isHR) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(doc.id)}
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            {filteredDocs.length > 0 && (
              <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredDocs.length)} of{" "}
                  {filteredDocs.length} documents
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

        {/* Upload Modal */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleUploadSubmit}>
              <DialogHeader>
                <DialogTitle>Register Employee Document</DialogTitle>
                <DialogDescription>
                  Store official certificate, contract, or ID file in the statutory vault.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Document Title *</label>
                  <Input
                    placeholder="e.g. National Identity Card / Bachelor Degree Certificate"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Category *</label>
                  <Select value={docCategory} onValueChange={(v: any) => setDocCategory(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Employment Contract</SelectItem>
                      <SelectItem value="identification">National ID / Passport</SelectItem>
                      <SelectItem value="qualification">Academic Degree / Certificate</SelectItem>
                      <SelectItem value="medical">Medical Clearance</SelectItem>
                      <SelectItem value="appraisal">Performance Appraisal</SelectItem>
                      <SelectItem value="other">Other Official Record</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">File Storage URL</label>
                  <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Expiry Date (If applicable)</label>
                  <Input type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? "Saving..." : "Store in Vault"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
