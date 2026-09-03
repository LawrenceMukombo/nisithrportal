import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Building2,
  Users,
  Search,
  UserCheck,
  UserX,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Printer,
  ShieldCheck,
  Briefcase,
  Layers,
  Sparkles,
  GripVertical,
  Move,
  Plus,
  Save,
  RefreshCw,
  Network,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Filter,
  Eye,
  LayoutGrid,
  GitFork,
  UserCog,
  Edit3,
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/use-auth";
import { getToken, getAuthHeader } from "@/lib/api-config";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface IncumbentEmployee {
  id: number;
  employeeNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  gradeLevel: string;
  status: string;
  photoUrl: string | null;
  startDate: string | null;
}

interface OrgChartPosition {
  id: number;
  title: string;
  code: string;
  gradeLevel: string;
  filledCount: number;
  totalCount: number;
  vacantCount: number;
  isVacant: boolean;
  incumbents: IncumbentEmployee[];
}

interface OrgChartDepartment {
  id: number;
  name: string;
  code: string;
  headcount: number;
  positionsCount: number;
  lead: { id: number; name: string; email: string } | null;
  members: Array<{
    id: number;
    employeeNumber: string;
    name: string;
    title: string;
    gradeLevel: string;
    email: string | null;
    phone: string | null;
    startDate: string | null;
  }>;
  positions: OrgChartPosition[];
}

interface OrgChartData {
  agency: {
    id: number;
    name: string;
    totalHeadcount: number;
    totalDepartments: number;
    totalPositions: number;
    totalFilledPositions: number;
    totalVacancies: number;
  };
  directorGeneral: {
    title: string;
    name: string;
    email: string;
  };
  executiveOffice: {
    title: string;
    headcount: number;
  };
  departments: OrgChartDepartment[];
  allActiveStaff?: Array<{
    id: number;
    name: string;
    employeeNumber: string;
    gradeLevel: string;
    email: string | null;
    phone: string | null;
    departmentId?: number | null;
    positionId?: number | null;
  }>;
}

export default function OrgChartPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR } = useRole();

  const [activeTab, setActiveTab] = useState("diagram");
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "filled" | "vacant">("all");
  const [selectedDeptId, setSelectedDeptId] = useState<number | "all">("all");
  const [collapsedDepts, setCollapsedDepts] = useState<Record<number, boolean>>({});

  // Hierarchy Builder Local State (for live drag & drop and editing)
  const [customDepts, setCustomDepts] = useState<OrgChartDepartment[]>([]);
  const [draggedItem, setDraggedItem] = useState<{
    type: "position" | "member";
    sourceDeptId: number;
    item: any;
  } | null>(null);
  const [dragOverDeptId, setDragOverDeptId] = useState<number | null>(null);

  // Edit Executive / CEO Modal
  const [isEditCeoOpen, setIsEditCeoOpen] = useState(false);
  const [ceoName, setCeoName] = useState("");
  const [ceoTitle, setCeoTitle] = useState("");
  const [ceoEmail, setCeoEmail] = useState("");
  const [ceoGradeLevel, setCeoGradeLevel] = useState("Grade 20");
  const [ceoEmployeeId, setCeoEmployeeId] = useState<string>("custom");

  // Add Department Modal
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  // Add Position Modal
  const [isAddPosOpen, setIsAddPosOpen] = useState(false);
  const [targetDeptForPos, setTargetDeptForPos] = useState<number | null>(null);
  const [newPosTitle, setNewPosTitle] = useState("");
  const [newPosCount, setNewPosCount] = useState("1");
  const [newPosGrade, setNewPosGrade] = useState("Grade 10");

  const { data, isLoading } = useQuery<OrgChartData>({
    queryKey: ["/api/org-chart"],
    queryFn: async () => {
      const res = await fetch("/api/org-chart");
      if (!res.ok) throw new Error("Failed to load org chart");
      return res.json();
    },
  });

  const { data: employeesList } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });

  // Comprehensive staff list combining /api/employees and org chart dataset fallbacks
  const activeStaffList = useMemo(() => {
    const list: Array<{
      id: number;
      name: string;
      employeeNumber: string;
      gradeLevel: string;
      email: string | null;
      phone: string | null;
    }> = [];
    const seenIds = new Set<number>();

    // 1. From /api/employees
    if (Array.isArray(employeesList)) {
      for (const emp of employeesList) {
        if (emp && emp.id && !seenIds.has(emp.id)) {
          seenIds.add(emp.id);
          list.push({
            id: emp.id,
            name: emp.name,
            employeeNumber: emp.employeeNumber || `EMP-${emp.id}`,
            gradeLevel: emp.gradeLevel || "Grade 10",
            email: emp.email || null,
            phone: emp.phone || null,
          });
        }
      }
    }

    // 2. From allActiveStaff in /api/org-chart
    if (Array.isArray(data?.allActiveStaff)) {
      for (const emp of data.allActiveStaff) {
        if (emp && emp.id && !seenIds.has(emp.id)) {
          seenIds.add(emp.id);
          list.push({
            id: emp.id,
            name: emp.name,
            employeeNumber: emp.employeeNumber || `EMP-${emp.id}`,
            gradeLevel: emp.gradeLevel || "Grade 10",
            email: emp.email || null,
            phone: emp.phone || null,
          });
        }
      }
    }

    // 3. Fallback from department members
    if (Array.isArray(data?.departments)) {
      for (const d of data.departments) {
        if (Array.isArray(d.members)) {
          for (const m of d.members) {
            if (m && m.id && !seenIds.has(m.id)) {
              seenIds.add(m.id);
              list.push({
                id: m.id,
                name: m.name,
                employeeNumber: m.employeeNumber || `EMP-${m.id}`,
                gradeLevel: m.gradeLevel || "Grade 10",
                email: m.email || null,
                phone: m.phone || null,
              });
            }
          }
        }
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [employeesList, data?.allActiveStaff, data?.departments]);

  const ceoStaffOptions = useMemo(
    () => [
      { value: "custom", label: "Custom / External Incumbent", searchTerms: "external custom new position" },
      ...activeStaffList.map((emp) => ({
        value: String(emp.id),
        label: `${emp.name} (${emp.employeeNumber}) — ${emp.gradeLevel}`,
        searchTerms: `${emp.name} ${emp.employeeNumber} ${emp.gradeLevel} ${emp.email || ""}`,
      })),
    ],
    [activeStaffList]
  );

  // Save Structure Mutation
  const saveStructureMutation = useMutation({
    mutationFn: async (depts: OrgChartDepartment[]) => {
      const payload = {
        departments: depts.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          positions: d.positions.map((p) => ({
            id: p.id,
            title: p.title,
            gradeLevel: p.gradeLevel,
            totalCount: p.totalCount,
          })),
          members: d.members.map((m) => ({
            id: m.id,
            name: m.name,
          })),
        })),
      };
      const token = getToken();
      const res = await fetch("/api/org-chart/structure", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save organizational structure");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chart"] });
      toast({
        title: "Hierarchy Structure Saved",
        description: "Organizational reporting lines and divisional assignments have been successfully updated.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to persist hierarchy structure.",
        variant: "destructive",
      });
    },
  });

  // Update CEO Mutation
  const updateCeoMutation = useMutation({
    mutationFn: async (ceoData: { name: string; title: string; email: string; gradeLevel?: string; employeeId?: number | null }) => {
      const token = getToken();
      const res = await fetch("/api/org-chart/executive", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(ceoData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update executive details");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chart"] });
      toast({
        title: "Executive Leadership Updated",
        description: "The Director General & CEO position details have been saved.",
      });
      setIsEditCeoOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update executive leadership.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (data?.departments) {
      setCustomDepts(data.departments);
    }
  }, [data?.departments]);

  const toggleDeptCollapse = (id: number) => {
    setCollapsedDepts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    setCollapsedDepts({});
  };

  const collapseAll = () => {
    if (!data?.departments) return;
    const all: Record<number, boolean> = {};
    data.departments.forEach((d) => {
      all[d.id] = true;
    });
    setCollapsedDepts(all);
  };

  const drillInto = (mode: "all" | "filled" | "vacant") => {
    setActiveTab("diagram");
    setFilterMode(mode);
    setSelectedDeptId("all");
    document.getElementById("org-chart-filter")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Filter departments and positions according to search and status
  const displayedDepts = useMemo(() => {
    if (!data?.departments) return [];
    const q = search.toLowerCase().trim();

    return data.departments
      .filter((dept) => {
        if (selectedDeptId !== "all" && dept.id !== selectedDeptId) return false;
        if (!q) return true;
        const matchDept = dept.name.toLowerCase().includes(q) || (dept.lead?.name ?? "").toLowerCase().includes(q);
        const matchPos = dept.positions.some(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.incumbents.some((i) => i.name.toLowerCase().includes(q) || i.employeeNumber.toLowerCase().includes(q))
        );
        const matchMember = dept.members.some(
          (m) => m.name.toLowerCase().includes(q) || m.employeeNumber.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)
        );
        return matchDept || matchPos || matchMember;
      })
      .map((dept) => {
        // Filter positions based on filterMode
        let filteredPositions = dept.positions;
        if (filterMode === "filled") {
          filteredPositions = dept.positions.filter((p) => p.filledCount > 0);
        } else if (filterMode === "vacant") {
          filteredPositions = dept.positions.filter((p) => p.vacantCount > 0);
        }
        return {
          ...dept,
          positions: filteredPositions,
        };
      });
  }, [data, search, filterMode, selectedDeptId]);

  // Drag and Drop Handlers
  const handleDragStart = (type: "position" | "member", sourceDeptId: number, item: any) => {
    setDraggedItem({ type, sourceDeptId, item });
  };

  const handleDragOver = (e: React.DragEvent, deptId: number) => {
    e.preventDefault();
    if (dragOverDeptId !== deptId) {
      setDragOverDeptId(deptId);
    }
  };

  const handleDragLeave = (deptId: number) => {
    if (dragOverDeptId === deptId) {
      setDragOverDeptId(null);
    }
  };

  const handleDrop = (targetDeptId: number) => {
    setDragOverDeptId(null);
    if (!draggedItem || draggedItem.sourceDeptId === targetDeptId) {
      setDraggedItem(null);
      return;
    }

    setCustomDepts((prev) => {
      return prev.map((dept) => {
        if (dept.id === draggedItem.sourceDeptId) {
          if (draggedItem.type === "position") {
            const updatedPositions = dept.positions.filter((p) => p.id !== draggedItem.item.id);
            return {
              ...dept,
              positions: updatedPositions,
              positionsCount: updatedPositions.length,
            };
          } else {
            const updatedMembers = dept.members.filter((m) => m.id !== draggedItem.item.id);
            return {
              ...dept,
              members: updatedMembers,
              headcount: updatedMembers.length,
            };
          }
        }
        if (dept.id === targetDeptId) {
          if (draggedItem.type === "position") {
            const updatedPositions = [...dept.positions, draggedItem.item];
            return {
              ...dept,
              positions: updatedPositions,
              positionsCount: updatedPositions.length,
            };
          } else {
            const updatedMembers = [...dept.members, draggedItem.item];
            return {
              ...dept,
              members: updatedMembers,
              headcount: updatedMembers.length,
            };
          }
        }
        return dept;
      });
    });

    toast({
      title: "Hierarchy Reassigned",
      description: `Moved "${draggedItem.item.title || draggedItem.item.name}" to target division.`,
    });
    setDraggedItem(null);
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    const newId = Date.now();
    const newDept: OrgChartDepartment = {
      id: newId,
      name: newDeptName.trim(),
      code: `DIV-${newDeptName.trim().slice(0, 3).toUpperCase()}`,
      headcount: 0,
      positionsCount: 0,
      lead: null,
      members: [],
      positions: [],
    };

    setCustomDepts((prev) => [...prev, newDept]);
    toast({
      title: "Division Created",
      description: `Registered new organizational unit "${newDeptName.trim()}".`,
    });
    setNewDeptName("");
    setIsAddDeptOpen(false);
  };

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptForPos || !newPosTitle.trim()) return;

    const totalCount = parseInt(newPosCount, 10) || 1;
    const newPos: OrgChartPosition = {
      id: Date.now(),
      title: newPosTitle.trim(),
      code: `POS-${String(Date.now()).slice(-4)}`,
      gradeLevel: newPosGrade,
      filledCount: 0,
      totalCount,
      vacantCount: totalCount,
      isVacant: true,
      incumbents: [],
    };

    setCustomDepts((prev) =>
      prev.map((d) => {
        if (d.id === targetDeptForPos) {
          const positions = [...d.positions, newPos];
          return {
            ...d,
            positions,
            positionsCount: positions.length,
          };
        }
        return d;
      })
    );

    toast({
      title: "Position Registered",
      description: `Added "${newPosTitle.trim()}" (${newPosGrade}) to establishment ceiling.`,
    });
    setNewPosTitle("");
    setNewPosCount("1");
    setIsAddPosOpen(false);
  };

  const handleSaveStructure = () => {
    saveStructureMutation.mutate(customDepts);
  };

  const handleResetStructure = () => {
    if (data?.departments) {
      setCustomDepts(data.departments);
      toast({
        title: "Layout Reset",
        description: "Restored statutory baseline structure from database.",
      });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Organizational Hierarchy & Diagram</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Live Personnel & Vacancies
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Statutory hierarchy of the National Institute of Standards & Industrial Technology (NISIT) showing filled incumbents and establishment vacancies
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print Chart
            </Button>
          </div>
        </div>

        {/* Top Level Agency KPI Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card role="button" tabIndex={0} onClick={() => setLocation("/employees")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation("/employees"); }} className="border-l-4 border-l-primary bg-card cursor-pointer hover:shadow-md hover:border-primary/70 transition-all" data-testid="card-org-total-headcount">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Headcount</p>
                <p className="text-2xl font-bold mt-0.5">{isLoading ? "..." : data?.agency.totalHeadcount ?? 14}</p>
                <p className="text-xs text-muted-foreground">Active statutory officers</p>
              </div>
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card role="button" tabIndex={0} onClick={() => drillInto("filled")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") drillInto("filled"); }} className="border-l-4 border-l-emerald-500 bg-card cursor-pointer hover:shadow-md hover:border-emerald-400 transition-all" data-testid="card-org-filled-positions">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Filled Positions</p>
                <p className="text-2xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">
                  {isLoading ? "..." : data?.agency.totalFilledPositions ?? 14}
                </p>
                <p className="text-xs text-muted-foreground">Incumbents in service</p>
              </div>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <UserCheck className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card role="button" tabIndex={0} onClick={() => drillInto("vacant")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") drillInto("vacant"); }} className="border-l-4 border-l-amber-500 bg-card cursor-pointer hover:shadow-md hover:border-amber-400 transition-all" data-testid="card-org-vacant-positions">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vacant Positions</p>
                <p className="text-2xl font-bold mt-0.5 text-amber-600 dark:text-amber-400">
                  {isLoading ? "..." : data?.agency.totalVacancies ?? 9}
                </p>
                <p className="text-xs text-muted-foreground">Open establishment slots</p>
              </div>
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                <UserX className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card role="button" tabIndex={0} onClick={() => drillInto("all")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") drillInto("all"); }} className="border-l-4 border-l-indigo-500 bg-card cursor-pointer hover:shadow-md hover:border-indigo-400 transition-all" data-testid="card-org-approved-ceiling">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Approved Ceiling</p>
                <p className="text-2xl font-bold mt-0.5">{isLoading ? "..." : data?.agency.totalPositions ?? 23}</p>
                <p className="text-xs text-muted-foreground">Establishment ceiling</p>
              </div>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
                <Briefcase className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs: Visual Tree Diagram vs Grid Roster vs Drag & Drop Builder */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-3">
            <TabsList className="grid w-full sm:w-auto grid-cols-3">
              <TabsTrigger value="diagram" className="flex items-center gap-2">
                <GitFork className="h-4 w-4" /> Org Chart Diagram
              </TabsTrigger>
              <TabsTrigger value="roster" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> Department Rosters
              </TabsTrigger>
              <TabsTrigger value="builder" className="flex items-center gap-2">
                <Move className="h-4 w-4" /> Structure Builder (Drag & Drop)
              </TabsTrigger>
            </TabsList>

            {activeTab === "builder" && (isAdmin || isHR) && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleResetStructure} className="text-xs">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsAddDeptOpen(true)} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Division
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveStructure}
                  disabled={saveStructureMutation.isPending}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                >
                  <Save className={`h-3.5 w-3.5 mr-1.5 ${saveStructureMutation.isPending ? "animate-spin" : ""}`} />
                  {saveStructureMutation.isPending ? "Saving Changes..." : "Save Structure"}
                </Button>
              </div>
            )}
          </div>

          {/* TAB 1: VISUAL HIERARCHY TREE DIAGRAM */}
          <TabsContent value="diagram" className="space-y-6 mt-0">
            {/* Filter & Search Bar */}
            <Card id="org-chart-filter" className="p-4 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search officer, position code, or division..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-card"
                    />
                  </div>

                  <Select
                    value={String(selectedDeptId)}
                    onValueChange={(v) => setSelectedDeptId(v === "all" ? "all" : parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-56 text-xs">
                      <SelectValue placeholder="All Divisions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Divisions & Branches</SelectItem>
                      {(data?.departments ?? []).map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> View:
                  </span>
                  <Button
                    size="sm"
                    variant={filterMode === "all" ? "default" : "outline"}
                    onClick={() => setFilterMode("all")}
                    className="text-xs h-8"
                  >
                    All Positions
                  </Button>
                  <Button
                    size="sm"
                    variant={filterMode === "filled" ? "default" : "outline"}
                    onClick={() => setFilterMode("filled")}
                    className="text-xs h-8 text-emerald-700 dark:text-emerald-400"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1" /> Filled Only
                  </Button>
                  <Button
                    size="sm"
                    variant={filterMode === "vacant" ? "default" : "outline"}
                    onClick={() => setFilterMode("vacant")}
                    className="text-xs h-8 text-amber-700 dark:text-amber-400"
                  >
                    <UserX className="w-3.5 h-3.5 mr-1" /> Vacancies Only
                  </Button>
                </div>
              </div>
            </Card>

            {/* Tree Diagram Canvas */}
            <div className="overflow-x-auto pb-8 pt-2">
              <div className="min-w-[900px] flex flex-col items-center">
                {/* Level 0: Statutory Council */}
                <div className="flex flex-col items-center">
                  <div className="p-3.5 px-6 rounded-2xl bg-indigo-50 border-2 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4" /> Statutory Apex Body
                    </div>
                    <h3 className="font-bold text-sm text-foreground mt-0.5">NISIT National Council</h3>
                    <p className="text-[11px] text-muted-foreground">Appointed under the NISIT Act (PNG Statutory Framework)</p>
                  </div>
                  {/* Stem Line down */}
                  <div className="w-0.5 h-8 bg-border" />
                </div>

                {/* Level 1: Director General & Executive Office */}
                <div className="flex flex-col items-center">
                  <Card className="w-[450px] bg-gradient-to-r from-primary/10 via-card to-card border-2 border-primary/40 shadow-md relative group">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                          {data?.directorGeneral.name
                            ? data.directorGeneral.name.split(" ").filter(p => !p.includes(".")).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "DG"
                            : "DG"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase font-semibold">
                              Executive Chief
                            </Badge>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {(data?.directorGeneral as any)?.gradeLevel || "Grade 20"}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-foreground mt-0.5">{data?.directorGeneral.name ?? "Dr. Jerry Tetaga"}</h4>
                          <p className="text-xs text-muted-foreground">{data?.directorGeneral.title ?? "Director General & Chief Executive Officer"}</p>
                          <p className="text-[11px] text-primary font-mono">{data?.directorGeneral.email ?? "dg@nisit.gov.pg"}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {(isAdmin || isHR) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-background/90 hover:bg-background border-primary/40 text-primary shadow-2xs"
                            onClick={() => {
                              setCeoName(data?.directorGeneral.name || "Dr. Jerry Tetaga");
                              setCeoTitle(data?.directorGeneral.title || "Director General & Chief Executive Officer");
                              setCeoEmail(data?.directorGeneral.email || "dg@nisit.gov.pg");
                              setCeoGradeLevel((data?.directorGeneral as any)?.gradeLevel || "Grade 20");
                              setCeoEmployeeId((data?.directorGeneral as any)?.employeeId ? String((data?.directorGeneral as any).employeeId) : "custom");
                              setIsEditCeoOpen(true);
                            }}
                          >
                            <UserCog className="w-3.5 h-3.5 mr-1 text-primary" /> Change CEO
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stem Line down to horizontal distributor */}
                  <div className="w-0.5 h-8 bg-border" />
                </div>

                {/* Level 2: Divisions & Departments Tree Grid */}
                <div className="w-full relative">
                  {/* Horizontal Connector Bar */}
                  <div className="hidden lg:block absolute top-0 left-12 right-12 h-0.5 bg-border" />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                    {displayedDepts.map((dept) => {
                      const isCollapsed = collapsedDepts[dept.id] ?? false;
                      const deptFilled = dept.positions.reduce((acc, p) => acc + p.filledCount, 0);
                      const deptTotal = dept.positions.reduce((acc, p) => acc + p.totalCount, 0);
                      const deptVacant = Math.max(0, deptTotal - deptFilled);

                      return (
                        <div key={dept.id} className="flex flex-col relative">
                          {/* Top connector pin */}
                          <div className="hidden lg:block w-0.5 h-6 bg-border mx-auto -mt-6" />

                          <Card className="border-2 border-border hover:border-primary/50 transition-all shadow-sm flex flex-col h-full bg-card" data-testid={`card-org-department-${dept.id}`}>
                            {/* Department Node Header */}
                            <CardHeader role="button" tabIndex={0} onClick={() => { setSelectedDeptId(dept.id); setActiveTab("roster"); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDeptId(dept.id); setActiveTab("roster"); } }} className="p-4 bg-muted/30 border-b border-border/60 pb-3 cursor-pointer">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-sm font-bold text-foreground leading-snug">
                                      {dept.name}
                                    </CardTitle>
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{dept.code}</span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground"
                                  onClick={(event) => { event.stopPropagation(); toggleDeptCollapse(dept.id); }}
                                >
                                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </div>

                              {/* Department Capacity Stats */}
                              <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border/40 text-[11px]">
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <UserCheck className="w-3.5 h-3.5" /> {deptFilled} Filled
                                </span>
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                  <UserX className="w-3.5 h-3.5" /> {deptVacant} Vacant
                                </span>
                                <span className="text-muted-foreground">Cap: {deptTotal}</span>
                              </div>
                            </CardHeader>

                            {/* Position Nodes & Incumbents */}
                            {!isCollapsed && (
                              <CardContent className="p-3.5 space-y-3 flex-1">
                                {dept.positions.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-lg">
                                    No positions matching current filter.
                                  </div>
                                ) : (
                                  dept.positions.map((pos) => (
                                    <div
                                      key={pos.id}
                                      className={`p-3 rounded-xl border transition-all ${
                                        pos.isVacant && pos.filledCount === 0
                                          ? "bg-amber-50/40 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800"
                                          : "bg-card border-border/80 hover:border-primary/40 shadow-2xs"
                                      }`}
                                    >
                                      {/* Position Title & Capacity */}
                                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/40">
                                        <div>
                                          <p className="font-bold text-xs text-foreground leading-tight">{pos.title}</p>
                                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
                                            <span>{pos.code}</span>
                                            <span>•</span>
                                            <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal">
                                              {pos.gradeLevel}
                                            </Badge>
                                          </div>
                                        </div>

                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] shrink-0 ${
                                            pos.vacantCount > 0
                                              ? "border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 font-semibold"
                                              : "border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                                          }`}
                                        >
                                          {pos.filledCount}/{pos.totalCount} {pos.vacantCount > 0 ? "Vacancies" : "Filled"}
                                        </Badge>
                                      </div>

                                      {/* List Assigned Officers / Incumbents */}
                                      <div className="pt-2 space-y-2">
                                        {pos.incumbents.map((incumbent) => (
                                          <Link key={incumbent.id} href={`/employees/${incumbent.id}`}>
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-primary/5 hover:border-primary/30 border border-transparent transition-colors cursor-pointer group">
                                              <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                                                  {incumbent.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                  <p className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                                                    {incumbent.name}
                                                  </p>
                                                  <p className="text-[10px] font-mono text-muted-foreground">
                                                    {incumbent.employeeNumber}
                                                  </p>
                                                </div>
                                              </div>
                                              <Badge variant="outline" className="text-[9px] py-0 px-1 text-emerald-600 border-emerald-300">
                                                Active
                                              </Badge>
                                            </div>
                                          </Link>
                                        ))}

                                        {/* Vacancy Card Slot */}
                                        {pos.vacantCount > 0 && (
                                          <div className="p-2.5 rounded-lg border border-dashed border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 text-xs flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                              <div>
                                                <p className="font-bold text-[11px] text-amber-800 dark:text-amber-300">
                                                  VACANT ({pos.vacantCount} Open Slot{pos.vacantCount > 1 ? "s" : ""})
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">Establishment ceiling approved</p>
                                              </div>
                                            </div>

                                            {(isAdmin || isHR) && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] px-2 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 shrink-0"
                                                onClick={() => {
                                                  const qs = new URLSearchParams();
                                                  qs.set("departmentId", String(dept.id));
                                                  qs.set("positionId", String(pos.id));
                                                  setLocation(`/employees/new?${qs.toString()}`);
                                                }}
                                              >
                                                <UserPlus className="w-3 h-3 mr-1" /> Assign Officer
                                              </Button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </CardContent>
                            )}
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: DEPARTMENT ROSTER GRID */}
          <TabsContent value="roster" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {displayedDepts.map((dept) => (
                <Card key={dept.id} className="shadow-sm border-border/80">
                  <CardHeader className="p-4 bg-muted/30 border-b border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-bold">{dept.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {dept.headcount} Officers
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    {dept.members.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-2">No personnel currently assigned to this division.</p>
                    ) : (
                      dept.members.map((member) => (
                        <Link key={member.id} href={`/employees/${member.id}`}>
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/60 hover:bg-muted/40 transition-colors cursor-pointer text-xs">
                            <div>
                              <p className="font-semibold text-foreground">{member.name}</p>
                              <p className="text-muted-foreground">{member.title} ({member.gradeLevel})</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-muted-foreground">{member.employeeNumber}</p>
                              {member.email && <p className="text-[11px] text-muted-foreground">{member.email}</p>}
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: DRAG & DROP STRUCTURE BUILDER */}
          <TabsContent value="builder" className="space-y-6 mt-0">
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-primary/5 to-card border border-blue-500/20 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Move className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Interactive Structure & Drag-and-Drop Reassignment</p>
                  <p className="text-muted-foreground mt-0.5">
                    Drag position chips or staff records between division containers to instantly reassign reporting units. Click <strong>"Save Structure"</strong> to persist changes to the database.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                {(isAdmin || isHR) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-primary/30 text-primary"
                    onClick={() => {
                      setCeoName(data?.directorGeneral.name || "Dr. Jerry Tetaga");
                      setCeoTitle(data?.directorGeneral.title || "Director General & Chief Executive Officer");
                      setCeoEmail(data?.directorGeneral.email || "dg@nisit.gov.pg");
                      setCeoGradeLevel((data?.directorGeneral as any)?.gradeLevel || "Grade 20");
                      setCeoEmployeeId((data?.directorGeneral as any)?.employeeId ? String((data?.directorGeneral as any).employeeId) : "custom");
                      setIsEditCeoOpen(true);
                    }}
                  >
                    <UserCog className="w-3.5 h-3.5 mr-1" /> Change CEO
                  </Button>
                )}
                <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                  Live Interactive Mode
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {customDepts.map((dept) => {
                const isOver = dragOverDeptId === dept.id;
                return (
                  <Card
                    key={dept.id}
                    onDragOver={(e) => handleDragOver(e, dept.id)}
                    onDragLeave={() => handleDragLeave(dept.id)}
                    onDrop={() => handleDrop(dept.id)}
                    className={`transition-all duration-200 border-2 ${
                      isOver
                        ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20 scale-[1.01]"
                        : "border-border/80 bg-card hover:border-border"
                    }`}
                  >
                    <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {dept.name}
                        </CardTitle>
                        <CardDescription className="text-[11px] mt-0.5">
                          {dept.positions.length} positions • {dept.members.length} personnel
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setTargetDeptForPos(dept.id);
                          setIsAddPosOpen(true);
                        }}
                        title="Add position to this division"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CardHeader>

                    <CardContent className="p-4 space-y-4">
                      {/* Drag Area - Positions */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-2">
                          <span className="uppercase tracking-wider">Approved Positions</span>
                          <span className="text-[10px] text-primary">Drag to move</span>
                        </div>

                        {dept.positions.length === 0 ? (
                          <div className="p-3 rounded-lg border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                            Drop positions here
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {dept.positions.map((pos) => (
                              <div
                                key={pos.id}
                                draggable
                                onDragStart={() => handleDragStart("position", dept.id, pos)}
                                className="group flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted border border-border/60 hover:border-primary/40 cursor-grab active:cursor-grabbing transition-all text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                  <span className="font-medium text-foreground">{pos.title}</span>
                                </div>
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  Cap: {pos.totalCount}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Drag Area - Staff Members */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-2">
                          <span className="uppercase tracking-wider">Assigned Officers</span>
                          <span className="text-[10px] text-primary">Drag to reassign</span>
                        </div>

                        {dept.members.length === 0 ? (
                          <div className="p-2.5 rounded-lg border border-dashed border-border/60 text-center text-[11px] text-muted-foreground">
                            No officers assigned
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {dept.members.map((member) => (
                              <div
                                key={member.id}
                                draggable
                                onDragStart={() => handleDragStart("member", dept.id, member)}
                                className="group flex items-center justify-between p-2 rounded-lg bg-card hover:bg-muted/30 border border-border/70 hover:border-primary/40 cursor-grab active:cursor-grabbing transition-all text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                  <div>
                                    <p className="font-semibold text-foreground">{member.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{member.title}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground">{member.employeeNumber}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal: Add Department / Division */}
        <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleAddDepartment}>
              <DialogHeader>
                <DialogTitle>Add Organizational Division</DialogTitle>
                <DialogDescription>
                  Register a new statutory department or branch in the NISIT hierarchy.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Division / Unit Name *</label>
                  <Input
                    placeholder="e.g. Conformity Assessment & Testing Division"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDeptOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Division</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Add Position to Department */}
        <Dialog open={isAddPosOpen} onOpenChange={setIsAddPosOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleAddPosition}>
              <DialogHeader>
                <DialogTitle>Add Position to Establishment</DialogTitle>
                <DialogDescription>
                  Create an approved position ceiling for the selected division.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Position Title *</label>
                  <Input
                    placeholder="e.g. Senior Calibration Metrologist"
                    value={newPosTitle}
                    onChange={(e) => setNewPosTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Grade Level</label>
                    <Select value={newPosGrade} onValueChange={setNewPosGrade}>
                      <SelectTrigger>
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grade 10">Grade 10 (Entry Officer)</SelectItem>
                        <SelectItem value="Grade 12">Grade 12 (Specialist Officer)</SelectItem>
                        <SelectItem value="Grade 14">Grade 14 (Senior Specialist)</SelectItem>
                        <SelectItem value="Grade 16">Grade 16 (Principal / Manager)</SelectItem>
                        <SelectItem value="Grade 18">Grade 18 (Divisional Director)</SelectItem>
                        <SelectItem value="Grade 20">Grade 20 (Director General)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1">Approved Headcount</label>
                    <Input
                      type="number"
                      min="1"
                      value={newPosCount}
                      onChange={(e) => setNewPosCount(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddPosOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Position</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Modal: Edit CEO / Executive Chief */}
        <Dialog open={isEditCeoOpen} onOpenChange={setIsEditCeoOpen}>
          <DialogContent className="sm:max-w-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateCeoMutation.mutate({
                  name: ceoName,
                  title: ceoTitle,
                  email: ceoEmail,
                  gradeLevel: ceoGradeLevel,
                  employeeId: ceoEmployeeId !== "custom" ? Number(ceoEmployeeId) : null,
                });
              }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-primary" />
                  Change CEO / Executive Chief Position
                </DialogTitle>
                <DialogDescription>
                  Update the statutory apex executive officer (Director General & CEO) of NISIT.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Select from Active NISIT Staff (Optional)</label>
                  <SearchableSelect
                    value={ceoEmployeeId}
                    onValueChange={(val) => {
                      setCeoEmployeeId(val);
                      if (val !== "custom") {
                        const selectedEmp = activeStaffList.find((e) => String(e.id) === val);
                        if (selectedEmp) {
                          setCeoName(selectedEmp.name);
                          if (selectedEmp.email) setCeoEmail(selectedEmp.email);
                          if (selectedEmp.gradeLevel) setCeoGradeLevel(selectedEmp.gradeLevel);
                        }
                      }
                    }}
                    options={ceoStaffOptions}
                    placeholder="Search active employee or choose custom..."
                    searchPlaceholder="Search by name, employee #, or grade..."
                    triggerClassName="h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Selecting an employee pre-fills their name and contact information.
                  </p>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Full Name & Title *</label>
                  <Input
                    placeholder="e.g. Dr. Jerry Tetaga"
                    value={ceoName}
                    onChange={(e) => setCeoName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Executive Position Title *</label>
                  <Input
                    placeholder="e.g. Director General & Chief Executive Officer"
                    value={ceoTitle}
                    onChange={(e) => setCeoTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Official Email</label>
                    <Input
                      type="email"
                      placeholder="dg@nisit.gov.pg"
                      value={ceoEmail}
                      onChange={(e) => setCeoEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1">Grade Level</label>
                    <Select value={ceoGradeLevel} onValueChange={setCeoGradeLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grade 20">Grade 20 (Director General / CEO)</SelectItem>
                        <SelectItem value="Grade 18">Grade 18 (Executive Director)</SelectItem>
                        <SelectItem value="Grade 16">Grade 16 (Principal Manager)</SelectItem>
                        <SelectItem value="Grade 14">Grade 14 (Senior Specialist)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditCeoOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCeoMutation.isPending} className="bg-primary">
                  {updateCeoMutation.isPending ? "Updating..." : "Save Executive Details"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
