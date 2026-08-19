import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Download,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Printer,
  Copy,
  Check,
  Compass,
  ExternalLink,
  HelpCircle,
  FileDown,
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  Layers,
  Tag,
  ChevronRight,
  Info,
  ShieldAlert,
  ListOrdered,
  Rocket,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/contexts/use-auth";
import { getAuthHeader } from "@/lib/api-config";

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex tokens: **bold**, *italic*, `code`, and plain text
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-bold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="italic text-foreground/90">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-muted text-primary text-xs font-mono border border-border/70"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

function WikiContentRenderer({ content }: { content: string }) {
  if (!content) return null;

  // Split into lines to normalize structured content
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // 1. Version tag (e.g. "Version 1.2.0 (Current Release)" or "# Version ...")
    if (/^#*\s*Version\s+\d+\.\d+/i.test(line)) {
      blocks.push(
        <div
          key={`ver-${i}`}
          className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/25 shadow-xs my-4"
        >
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">
                {line.replace(/^#*\s*/, "")}
              </span>
              <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold tracking-wider">
                Production Release
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Statutory Human Resources &amp; Institutional Governance System
            </p>
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 2. Feature / Issue Section Headers (e.g. "🚀 Major Features & Enhancements", "🛠 Resolved Issues")
    if (line.includes("🚀") || line.includes("Major Features") || line.includes("🛠") || line.includes("Resolved Issues") || line.includes("🛡") || line.includes("Governance")) {
      const isFeature = line.includes("🚀") || line.includes("Major Features");
      const isFix = line.includes("🛠") || line.includes("Resolved Issues");
      
      blocks.push(
        <div
          key={`sec-header-${i}`}
          className={`flex items-center gap-2.5 p-3 rounded-lg border my-4 ${
            isFeature
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : isFix
              ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
              : "bg-muted/60 border-border text-foreground"
          }`}
        >
          {isFeature ? (
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : isFix ? (
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          )}
          <span className="font-bold text-sm">{renderInlineMarkdown(line)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 3. Level 2 Headers ("## Section")
    if (line.startsWith("## ")) {
      const title = line.replace("## ", "");
      blocks.push(
        <div key={`h2-${i}`} className="mt-8 mb-3 pb-2 border-b border-border/80 flex items-center gap-2">
          <div className="w-1.5 h-5 rounded-full bg-primary" />
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {renderInlineMarkdown(title)}
          </h3>
        </div>
      );
      i++;
      continue;
    }

    // 4. Level 3 Headers ("### Subheader")
    if (line.startsWith("### ")) {
      const title = line.replace("### ", "");
      blocks.push(
        <h4 key={`h3-${i}`} className="text-sm sm:text-base font-bold text-foreground mt-5 mb-2 flex items-center gap-1.5">
          <ChevronRight className="w-4 h-4 text-primary" />
          {renderInlineMarkdown(title)}
        </h4>
      );
      i++;
      continue;
    }

    // 5. Numbered Steps / Lists (Lines starting with "1. ", "2. " or consecutive numbered blocks)
    if (/^\d+\.\s+/.test(line)) {
      const stepItems: { num: string; text: string; subItems: string[] }[] = [];

      while (i < lines.length && (/^\d+\.\s+/.test(lines[i].trim()) || /^\s+[-*]\s+/.test(lines[i]) || /^\s+\d+\.\s+/.test(lines[i]))) {
        const cur = lines[i].trim();
        if (/^\d+\.\s+/.test(cur)) {
          const numMatch = cur.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            stepItems.push({
              num: numMatch[1],
              text: numMatch[2],
              subItems: [],
            });
          }
        } else if (/^[-*]\s+/.test(cur) && stepItems.length > 0) {
          stepItems[stepItems.length - 1].subItems.push(cur.replace(/^[-*]\s+/, ""));
        } else if (cur) {
          // If there's an attached paragraph in this step
          if (stepItems.length > 0) {
            stepItems[stepItems.length - 1].text += " " + cur;
          }
        }
        i++;
      }

      blocks.push(
        <div key={`steps-${i}`} className="space-y-3 my-4">
          {stepItems.map((step, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary font-bold text-xs shrink-0 mt-0.5">
                {step.num}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-xs sm:text-sm text-foreground leading-relaxed">
                  {renderInlineMarkdown(step.text)}
                </div>
                {step.subItems.length > 0 && (
                  <ul className="space-y-1.5 pl-2 border-l-2 border-primary/20 mt-2">
                    {step.subItems.map((sub, sIdx) => (
                      <li key={sIdx} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                        <span>{renderInlineMarkdown(sub)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      );
      continue;
    }

    // 6. Unordered Bullet Lists ("- " or "* ")
    if (/^[-*]\s+/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && (/^[-*]\s+/.test(lines[i].trim()) || /^\s+[-*]\s+/.test(lines[i]))) {
        const cur = lines[i].trim();
        if (/^[-*]\s+/.test(cur)) {
          bullets.push(cur.replace(/^[-*]\s+/, ""));
        }
        i++;
      }

      blocks.push(
        <ul key={`bullets-${i}`} className="space-y-2 my-3 pl-1">
          {bullets.map((bullet, bIdx) => (
            <li
              key={bIdx}
              className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/20 border border-border/40 text-xs sm:text-sm text-foreground leading-relaxed"
            >
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0 shadow-xs" />
              <div className="flex-1">{renderInlineMarkdown(bullet)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. Callouts / Notes ("> ...")
    if (line.startsWith(">")) {
      const calloutText = line.replace(/^>\s*/, "");
      blocks.push(
        <div
          key={`callout-${i}`}
          className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm my-3 shadow-2xs"
        >
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{renderInlineMarkdown(calloutText)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 8. Regular Paragraphs
    blocks.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm text-muted-foreground leading-relaxed my-2">
        {renderInlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-2 font-sans">{blocks}</div>;
}

type Attachment = { name: string; url: string; type?: "file" | "image" };
type Article = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  category: string;
  content: string;
  attachments: Attachment[];
  published: boolean;
  updatedAt: string;
  createdAt?: string;
};

const emptyArticle = {
  title: "",
  slug: "",
  summary: "",
  category: "Getting Started",
  content: "",
  attachments: [] as Attachment[],
  published: true,
};

const OFFICIAL_MANUALS = [
  {
    title: "NISIT HR Portal: End-to-End Handbook",
    filename: "NISIT-HR-Portal-End-to-End-Handbook.docx",
    url: "/NISIT-HR-Portal-End-to-End-Handbook.docx",
    description: "Complete statutory reference manual covering recruitment, establishment control, leave, performance, and RBAC governance.",
    badge: "Official Handbook",
    icon: FileText,
  },
  {
    title: "Staff & Employee Self-Service (ESS) User Guide",
    filename: "NISIT-HR-Portal-Staff-User-Guide.docx",
    url: "/NISIT-HR-Portal-Staff-User-Guide.docx",
    description: "Operational guide for all active NISIT staff: leave applications, attendance clock-ins, training nominations, and profile updates.",
    badge: "Staff ESS Manual",
    icon: FileText,
  },
  {
    title: "Public Vacancies & Applicant User Guide",
    filename: "NISIT-HR-Portal-Applicant-User-Guide.docx",
    url: "/NISIT-HR-Portal-Applicant-User-Guide.docx",
    description: "Step-by-step handbook for job applicants: vacancy search, 8-step wizard submission, CV upload, and status tracking.",
    badge: "Applicant Guide",
    icon: FileText,
  },
];

async function apiRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Request failed");
  }
  return response.json();
}

export default function HelpGuidePage() {
  const { isAdmin } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selected, setSelected] = useState<Article | null>(null);
  const [editing, setEditing] = useState<Article | typeof emptyArticle | null>(null);
  const [attachment, setAttachment] = useState<Attachment>({ name: "", url: "", type: "file" });
  const [copied, setCopied] = useState(false);

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["wiki", query],
    queryFn: () => apiRequest(`/api/wiki/articles?q=${encodeURIComponent(query)}`),
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => set.add(a.category || "General"));
    return ["All", ...Array.from(set)];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    let list = articles;
    if (selectedCategory !== "All") {
      list = list.filter((a) => a.category === selectedCategory);
    }
    return list;
  }, [articles, selectedCategory]);

  const saveMutation = useMutation({
    mutationFn: (article: Article | typeof emptyArticle) => {
      if ("id" in article && article.id) {
        return apiRequest(`/api/wiki/articles/${article.id}`, {
          method: "PATCH",
          body: JSON.stringify(article),
        });
      }
      return apiRequest("/api/wiki/articles", {
        method: "POST",
        body: JSON.stringify(article),
      });
    },
    onSuccess: (savedArticle: Article) => {
      queryClient.invalidateQueries({ queryKey: ["wiki"] });
      setEditing(null);
      setSelected(savedArticle);
      toast({
        title: "Wiki Article Saved",
        description: "The knowledge base article has been successfully published.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Save",
        description: err.message || "An error occurred while saving the wiki article.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/wiki/articles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki"] });
      setSelected(null);
      toast({
        title: "Article Deleted",
        description: "The article has been removed from the knowledge base.",
      });
    },
  });

  const handleCopyLink = () => {
    if (!selected) return;
    const url = `${window.location.origin}/help-guide#${selected.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link Copied", description: "Article URL copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const addAttachment = () => {
    if (!attachment.name || !attachment.url || !editing) return;
    setEditing({ ...editing, attachments: [...editing.attachments, attachment] });
    setAttachment({ name: "", url: "", type: "file" });
  };

  const chooseFile = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Choose a file smaller than 2 MB for knowledge base attachments.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: attachment.name || file.name,
        url: String(reader.result),
        type: file.type.startsWith("image/") ? "image" : "file",
      });
    };
    reader.readAsDataURL(file);
  };

  useMemo(() => {
    if (!selected && filteredArticles.length > 0) {
      setSelected(filteredArticles[0]);
    }
  }, [filteredArticles, selected]);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-help-guide">
                Help &amp; User Guide
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Living institutional knowledge base, operational procedures, statutory workflows, and official manuals.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                onClick={() => setEditing({ ...emptyArticle })}
                className="shadow-sm"
                data-testid="btn-new-wiki"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Knowledge Article
              </Button>
            )}
          </div>
        </div>

        <Card className="bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/50 border-blue-100 shadow-sm print:hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Official Downloadable Word Manuals</CardTitle>
              </div>
              <Badge variant="outline" className="bg-white text-xs text-primary font-medium">
                MS Word (.docx) Format
              </Badge>
            </div>
            <CardDescription>
              Download comprehensive statutory operating guides and handbooks for offline reading or distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid sm:grid-cols-3 gap-3">
              {OFFICIAL_MANUALS.map((manual) => (
                <div
                  key={manual.filename}
                  className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-primary/50 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        {manual.badge}
                      </Badge>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-bold line-clamp-2 text-foreground">{manual.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{manual.description}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                    <a
                      href={manual.url}
                      download={manual.filename}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Manual
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between print:hidden">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-background shadow-xs"
              placeholder="Search guides, procedures, policies, and release notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="input-search-wiki"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                size="sm"
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="text-xs h-8"
                data-testid={`filter-cat-${category}`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
          <Card className="shadow-sm print:hidden">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Knowledge Articles</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">
                  {filteredArticles.length} found
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-1 max-h-[750px] overflow-y-auto">
              {isLoading && (
                <div className="p-4 space-y-3">
                  <div className="h-12 bg-muted/60 rounded animate-pulse" />
                  <div className="h-12 bg-muted/60 rounded animate-pulse" />
                  <div className="h-12 bg-muted/60 rounded animate-pulse" />
                </div>
              )}

              {!isLoading && filteredArticles.length === 0 && (
                <div className="text-center py-10 text-muted-foreground p-4">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No articles match your search or filter.</p>
                </div>
              )}

              {!isLoading &&
                filteredArticles.map((article) => {
                  const isSelected = selected?.id === article.id;
                  return (
                    <button
                      key={article.id}
                      onClick={() => setSelected(article)}
                      className={`w-full text-left rounded-md p-3 transition-all duration-150 border ${
                        isSelected
                          ? "bg-primary/10 border-primary/30 text-foreground font-medium shadow-xs"
                          : "border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`article-item-${article.id}`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            isSelected ? "bg-primary/20 text-primary border-primary/30" : ""
                          }`}
                        >
                          {article.category}
                        </Badge>
                        {isAdmin && !article.published && (
                          <Badge variant="secondary" className="text-[10px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className={`text-xs font-semibold leading-tight line-clamp-2 ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {article.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                        {article.summary}
                      </p>
                    </button>
                  );
                })}
            </CardContent>
          </Card>

          <Card className="min-h-[650px] shadow-sm">
            <CardContent className="p-6 sm:p-8">
              {selected ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/30">
                          {selected.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Updated {new Date(selected.updatedAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ~{Math.max(1, Math.round(selected.content.length / 800))} min read
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {selected.title}
                      </h2>
                      {selected.summary && (
                        <p className="text-sm font-medium text-muted-foreground max-w-2xl">
                          {selected.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 print:hidden">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyLink}
                        className="text-xs h-8"
                        data-testid="btn-copy-link"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                        {copied ? "Copied" : "Copy Link"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePrint}
                        className="text-xs h-8"
                        data-testid="btn-print-article"
                      >
                        <Printer className="h-3.5 w-3.5 mr-1" />
                        Print
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(selected)}
                            className="text-xs h-8"
                            data-testid="btn-edit-article"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive text-xs h-8 hover:bg-destructive/10"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this wiki article?")) {
                                deleteMutation.mutate(selected.id);
                              }
                            }}
                            data-testid="btn-delete-article"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rich Formatted Wiki Article Body */}
                  <div className="mt-6">
                    <WikiContentRenderer content={selected.content} />
                  </div>

                  {selected.attachments?.length > 0 && (
                    <div className="mt-8 border-t pt-6 space-y-3">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">Attachments &amp; Reference Screenshots</h4>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {selected.attachments.map((item, index) => (
                          <a
                            key={index}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border p-3 hover:bg-muted/50 transition-colors flex gap-3 items-center group"
                          >
                            {item.type === "image" ? (
                              <img
                                src={item.url}
                                alt={item.name}
                                className="w-14 h-12 object-cover rounded border"
                              />
                            ) : (
                              <div className="p-2 rounded bg-primary/10 text-primary">
                                <FileText className="h-5 w-5" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                                {item.name}
                              </p>
                              <span className="text-[10px] text-muted-foreground">Click to preview file</span>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full min-h-[450px] flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
                  <div className="p-4 rounded-full bg-muted/60">
                    <BookOpen className="h-10 w-10 text-muted-foreground/60" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">Select a Knowledge Article</p>
                    <p className="text-xs max-w-sm">
                      Choose an article from the sidebar directory or search above to view step-by-step procedures.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {editing && (
          <Dialog open onOpenChange={() => setEditing(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {"id" in editing && editing.id ? "Edit Knowledge Article" : "Create New Knowledge Article"}
                </DialogTitle>
                <DialogDescription>
                  Author authoritative procedures, user guides, or release notes for the institutional Wiki.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Article Title</label>
                  <Input
                    placeholder="e.g., How to Process Annual Recreation Leave"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Category</label>
                    <Input
                      placeholder="e.g., Recruitment, Employee Services, Administration"
                      value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">URL Slug (Optional)</label>
                    <Input
                      placeholder="e.g., annual-leave-guide"
                      value={editing.slug}
                      onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Brief Summary (1-2 sentences)</label>
                  <Input
                    placeholder="A concise summary displayed in search and article cards"
                    value={editing.summary}
                    onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Article Content (Markdown supported)</label>
                  <Textarea
                    className="min-h-60 text-sm font-mono"
                    placeholder="Write headings (##), lists (-), and step-by-step procedures..."
                    value={editing.content}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="publishCheck"
                    className="rounded border-gray-300 h-4 w-4 text-primary focus:ring-primary"
                    checked={editing.published}
                    onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                  />
                  <label htmlFor="publishCheck" className="text-sm font-medium cursor-pointer">
                    Publish this article immediately for all portal users
                  </label>
                </div>

                <div className="border rounded-lg p-3.5 bg-muted/20 space-y-3">
                  <div>
                    <p className="font-semibold text-xs text-foreground">Attach Screenshot or Document</p>
                    <p className="text-[11px] text-muted-foreground">Max 2 MB per file.</p>
                  </div>
                  <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input
                      placeholder="Display label"
                      value={attachment.name}
                      onChange={(e) => setAttachment({ ...attachment, name: e.target.value })}
                    />
                    <Input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => chooseFile(e.target.files?.[0])}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addAttachment}
                      disabled={!attachment.url}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> Attach
                    </Button>
                  </div>
                  {editing.attachments.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {editing.attachments.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded border"
                        >
                          <span className="truncate">{item.name}</span>
                          <button
                            type="button"
                            className="text-destructive font-medium hover:underline text-[11px]"
                            onClick={() =>
                              setEditing({
                                ...editing,
                                attachments: editing.attachments.filter((_, i) => i !== index),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveMutation.mutate(editing as Article)}
                  disabled={saveMutation.isPending || !editing.title.trim() || !editing.content.trim()}
                >
                  {saveMutation.isPending ? "Saving…" : "Save & Publish Article"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
