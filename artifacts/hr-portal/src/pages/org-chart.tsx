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
  ListOrdered,
  RotateCcw,
  Trash2,
  SlidersHorizontal,
  Download,
  CornerDownRight,
  GitCommit,
  Split,
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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

export interface IncumbentEmployee {
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

export interface OrgChartPosition {
  id: number;
  title: string;
  code: string;
  positionCode?: string;
  departmentId?: number;
  gradeLevel: string;
  parentPositionId?: number | null;
  parentPositionCode?: string | null;
  parentPositionTitle?: string | null;
  reportsToTitle?: string | null;
  jobDescription?: string | null;
  filledCount: number;
  totalCount: number;
  vacantCount: number;
  isVacant: boolean;
  incumbents: IncumbentEmployee[];
}

export interface OrgChartDepartment {
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

export interface OrgChartData {
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

export function getHierarchyTier(grade: string, title: string) {
  const g = grade ? grade.trim() : "";
  const t = title ? title.toLowerCase() : "";
  if (g === "Grade 20" || t.includes("director general")) {
    return {
      level: 1,
      label: "Apex / Chief Executive",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300",
    };
  }
  if (g === "Grade 18" || t.startsWith("executive manager") || t.includes("director -")) {
    return {
      level: 2,
      label: "Division Head / Director",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
    };
  }
  if (g === "Grade 16" || t.startsWith("manager")) {
    return {
      level: 3,
      label: "Branch Manager",
      badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300",
    };
  }
  if (
    g === "Grade 14" ||
    g === "Grade 15" ||
    t.startsWith("senior") ||
    t.includes("executive officer") ||
    t.includes("legal officer") ||
    t.includes("internal auditor")
  ) {
    return {
      level: 4,
      label: "Senior Specialist / Auditor",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  if (g === "Grade 12" || g === "Grade 13") {
    return {
      level: 5,
      label: "Technical Officer",
      badgeClass: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300",
    };
  }
  return {
    level: 6,
    label: "Support & Operations",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300",
  };
}

export interface FlatPositionRow {
  id: number;
  title: string;
  code: string;
  positionCode: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  gradeLevel: string;
  parentPositionId: number | null;
  parentPositionCode: string | null;
  parentPositionTitle: string | null;
  reportsToTitle: string;
  tierLevel: number;
  tierLabel: string;
  tierBadgeClass: string;
  totalCount: number;
  filledCount: number;
  vacantCount: number;
  occupancyRate: number;
  status: "filled" | "partially_filled" | "vacant";
  incumbents: IncumbentEmployee[];
  jobDescription?: string | null;
}

export interface PositionTreeNode {
  position: OrgChartPosition;
  children: PositionTreeNode[];
  depth: number;
}

export function buildDivisionHierarchyTree(positions: OrgChartPosition[]): {
  roots: PositionTreeNode[];
} {
  const nodeMap = new Map<number, PositionTreeNode>();
  positions.forEach((pos) => {
    nodeMap.set(pos.id, { position: pos, children: [], depth: 0 });
  });

  const roots: PositionTreeNode[] = [];
  const localIds = new Set(positions.map((p) => p.id));

  positions.forEach((pos) => {
    const node = nodeMap.get(pos.id)!;
    const parentId = pos.parentPositionId;

    if (!parentId || !localIds.has(parentId)) {
      roots.push(node);
    } else {
      const parentNode = nodeMap.get(parentId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  function setDepths(nodes: PositionTreeNode[], currentDepth: number, visited = new Set<number>()) {
    nodes.forEach((n) => {
      if (visited.has(n.position.id)) return;
      visited.add(n.position.id);
      n.depth = currentDepth;
      n.children.sort((a, b) => {
        const tierA = getHierarchyTier(a.position.gradeLevel, a.position.title).level;
        const tierB = getHierarchyTier(b.position.gradeLevel, b.position.title).level;
        if (tierA !== tierB) return tierA - tierB;
        return a.position.title.localeCompare(b.position.title);
      });
      setDepths(n.children, currentDepth + 1, visited);
    });
  }

  roots.sort((a, b) => {
    const tierA = getHierarchyTier(a.position.gradeLevel, a.position.title).level;
    const tierB = getHierarchyTier(b.position.gradeLevel, b.position.title).level;
    if (tierA !== tierB) return tierA - tierB;
    return a.position.title.localeCompare(b.position.title);
  });

  setDepths(roots, 0);

  return { roots };
}

interface PositionTreeBranchProps {
  node: PositionTreeNode;
  deptId: number;
  deptCode: string;
  isAdmin: boolean;
  isHR: boolean;
  onEditPosition: (pos: OrgChartPosition, deptId: number) => void;
  onAddSubordinate: (parentPosId: number) => void;
}

function PositionTreeBranch({
  node,
  deptId,
  deptCode,
  isAdmin,
  isHR,
  onEditPosition,
  onAddSubordinate,
}: PositionTreeBranchProps) {
  const { position, children, depth } = node;
  const tier = getHierarchyTier(position.gradeLevel, position.title);
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = children.length > 0;
  const isDirectSupport =
    position.title.toLowerCase().includes("executive assistant") ||
    position.title.toLowerCase().includes("driver") ||
    position.title.toLowerCase().includes("janitor");

  return (
    <div className="relative group/branch">
      {/* Position Node Card */}
      <div
        className={`p-3 rounded-xl border transition-all ${
          tier.level === 1
            ? "bg-purple-50/60 border-purple-300 dark:bg-purple-950/20 dark:border-purple-800 shadow-xs"
            : tier.level === 2
            ? "bg-blue-50/60 border-blue-300 dark:bg-blue-950/20 dark:border-blue-800 shadow-xs"
            : tier.level === 3
            ? "bg-indigo-50/40 border-indigo-300/80 dark:bg-indigo-950/20 dark:border-indigo-800 shadow-2xs"
            : position.isVacant && position.filledCount === 0
            ? "bg-amber-50/40 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800"
            : "bg-card border-border/80 hover:border-primary/40 shadow-2xs"
        }`}
      >
        {/* Hierarchy Level & Reports To Link */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2 border-b border-border/40">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[9px] font-semibold py-0 px-1.5 border ${tier.badgeClass}`}>
              Tier {tier.level}: {tier.label}
            </Badge>

            {isDirectSupport && (
              <Badge variant="secondary" className="text-[9px] py-0 px-1 bg-muted/80 text-muted-foreground font-medium">
                Direct Support
              </Badge>
            )}

            {position.reportsToTitle && depth > 0 && (
              <div
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md font-medium border border-border/50"
                title={`Reports to: ${position.reportsToTitle}`}
              >
                <CornerDownRight className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate max-w-48">
                  {position.parentPositionCode ? `[${position.parentPositionCode}] ` : ""}
                  {position.reportsToTitle}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className={`text-[10px] ${
                position.vacantCount > 0
                  ? "border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 font-semibold"
                  : "border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
              }`}
            >
              {position.filledCount}/{position.totalCount} {position.vacantCount > 0 ? "Vacant" : "Filled"}
            </Badge>

            {(isAdmin || isHR) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPosition(position, deptId);
                }}
                title="Configure position reporting line & ceiling"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Position Title & Code */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-xs text-foreground leading-tight">{position.title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
              <span className="font-semibold text-primary">{position.code}</span>
              <span>•</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1 font-semibold">
                {position.gradeLevel}
              </Badge>
            </div>
          </div>

          {/* Subordinate count badge & branch toggle */}
          {hasChildren && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-1.5 text-[10px] font-mono gap-1 shrink-0 bg-background/90"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse reporting line" : "Expand reporting line"}
            >
              <Split className="w-3 h-3 text-primary rotate-180" />
              <span>{children.length} {children.length === 1 ? "report" : "reports"}</span>
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          )}
        </div>

        {/* Assigned Incumbents List */}
        <div className="pt-2 space-y-1.5">
          {position.incumbents.map((incumbent) => (
            <Link key={incumbent.id} href={`/employees/${incumbent.id}`}>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-muted/40 hover:bg-primary/5 hover:border-primary/30 border border-transparent transition-colors cursor-pointer group">
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

          {/* Vacant Card Slot */}
          {position.vacantCount > 0 && (
            <div className="p-2 rounded-lg border border-dashed border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold text-[10px] text-amber-800 dark:text-amber-300">
                    VACANT ({position.vacantCount} Slot{position.vacantCount > 1 ? "s" : ""})
                  </p>
                  <p className="text-[9px] text-muted-foreground">Approved 2024 establishment quota</p>
                </div>
              </div>

              {(isAdmin || isHR) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/jobs/new?positionId=${position.id}&departmentId=${deptId}&title=${encodeURIComponent(
                      position.title
                    )}&gradeLevel=${encodeURIComponent(position.gradeLevel)}&reportsTo=${encodeURIComponent(
                      position.reportsToTitle || ""
                    )}`}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 shrink-0 font-medium"
                      title="Post a job vacancy requisition to recruit for this position"
                    >
                      <Briefcase className="w-3 h-3 mr-1" />
                      Recruit
                    </Button>
                  </Link>

                  <Link href={`/employees/new?departmentId=${deptId}&positionId=${position.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-emerald-500 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 shrink-0 font-medium"
                      title="Directly appoint or onboard an officer to this vacant establishment position"
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Assign
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Add Subordinate under this position */}
        {(isAdmin || isHR) && (
          <div className="mt-2 pt-1.5 border-t border-border/30 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-primary hover:bg-primary/5"
              onClick={() => onAddSubordinate(position.id)}
              title={`Add new subordinate position reporting directly to ${position.title}`}
            >
              <Plus className="w-2.5 h-2.5 mr-0.5" />
              Add Subordinate
            </Button>
          </div>
        )}
      </div>

      {/* Children Tree Branch with Visual Connector Line */}
      {hasChildren && isExpanded && (
        <div className="ml-3 sm:ml-5 pl-2.5 sm:pl-3 border-l-2 border-primary/30 space-y-2.5 mt-2.5 relative">
          {children.map((childNode) => (
            <div key={childNode.position.id} className="relative">
              {/* Horizontal line stub connecting to branch */}
              <div className="absolute -left-2.75 sm:-left-3.25 top-4 w-2.5 sm:w-3 h-0.5 bg-primary/30" />
              <PositionTreeBranch
                node={childNode}
                deptId={deptId}
                deptCode={deptCode}
                isAdmin={isAdmin}
                isHR={isHR}
                onEditPosition={onEditPosition}
                onAddSubordinate={onAddSubordinate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [newDeptCode, setNewDeptCode] = useState("");

  // Add Position Modal
  const [isAddPosOpen, setIsAddPosOpen] = useState(false);
  const [targetDeptForPos, setTargetDeptForPos] = useState<number | null>(null);
  const [newPosTitle, setNewPosTitle] = useState("");
  const [newPosCode, setNewPosCode] = useState("");
  const [newPosCount, setNewPosCount] = useState("1");
  const [newPosGrade, setNewPosGrade] = useState("Grade 12");
  const [newPosReportsTo, setNewPosReportsTo] = useState("");
  const [newPosParentPositionId, setNewPosParentPositionId] = useState<string>("none");

  // Edit Position Modal
  const [isEditPosOpen, setIsEditPosOpen] = useState(false);
  const [editingPosId, setEditingPosId] = useState<number | null>(null);
  const [editPosTitle, setEditPosTitle] = useState("");
  const [editPosCode, setEditPosCode] = useState("");
  const [editPosDeptId, setEditPosDeptId] = useState<string>("1");
  const [editPosGrade, setEditPosGrade] = useState("Grade 12");
  const [editPosCount, setEditPosCount] = useState("1");
  const [editPosReportsTo, setEditPosReportsTo] = useState("");
  const [editPosParentPositionId, setEditPosParentPositionId] = useState<string>("none");
  const [editPosIncumbentCount, setEditPosIncumbentCount] = useState(0);

  // Positions Register Table State (Rule 24 Enterprise-Grade Table)
  const [posTableSearch, setPosTableSearch] = useState("");
  const [posDeptFilter, setPosDeptFilter] = useState<string>("all");
  const [posGradeFilter, setPosGradeFilter] = useState<string>("all");
  const [posStatusFilter, setPosStatusFilter] = useState<string>("all");

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

  const handleOpenEditPosition = (pos: OrgChartPosition, deptId: number) => {
    setEditingPosId(pos.id);
    setEditPosTitle(pos.title);
    setEditPosCode(pos.code || (pos as any).positionCode || "");
    setEditPosDeptId(String(deptId));
    setEditPosGrade(pos.gradeLevel || "Grade 12");
    setEditPosCount(String(pos.totalCount || 1));
    setEditPosParentPositionId(pos.parentPositionId ? String(pos.parentPositionId) : "none");
    setEditPosReportsTo((pos as any).reportsToTitle || "");
    setEditPosIncumbentCount(pos.filledCount || 0);
    setIsEditPosOpen(true);
  };

  const handleOpenAddPosition = (deptId: number, defaultParentPosId?: number) => {
    setTargetDeptForPos(deptId);
    setNewPosTitle("");
    setNewPosCode("");
    setNewPosGrade("Grade 12");
    setNewPosCount("1");
    if (defaultParentPosId) {
      setNewPosParentPositionId(String(defaultParentPosId));
      const parent = allPositionsFlat.find((p) => p.id === defaultParentPosId);
      setNewPosReportsTo(parent?.title || "");
    } else {
      const deptHead = allPositionsFlat.find(
        (p) => p.departmentId === deptId && (p.tierLevel === 2 || p.tierLevel === 1)
      );
      if (deptHead) {
        setNewPosParentPositionId(String(deptHead.id));
        setNewPosReportsTo(deptHead.title);
      } else {
        setNewPosParentPositionId("none");
        setNewPosReportsTo("NISIT Council");
      }
    }
    setIsAddPosOpen(true);
  };

  const updatePositionMutation = useMutation({
    mutationFn: async (payload: { id: number; data: any }) => {
      const res = await fetch(`/api/org-chart/positions/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update position");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      toast({
        title: "Position Updated",
        description: "Establishment position specifications and ceiling updated successfully.",
      });
      setIsEditPosOpen(false);
      setEditingPosId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deletePositionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/org-chart/positions/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete position");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      toast({
        title: "Position Removed",
        description: "Vacant establishment position has been deleted.",
      });
      setIsEditPosOpen(false);
      setEditingPosId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Deletion Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const createPositionMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      positionCode?: string;
      departmentId: number;
      gradeLevel: string;
      totalCount: number;
      reportsToTitle?: string;
      parentPositionId?: number | null;
    }) => {
      const res = await fetch("/api/org-chart/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create position");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      toast({
        title: "Position Registered",
        description: `Added "${newPosTitle.trim()}" (${newPosGrade}) to establishment ceiling.`,
      });
      setNewPosTitle("");
      setNewPosCount("1");
      setNewPosCode("");
      setNewPosReportsTo("");
      setNewPosParentPositionId("none");
      setIsAddPosOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Creation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (payload: { name: string; code?: string }) => {
      const res = await fetch("/api/org-chart/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create division");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org-chart"] });
      toast({
        title: "Division Created",
        description: "New organizational unit established successfully.",
      });
      setIsAddDeptOpen(false);
      setNewDeptName("");
      setNewDeptCode("");
    },
    onError: (err: any) => {
      toast({
        title: "Creation Failed",
        description: err.message,
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

  // Flatten all positions across departments into an enterprise tabular dataset
  const allPositionsFlat = useMemo<FlatPositionRow[]>(() => {
    if (!data?.departments) return [];
    const rows: FlatPositionRow[] = [];
    for (const dept of data.departments) {
      for (const pos of dept.positions) {
        const totalCount = pos.totalCount || 1;
        const filledCount = pos.filledCount || 0;
        const vacantCount = Math.max(0, totalCount - filledCount);
        const occupancyRate = Math.round((filledCount / totalCount) * 100);
        const status: "filled" | "partially_filled" | "vacant" =
          filledCount === 0
            ? "vacant"
            : filledCount >= totalCount
            ? "filled"
            : "partially_filled";

        const tier = getHierarchyTier(pos.gradeLevel, pos.title);
        rows.push({
          id: pos.id,
          title: pos.title,
          code: pos.positionCode || pos.code || `POS-${pos.id}`,
          positionCode: pos.positionCode || pos.code || `POS-${pos.id}`,
          departmentId: dept.id,
          departmentName: dept.name,
          departmentCode: dept.code,
          gradeLevel: pos.gradeLevel || "Grade 12",
          parentPositionId: pos.parentPositionId ?? null,
          parentPositionCode: pos.parentPositionCode ?? null,
          parentPositionTitle: pos.parentPositionTitle ?? null,
          reportsToTitle: pos.reportsToTitle || "Director General, NISIT",
          tierLevel: tier.level,
          tierLabel: tier.label,
          tierBadgeClass: tier.badgeClass,
          totalCount,
          filledCount,
          vacantCount,
          occupancyRate,
          status,
          incumbents: pos.incumbents || [],
          jobDescription: pos.jobDescription,
        });
      }
    }
    return rows;
  }, [data?.departments]);

  // Aggregate KPI stats for Positions Register
  const positionStats = useMemo(() => {
    const totalPositions = allPositionsFlat.length;
    const totalCeiling = allPositionsFlat.reduce((acc, p) => acc + p.totalCount, 0);
    const totalFilled = allPositionsFlat.reduce((acc, p) => acc + p.filledCount, 0);
    const totalVacant = allPositionsFlat.reduce((acc, p) => acc + p.vacantCount, 0);
    const fillRate = totalCeiling > 0 ? Math.round((totalFilled / totalCeiling) * 100) : 0;
    return { totalPositions, totalCeiling, totalFilled, totalVacant, fillRate };
  }, [allPositionsFlat]);

  // Filter positions table rows by search, division, grade, and occupancy status
  const filteredPositions = useMemo(() => {
    return allPositionsFlat.filter((row) => {
      if (posDeptFilter !== "all" && String(row.departmentId) !== posDeptFilter) {
        return false;
      }
      if (posGradeFilter !== "all" && row.gradeLevel !== posGradeFilter) {
        return false;
      }
      if (posStatusFilter !== "all") {
        if (posStatusFilter === "filled" && row.status !== "filled") return false;
        if (posStatusFilter === "partially_filled" && row.status !== "partially_filled") return false;
        if (posStatusFilter === "vacant" && row.status !== "vacant") return false;
        if (posStatusFilter === "has_vacancies" && row.vacantCount === 0) return false;
      }
      if (posTableSearch.trim()) {
        const q = posTableSearch.toLowerCase();
        const matchCode = row.code.toLowerCase().includes(q);
        const matchTitle = row.title.toLowerCase().includes(q);
        const matchDept =
          row.departmentName.toLowerCase().includes(q) || row.departmentCode.toLowerCase().includes(q);
        const matchGrade = row.gradeLevel.toLowerCase().includes(q);
        const matchReports = row.reportsToTitle.toLowerCase().includes(q);
        const matchIncumbents = row.incumbents.some(
          (i) => i.name.toLowerCase().includes(q) || i.employeeNumber.toLowerCase().includes(q)
        );
        if (!matchCode && !matchTitle && !matchDept && !matchGrade && !matchReports && !matchIncumbents) {
          return false;
        }
      }
      return true;
    });
  }, [allPositionsFlat, posDeptFilter, posGradeFilter, posStatusFilter, posTableSearch]);

  // Enterprise Table Columns following Rule 24
  const positionColumns: DataTableColumn<FlatPositionRow>[] = useMemo(
    () => [
      {
        key: "code",
        label: "Position Code",
        sortable: true,
        minWidth: 150,
        sortValue: (row) => row.code,
        exportValue: (row) => row.code,
        render: (row) => (
          <span className="font-mono font-bold text-xs bg-muted/70 text-primary px-2 py-0.5 rounded border border-border/60">
            {row.code}
          </span>
        ),
      },
      {
        key: "title",
        label: "Position Title",
        sortable: true,
        minWidth: 230,
        sortValue: (row) => row.title,
        exportValue: (row) => row.title,
        render: (row) => (
          <div>
            <p className="font-semibold text-xs text-foreground leading-tight">{row.title}</p>
            {row.jobDescription ? (
              <p className="text-[10px] text-muted-foreground truncate max-w-xs mt-0.5">{row.jobDescription}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-0.5">Approved 2024 Establishment Position</p>
            )}
          </div>
        ),
      },
      {
        key: "hierarchyTier",
        label: "Hierarchy Level",
        sortable: true,
        minWidth: 175,
        sortValue: (row) => row.tierLevel,
        exportValue: (row) => `Tier ${row.tierLevel}: ${row.tierLabel}`,
        render: (row) => (
          <Badge variant="outline" className={`text-[10px] font-semibold border ${row.tierBadgeClass}`}>
            Tier {row.tierLevel}: {row.tierLabel}
          </Badge>
        ),
      },
      {
        key: "department",
        label: "Division / Department",
        sortable: true,
        minWidth: 200,
        sortValue: (row) => row.departmentName,
        exportValue: (row) => `${row.departmentName} (${row.departmentCode})`,
        render: (row) => (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
              {row.departmentCode}
            </Badge>
            <span className="text-xs text-foreground font-medium">{row.departmentName}</span>
          </div>
        ),
      },
      {
        key: "gradeLevel",
        label: "Substantive Grade",
        sortable: true,
        minWidth: 140,
        sortValue: (row) => parseInt(row.gradeLevel.replace(/\D/g, "")) || 0,
        exportValue: (row) => row.gradeLevel,
        render: (row) => {
          const gradeNum = parseInt(row.gradeLevel.replace(/\D/g, "")) || 10;
          const colorClass =
            gradeNum >= 20
              ? "border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30"
              : gradeNum >= 18
              ? "border-purple-400 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30"
              : gradeNum >= 15
              ? "border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30"
              : gradeNum >= 13
              ? "border-indigo-400 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30"
              : "border-slate-300 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40";
          return (
            <Badge variant="outline" className={`text-xs font-semibold ${colorClass}`}>
              {row.gradeLevel}
            </Badge>
          );
        },
      },
      {
        key: "reportsTo",
        label: "Reports To (Supervisor)",
        sortable: true,
        minWidth: 230,
        sortValue: (row) => row.reportsToTitle,
        exportValue: (row) =>
          row.parentPositionCode ? `[${row.parentPositionCode}] ${row.reportsToTitle}` : row.reportsToTitle,
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
              <Network className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span className="truncate max-w-56" title={row.reportsToTitle}>
                {row.reportsToTitle}
              </span>
            </div>
            {row.parentPositionCode && (
              <span className="font-mono text-[10px] text-muted-foreground ml-5">
                [{row.parentPositionCode}]
              </span>
            )}
          </div>
        ),
      },
      {
        key: "ceiling",
        label: "Ceiling (Quota)",
        sortable: true,
        minWidth: 110,
        sortValue: (row) => row.totalCount,
        exportValue: (row) => String(row.totalCount),
        render: (row) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/80 text-foreground">
            {row.totalCount}
          </span>
        ),
      },
      {
        key: "filled",
        label: "Filled",
        sortable: true,
        minWidth: 90,
        sortValue: (row) => row.filledCount,
        exportValue: (row) => String(row.filledCount),
        render: (row) => (
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            {row.filledCount}
          </span>
        ),
      },
      {
        key: "vacant",
        label: "Vacancies",
        sortable: true,
        minWidth: 90,
        sortValue: (row) => row.vacantCount,
        exportValue: (row) => String(row.vacantCount),
        render: (row) =>
          row.vacantCount > 0 ? (
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
              {row.vacantCount}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">0</span>
          ),
      },
      {
        key: "status",
        label: "Occupancy Status",
        sortable: true,
        minWidth: 150,
        sortValue: (row) => row.occupancyRate,
        exportValue: (row) => `${row.status} (${row.occupancyRate}%)`,
        render: (row) => {
          if (row.status === "filled") {
            return (
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-1 w-fit"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Fully Filled (100%)
              </Badge>
            );
          }
          if (row.status === "partially_filled") {
            return (
              <Badge
                variant="outline"
                className="text-[10px] border-blue-400 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 flex items-center gap-1 w-fit"
              >
                <AlertCircle className="w-3 h-3 text-blue-600" />
                Partial ({row.occupancyRate}%)
              </Badge>
            );
          }
          return (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-1 w-fit font-semibold"
            >
              <UserX className="w-3 h-3 text-amber-600" />
              Vacant (0%)
            </Badge>
          );
        },
      },
      {
        key: "incumbents",
        label: "Current Incumbents",
        sortable: false,
        minWidth: 220,
        exportValue: (row) =>
          row.incumbents.map((i) => `${i.name} [${i.employeeNumber}]`).join("; ") || "Vacant",
        render: (row) => {
          if (!row.incumbents || row.incumbents.length === 0) {
            return <span className="text-xs text-muted-foreground italic">No active incumbent</span>;
          }
          return (
            <div className="flex flex-wrap gap-1.5 py-0.5">
              {row.incumbents.map((incumbent) => (
                <Link key={incumbent.id} href={`/employees/${incumbent.id}`}>
                  <div
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/10 hover:border-primary/40 border border-border/60 text-xs transition-colors cursor-pointer group"
                    title={`${incumbent.name} (${incumbent.employeeNumber}) - ${incumbent.gradeLevel}`}
                  >
                    <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[9px]">
                      {incumbent.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {incumbent.name}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ({incumbent.employeeNumber})
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          );
        },
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        resizable: false,
        minWidth: 100,
        render: (row) => (
          <div className="flex items-center gap-1">
            {(isAdmin || isHR) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={() => {
                  const posObj: OrgChartPosition = {
                    id: row.id,
                    title: row.title,
                    code: row.code,
                    positionCode: row.positionCode,
                    departmentId: row.departmentId,
                    gradeLevel: row.gradeLevel,
                    reportsToTitle: row.reportsToTitle,
                    jobDescription: row.jobDescription,
                    filledCount: row.filledCount,
                    totalCount: row.totalCount,
                    vacantCount: row.vacantCount,
                    isVacant: row.vacantCount > 0,
                    incumbents: row.incumbents,
                  };
                  handleOpenEditPosition(posObj, row.departmentId);
                }}
                title="Edit position specifications & ceiling"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            )}

            {(isAdmin || isHR) && row.filledCount === 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (
                    confirm(
                      `Are you sure you want to delete "${row.title}" (${row.code}) from the establishment register?`
                    )
                  ) {
                    deletePositionMutation.mutate(row.id);
                  }
                }}
                title="Delete vacant establishment position"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, isHR, deletePositionMutation]
  );

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
    createDepartmentMutation.mutate({
      name: newDeptName.trim(),
      code: newDeptCode.trim() || undefined,
    });
  };

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptForPos || !newPosTitle.trim()) return;
    createPositionMutation.mutate({
      title: newPosTitle.trim(),
      positionCode: newPosCode.trim() || undefined,
      departmentId: targetDeptForPos,
      gradeLevel: newPosGrade,
      totalCount: parseInt(newPosCount, 10) || 1,
      parentPositionId: newPosParentPositionId !== "none" ? Number(newPosParentPositionId) : null,
      reportsToTitle: newPosReportsTo.trim() || undefined,
    });
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
          <div className="flex flex-wrap items-center gap-2">
            {(isAdmin || isHR) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddDeptOpen(true)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Division
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setTargetDeptForPos(data?.departments?.[0]?.id || 1);
                    setIsAddPosOpen(true);
                  }}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Position
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs">
              <Printer className="w-4 h-4 mr-1.5" />
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
            <TabsList className="grid w-full sm:w-auto grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="diagram" className="flex items-center gap-2">
                <GitFork className="h-4 w-4" /> Org Chart Diagram
              </TabsTrigger>
              <TabsTrigger value="roster" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> Department Rosters
              </TabsTrigger>
              <TabsTrigger value="positions" className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4" /> All Positions Register
              </TabsTrigger>
              <TabsTrigger value="builder" className="flex items-center gap-2">
                <Move className="h-4 w-4" /> Structure Builder
              </TabsTrigger>
            </TabsList>

            {activeTab === "positions" && (isAdmin || isHR) && (
              <Button
                size="sm"
                onClick={() => {
                  setTargetDeptForPos(data?.departments?.[0]?.id || 1);
                  setIsAddPosOpen(true);
                }}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Position
              </Button>
            )}

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
                                <div className="flex items-center gap-1">
                                  {(isAdmin || isHR) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAddPosition(dept.id);
                                      }}
                                      title="Add new position to this division"
                                    >
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      Position
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground"
                                    onClick={(event) => { event.stopPropagation(); toggleDeptCollapse(dept.id); }}
                                  >
                                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </div>
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

                            {/* Position Nodes & Authentic Hierarchical Tree Branches */}
                            {!isCollapsed && (
                              <CardContent className="p-3.5 space-y-3.5 flex-1">
                                {dept.positions.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-lg">
                                    No positions matching current filter.
                                  </div>
                                ) : (
                                  <div className="space-y-3.5">
                                    {buildDivisionHierarchyTree(dept.positions).roots.map((rootNode) => (
                                      <PositionTreeBranch
                                        key={rootNode.position.id}
                                        node={rootNode}
                                        deptId={dept.id}
                                        deptCode={dept.code}
                                        isAdmin={isAdmin}
                                        isHR={isHR}
                                        onEditPosition={handleOpenEditPosition}
                                        onAddSubordinate={(parentPosId) => handleOpenAddPosition(dept.id, parentPosId)}
                                      />
                                    ))}
                                  </div>
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
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                    Cap: {pos.totalCount}
                                  </Badge>
                                  {(isAdmin || isHR) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditPosition(pos, dept.id);
                                      }}
                                      title="Edit position specifications"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
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

          {/* TAB 4: ALL POSITIONS REGISTER (RULE 24 ENTERPRISE TABLE) */}
          <TabsContent value="positions" className="space-y-4 mt-0">
            {/* Positions KPI Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="p-3 border-l-4 border-l-primary bg-card shadow-2xs">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Approved Positions</p>
                <p className="text-xl font-bold mt-0.5">{positionStats.totalPositions}</p>
                <p className="text-[10px] text-muted-foreground">Unique establishment titles</p>
              </Card>
              <Card className="p-3 border-l-4 border-l-blue-500 bg-card shadow-2xs">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Ceiling Quota</p>
                <p className="text-xl font-bold mt-0.5 text-blue-600 dark:text-blue-400">{positionStats.totalCeiling}</p>
                <p className="text-[10px] text-muted-foreground">Authorized headcount cap</p>
              </Card>
              <Card className="p-3 border-l-4 border-l-emerald-500 bg-card shadow-2xs">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Filled Headcount</p>
                <p className="text-xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{positionStats.totalFilled}</p>
                <p className="text-[10px] text-muted-foreground">Substantive incumbents</p>
              </Card>
              <Card className="p-3 border-l-4 border-l-amber-500 bg-card shadow-2xs">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Open Vacancies</p>
                <p className="text-xl font-bold mt-0.5 text-amber-600 dark:text-amber-400">{positionStats.totalVacant}</p>
                <p className="text-[10px] text-muted-foreground">Unfilled establishment slots</p>
              </Card>
              <Card className="p-3 border-l-4 border-l-indigo-500 bg-card shadow-2xs">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Establishment Fill Rate</p>
                <p className="text-xl font-bold mt-0.5 text-indigo-600 dark:text-indigo-400">{positionStats.fillRate}%</p>
                <p className="text-[10px] text-muted-foreground">Capacity utilization</p>
              </Card>
            </div>

            {/* Filter & Action Controls Card */}
            <Card className="p-4 shadow-2xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Global Filter Search */}
                <div className="flex-1 max-w-md relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by code, title, division, grade, supervisor, or incumbent..."
                    value={posTableSearch}
                    onChange={(e) => setPosTableSearch(e.target.value)}
                    className="pl-9 h-9 text-xs bg-card"
                  />
                </div>

                {/* Select Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Division Filter */}
                  <Select value={posDeptFilter} onValueChange={setPosDeptFilter}>
                    <SelectTrigger className="h-9 text-xs w-45">
                      <SelectValue placeholder="All Divisions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Divisions</SelectItem>
                      {data?.departments?.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.code} - {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Grade Filter */}
                  <Select value={posGradeFilter} onValueChange={setPosGradeFilter}>
                    <SelectTrigger className="h-9 text-xs w-32.5">
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      <SelectItem value="Grade 20">Grade 20 (CEO)</SelectItem>
                      <SelectItem value="Grade 18">Grade 18 (Director)</SelectItem>
                      <SelectItem value="Grade 16">Grade 16 (Manager)</SelectItem>
                      <SelectItem value="Grade 15">Grade 15 (Sr Officer)</SelectItem>
                      <SelectItem value="Grade 14">Grade 14 (Specialist)</SelectItem>
                      <SelectItem value="Grade 13">Grade 13 (Coordinator)</SelectItem>
                      <SelectItem value="Grade 12">Grade 12 (Officer)</SelectItem>
                      <SelectItem value="Grade 11">Grade 11 (Assistant)</SelectItem>
                      <SelectItem value="Grade 10">Grade 10 (Support)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Occupancy Status Filter */}
                  <Select value={posStatusFilter} onValueChange={setPosStatusFilter}>
                    <SelectTrigger className="h-9 text-xs w-37.5">
                      <SelectValue placeholder="All Occupancies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="filled">Fully Filled (100%)</SelectItem>
                      <SelectItem value="partially_filled">Partially Filled</SelectItem>
                      <SelectItem value="has_vacancies">Has Open Vacancies</SelectItem>
                      <SelectItem value="vacant">Fully Vacant (0%)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Reset Filters Button */}
                  {(posTableSearch || posDeptFilter !== "all" || posGradeFilter !== "all" || posStatusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPosTableSearch("");
                        setPosDeptFilter("all");
                        setPosGradeFilter("all");
                        setPosStatusFilter("all");
                      }}
                      className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                      title="Reset all table filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Reset
                    </Button>
                  )}

                  {/* Add Position Action */}
                  {(isAdmin || isHR) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setTargetDeptForPos(data?.departments?.[0]?.id || 1);
                        setIsAddPosOpen(true);
                      }}
                      className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Position
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Enterprise Grade Positions Table */}
            <DataTable<FlatPositionRow>
              columns={positionColumns}
              rows={filteredPositions}
              getRowId={(row) => row.id}
              isLoading={isLoading}
              tableId="org-chart-positions-register"
              exportFilename="nisit_establishment_positions_register"
              data-testid="table-org-chart-positions"
              emptyState={
                <div className="py-8 text-center space-y-2">
                  <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="font-semibold text-sm text-foreground">No establishment positions found</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No positions match your current search query or filter selection.
                  </p>
                  {(posTableSearch || posDeptFilter !== "all" || posGradeFilter !== "all" || posStatusFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs mt-2"
                      onClick={() => {
                        setPosTableSearch("");
                        setPosDeptFilter("all");
                        setPosGradeFilter("all");
                        setPosStatusFilter("all");
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Filters
                    </Button>
                  )}
                </div>
              }
            />
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
                  <label className="font-semibold text-foreground block mb-1">Division / Unit Name *</label>
                  <Input
                    placeholder="e.g. Conformity Assessment & Testing Division"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Division Code (Optional)</label>
                  <Input
                    placeholder="e.g. DIV-CAT"
                    value={newDeptCode}
                    onChange={(e) => setNewDeptCode(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDeptOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDepartmentMutation.isPending} className="bg-primary">
                  {createDepartmentMutation.isPending ? "Creating..." : "Create Division"}
                </Button>
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
                  Create an approved position ceiling and statutory grade for the establishment.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4 text-xs">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Position Title *</label>
                  <Input
                    placeholder="e.g. Senior Calibration Metrologist"
                    value={newPosTitle}
                    onChange={(e) => setNewPosTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Position Code</label>
                    <Input
                      placeholder="e.g. NISIT-POS-MET-003"
                      value={newPosCode}
                      onChange={(e) => setNewPosCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Target Division *</label>
                    <Select
                      value={targetDeptForPos ? String(targetDeptForPos) : "1"}
                      onValueChange={(val) => setTargetDeptForPos(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Division" />
                      </SelectTrigger>
                      <SelectContent>
                        {(data?.departments || []).map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Grade Level</label>
                    <Select value={newPosGrade} onValueChange={setNewPosGrade}>
                      <SelectTrigger>
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grade 10">Grade 10 (Junior Officer)</SelectItem>
                        <SelectItem value="Grade 11">Grade 11 (Administrative Specialist)</SelectItem>
                        <SelectItem value="Grade 12">Grade 12 (Technical Officer)</SelectItem>
                        <SelectItem value="Grade 13">Grade 13 (Senior Technical Officer)</SelectItem>
                        <SelectItem value="Grade 14">Grade 14 (Principal Specialist)</SelectItem>
                        <SelectItem value="Grade 15">Grade 15 (Senior Principal Officer)</SelectItem>
                        <SelectItem value="Grade 16">Grade 16 (Divisional Manager)</SelectItem>
                        <SelectItem value="Grade 17">Grade 17 (Senior Divisional Manager)</SelectItem>
                        <SelectItem value="Grade 18">Grade 18 (Divisional Director)</SelectItem>
                        <SelectItem value="Grade 20">Grade 20 (Director General / CEO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Approved Headcount *</label>
                    <Input
                      type="number"
                      min="1"
                      value={newPosCount}
                      onChange={(e) => setNewPosCount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="font-semibold text-foreground block mb-1">Reports To (Supervisory Position)</label>
                  <Select
                    value={newPosParentPositionId}
                    onValueChange={(val) => {
                      setNewPosParentPositionId(val);
                      if (val === "none") {
                        setNewPosReportsTo("NISIT Council");
                      } else {
                        const parent = allPositionsFlat.find((p) => String(p.id) === val);
                        if (parent) setNewPosReportsTo(parent.title);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Select Direct Supervisor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="none">
                        ⭐ Apex / Direct to NISIT Council (No Supervisor)
                      </SelectItem>
                      {allPositionsFlat.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <span className="font-mono text-[10px] text-muted-foreground mr-1.5">[{p.code}]</span>
                          <span className="font-medium">{p.title}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">({p.gradeLevel}) • {p.departmentCode}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">
                    Supervisor: <span className="font-semibold text-foreground">{newPosReportsTo || "None (Apex Council)"}</span>
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddPosOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPositionMutation.isPending} className="bg-primary">
                  {createPositionMutation.isPending ? "Creating..." : "Add Position"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit Position Details & Establishment Ceiling */}
        <Dialog open={isEditPosOpen} onOpenChange={setIsEditPosOpen}>
          <DialogContent className="sm:max-w-lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingPosId) return;
                updatePositionMutation.mutate({
                  id: editingPosId,
                  data: {
                    title: editPosTitle.trim(),
                    positionCode: editPosCode.trim(),
                    departmentId: Number(editPosDeptId),
                    gradeLevel: editPosGrade,
                    totalCount: Math.max(1, Number(editPosCount) || 1),
                    parentPositionId: editPosParentPositionId !== "none" ? Number(editPosParentPositionId) : null,
                    reportsToTitle: editPosReportsTo.trim() || null,
                  },
                });
              }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-primary" />
                  Configure Establishment Position
                </DialogTitle>
                <DialogDescription>
                  Update statutory position specifications, substantive pay grade, divisional assignment, and establishment ceiling.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Position Title *</label>
                  <Input
                    value={editPosTitle}
                    onChange={(e) => setEditPosTitle(e.target.value)}
                    placeholder="e.g. Senior Standards & Metrology Officer"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Position Code *</label>
                    <Input
                      value={editPosCode}
                      onChange={(e) => setEditPosCode(e.target.value)}
                      placeholder="e.g. NISIT-POS-STD-002"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Division / Department *</label>
                    <Select value={editPosDeptId} onValueChange={setEditPosDeptId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {(data?.departments || []).map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Substantive Pay Grade *</label>
                    <Select value={editPosGrade} onValueChange={setEditPosGrade}>
                      <SelectTrigger>
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grade 10">Grade 10 (Junior Officer)</SelectItem>
                        <SelectItem value="Grade 11">Grade 11 (Administrative Specialist)</SelectItem>
                        <SelectItem value="Grade 12">Grade 12 (Technical Officer)</SelectItem>
                        <SelectItem value="Grade 13">Grade 13 (Senior Technical Officer)</SelectItem>
                        <SelectItem value="Grade 14">Grade 14 (Principal Specialist)</SelectItem>
                        <SelectItem value="Grade 15">Grade 15 (Senior Principal Officer)</SelectItem>
                        <SelectItem value="Grade 16">Grade 16 (Divisional Manager)</SelectItem>
                        <SelectItem value="Grade 17">Grade 17 (Senior Divisional Manager)</SelectItem>
                        <SelectItem value="Grade 18">Grade 18 (Divisional Director)</SelectItem>
                        <SelectItem value="Grade 20">Grade 20 (Director General / CEO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Establishment Ceiling (Headcount) *</label>
                    <Input
                      type="number"
                      min="1"
                      value={editPosCount}
                      onChange={(e) => setEditPosCount(e.target.value)}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Current Incumbents: {editPosIncumbentCount} filled
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="font-semibold text-foreground block mb-1">Reports To (Supervisory Position)</label>
                  <Select
                    value={editPosParentPositionId}
                    onValueChange={(val) => {
                      setEditPosParentPositionId(val);
                      if (val === "none") {
                        setEditPosReportsTo("NISIT Council");
                      } else {
                        const parent = allPositionsFlat.find((p) => String(p.id) === val);
                        if (parent) setEditPosReportsTo(parent.title);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Select Direct Supervisor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="none">
                        ⭐ Apex / Direct to NISIT Council (No Supervisor)
                      </SelectItem>
                      {allPositionsFlat
                        .filter((p) => p.id !== editingPosId)
                        .map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            <span className="font-mono text-[10px] text-muted-foreground mr-1.5">[{p.code}]</span>
                            <span className="font-medium">{p.title}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">({p.gradeLevel}) • {p.departmentCode}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">
                    Supervisor: <span className="font-semibold text-foreground">{editPosReportsTo || "None (Apex Council)"}</span>
                  </p>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
                <div>
                  {editPosIncumbentCount === 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deletePositionMutation.isPending}
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${editPosTitle}" from the establishment register?`)) {
                          deletePositionMutation.mutate(editingPosId!);
                        }
                      }}
                    >
                      Delete Position
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditPosOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updatePositionMutation.isPending} className="bg-primary">
                    {updatePositionMutation.isPending ? "Saving..." : "Save Position Changes"}
                  </Button>
                </div>
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
