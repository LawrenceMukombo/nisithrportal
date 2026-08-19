import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  UserCheck,
  Calendar,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";

interface TrainingCourse {
  id: number;
  title: string;
  code: string;
  category: "iso_standards" | "metrology" | "compliance" | "management" | "technical";
  description: string | null;
  provider: string | null;
  durationHours: number;
  isMandatory: boolean;
  certificationIssued: boolean;
}

interface TrainingEnrollment {
  id: number;
  employeeId: number;
  courseId: number;
  courseTitle: string;
  courseCode: string;
  category: string;
  status: "enrolled" | "in_progress" | "completed" | "failed" | "expired";
  score: string | null;
  certificateNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
}

export default function TrainingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isHR } = useRole();

  const [activeTab, setActiveTab] = useState("courses");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [enrollDialog, setEnrollDialog] = useState<{ open: boolean; course: any | null }>({ open: false, course: null });
  const [isCourseOpen, setIsCourseOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCategory, setCourseCategory] = useState("technical_standards");
  const [courseProvider, setCourseProvider] = useState("");
  const [courseDuration, setCourseDuration] = useState("16");
  const [courseValidity, setCourseValidity] = useState("24");
  const [courseMandatory, setCourseMandatory] = useState(false);
  const [courseDescription, setCourseDescription] = useState("");

  // Fetch Courses
  const { data: rawCourses, isLoading: isLoadingCourses } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training/courses"],
    queryFn: async () => {
      const res = await fetch("/api/training/courses");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const courses = Array.isArray(rawCourses) ? rawCourses : [];

  // Fetch My Enrollments & Certifications
  const { data: rawEnrollments, isLoading: isLoadingEnrollments } = useQuery<TrainingEnrollment[]>({
    queryKey: ["/api/training/enrollments"],
    queryFn: async () => {
      const res = await fetch("/api/training/enrollments", {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const enrollments = Array.isArray(rawEnrollments) ? rawEnrollments : [];

  // Enroll Mutation
  const enrollMutation = useMutation({
    mutationFn: async (courseId: number) => {
      const res = await fetch("/api/training/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) throw new Error("Failed to enroll in course");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/enrollments"] });
      toast({ title: "Enrolled Successfully", description: "You are registered for this training program." });
      setEnrollDialog({ open: false, course: null });
    },
    onError: (err: any) => {
      toast({ title: "Enrollment Failed", description: err.message, variant: "destructive" });
    },
  });

  // Create Course Mutation
  const createCourseMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/training/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add course");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/courses"] });
      toast({ title: "Course Added", description: "Training module registered in NISIT catalogue." });
      setIsCourseOpen(false);
      setCourseTitle("");
      setCourseDescription("");
      setCourseProvider("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle || !courseProvider) return;
    createCourseMutation.mutate({
      title: courseTitle,
      category: courseCategory,
      provider: courseProvider,
      durationHours: parseInt(courseDuration, 10) || 16,
      validityMonths: parseInt(courseValidity, 10) || 24,
      isMandatory: courseMandatory,
      description: courseDescription,
    });
  };

  const filteredCourses = useMemo(() => {
    const list = Array.isArray(courses) ? courses : [];
    return list.filter((c) => {
      const title = (c.title ?? "").toLowerCase();
      const provider = (c.provider ?? "").toLowerCase();
      const desc = (c.description ?? "").toLowerCase();
      const q = search.toLowerCase().trim();
      const matchSearch = !q || title.includes(q) || provider.includes(q) || desc.includes(q);
      const matchCategory = categoryFilter === "all" || c.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [courses, search, categoryFilter]);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Training & Certifications</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                Capacity Building
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Statutory ISO accreditation, legal metrology standards, and public service compliance certifications
            </p>
          </div>
          {(isAdmin || isHR) && (
            <Button onClick={() => setIsCourseOpen(true)} className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Training Course
            </Button>
          )}
        </div>

        {/* Tabs: Catalogue vs My Enrollments */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="catalogue" className="text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Training Course Catalogue ({courses.length})
            </TabsTrigger>
            <TabsTrigger value="enrollments" className="text-xs font-semibold">
              <Award className="w-3.5 h-3.5 mr-1.5" /> Officer Certifications & Enrollments ({enrollments.length})
            </TabsTrigger>
          </TabsList>

          {/* Catalogue Tab */}
          <TabsContent value="catalogue" className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search course title or provider..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-card"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48 text-xs bg-card">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Disciplines</SelectItem>
                  <SelectItem value="technical_standards">Standards & ISO</SelectItem>
                  <SelectItem value="metrology">Metrology & Calibration</SelectItem>
                  <SelectItem value="leadership">Leadership & Ethics</SelectItem>
                  <SelectItem value="it_security">IT & Data Security</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoadingCourses ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-5"><Skeleton className="h-44 w-full" /></Card>
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold text-foreground">No Courses Found</h3>
                <p className="text-xs text-muted-foreground">Adjust filters or create a new course.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCourses.map((course) => (
                  <Card key={course.id} className="flex flex-col justify-between border-border/80 hover:border-primary/40 transition-all shadow-xs">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                          {course.category.replace("_", " ")}
                        </Badge>
                        {course.isMandatory && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                            Mandatory
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-sm font-bold text-foreground mt-2">{course.title}</CardTitle>
                      <CardDescription className="text-xs font-medium text-primary mt-1">
                        Provider: {course.provider}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 pt-0 space-y-4">
                      {course.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/50">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {course.durationHours} Hours
                        </span>
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> {course.certificationIssued ? "Certificate Issued" : "Attendance Badge"}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => setEnrollDialog({ open: true, course })}
                      >
                        Enroll in Course
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Enrollments Tab */}
          <TabsContent value="enrollments" className="space-y-4">
            {isLoadingEnrollments ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : enrollments.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold text-foreground">No Current Enrollments</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                  Browse the course catalogue to enroll officers in technical calibration or leadership courses.
                </p>
                <Button size="sm" onClick={() => setActiveTab("catalogue")}>
                  Browse Catalogue
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {enrollments.map((en: any) => (
                  <Card key={en.id} className="shadow-xs hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground">{en.courseTitle || `Course #${en.courseId}`}</p>
                          <Badge variant="outline" className="text-xs uppercase">
                            {(en.courseCategory || "training").replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Officer: <span className="font-semibold text-foreground">{en.employeeName || `Employee #${en.employeeId}`}</span> • Provider: {en.courseProvider || "NISIT"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        {en.score && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Score</p>
                            <p className="text-sm font-bold text-foreground">{en.score}%</p>
                          </div>
                        )}
                        {en.certificateNumber && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Certificate #</p>
                            <p className="text-xs font-mono font-bold text-primary">{en.certificateNumber}</p>
                          </div>
                        )}
                        <Badge
                          className={
                            en.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold"
                          }
                        >
                          {en.status === "completed" ? "Certified" : "Enrolled"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Enroll Confirmation Modal */}
        <Dialog
          open={enrollDialog.open}
          onOpenChange={(open) => !open && setEnrollDialog({ open: false, course: null })}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Course Enrollment</DialogTitle>
              <DialogDescription>
                Register for {enrollDialog.course?.title} ({enrollDialog.course?.durationHours} Hours).
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 my-2">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Provider:</span> {enrollDialog.course?.provider}
              </p>
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Certificate Validity:</span>{" "}
                {enrollDialog.course?.validityMonths || 24} Months
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEnrollDialog({ open: false, course: null })}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (enrollDialog.course) enrollMutation.mutate(enrollDialog.course.id);
                }}
                disabled={enrollMutation.isPending}
              >
                {enrollMutation.isPending ? "Enrolling..." : "Confirm Enrollment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Course Modal (HR/Admin) */}
        <Dialog open={isCourseOpen} onOpenChange={setIsCourseOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateCourse}>
              <DialogHeader>
                <DialogTitle>Add Training Course</DialogTitle>
                <DialogDescription>
                  Register a new technical standard or public service training program.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1">Course Title *</label>
                  <Input
                    placeholder="e.g. ISO 9001 Quality Management Systems"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Category</label>
                    <Select value={courseCategory} onValueChange={setCourseCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical_standards">Standards & ISO</SelectItem>
                        <SelectItem value="metrology">Metrology & Calibration</SelectItem>
                        <SelectItem value="leadership">Leadership & Ethics</SelectItem>
                        <SelectItem value="it_security">IT & Cybersecurity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1">Duration (Hours)</label>
                    <Input type="number" min="1" value={courseDuration} onChange={(e) => setCourseDuration(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Provider / Institution *</label>
                  <Input
                    placeholder="e.g. ISO, PNGIPA, or NISIT Internal"
                    value={courseProvider}
                    onChange={(e) => setCourseProvider(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1">Course Syllabus / Description</label>
                  <Textarea
                    placeholder="Key learning outcomes and prerequisites..."
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCourseOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCourseMutation.isPending}>
                  {createCourseMutation.isPending ? "Saving..." : "Register Course"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
