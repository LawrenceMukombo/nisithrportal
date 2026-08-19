import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Briefcase, Users, FileText, UserCheck,
  ScrollText, Building2, FolderKanban, Settings, LogOut,
  ChevronRight, ChevronDown, Menu, X, Moon, Sun, StarIcon, GitBranch, Puzzle, UserCog, Clock,
  Calendar, Timer, UserPlus, UserMinus, Target, GraduationCap, HeartHandshake, Home,
  FolderLock, FileBadge, BarChart3, ShieldCheck,
} from "lucide-react";
import { useAuth, useRole } from "@/contexts/use-auth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function useNavItems() {
  const { canViewCandidates, canManageJobs, canManageEmployees, canManageContracts, canManageAgencies, canViewDashboard, isApplicant, isAdmin, isHiringManager, isHrOfficer, isExecutive } = useRole();

  const items: NavItem[] = [];

  if (canViewDashboard) {
    items.push({ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard });
  }

  if (isAdmin || isExecutive || isHrOfficer) {
    items.push({ label: "Executive Brief", href: "/executive-dashboard", icon: ShieldCheck });
  }

  if (canViewDashboard) {
    items.push({ label: "Org Hierarchy", href: "/org-chart", icon: Building2 });
  }

  items.push({ label: "Job Vacancies", href: "/jobs", icon: Briefcase });

  if (isApplicant) {
    items.push({ label: "My Applications", href: "/my-applications", icon: FileText });
    items.push({ label: "My Account", href: "/account", icon: UserCog });
  } else if (isAdmin || isHrOfficer || isHiringManager) {
    items.push({ label: "My Account", href: "/account", icon: UserCog });
  }

  if (canManageJobs) {
    items.push({ label: "Applications", href: "/applications", icon: FileText });
  }

  if (isHiringManager || canManageJobs) {
    items.push({ label: "Shortlisted", href: "/shortlisted", icon: StarIcon });
  }

  if (canViewCandidates) {
    items.push({ label: "Candidates", href: "/candidates", icon: Users });
  }

  if (isAdmin || isHrOfficer) {
    items.push({ label: "Recruitment Workflow", href: "/workflow", icon: GitBranch });
  }

  if (canManageEmployees) {
    items.push({ label: "Employees", href: "/employees", icon: UserCheck });
    items.push({ label: "Onboarding", href: "/onboarding", icon: UserPlus });
    items.push({ label: "Contracts", href: "/contracts", icon: ScrollText });
    items.push({ label: "Offboarding", href: "/offboarding", icon: UserMinus });
  }

  // Employee Self-Service & Operations (for all internal staff)
  if (!isApplicant) {
    items.push({ label: "Leave & Absence", href: "/leave", icon: Calendar });
    items.push({ label: "Attendance Clock", href: "/attendance", icon: Timer });
    items.push({ label: "Document Vault", href: "/documents", icon: FolderLock });
    items.push({ label: "HR Letters", href: "/hr-letters", icon: FileBadge });
    items.push({ label: "Performance & OKRs", href: "/performance", icon: Target });
    items.push({ label: "Training & Certs", href: "/training", icon: GraduationCap });
    items.push({ label: "Staff Benefits", href: "/benefits", icon: HeartHandshake });
    items.push({ label: "Housing Scheme", href: "/housing", icon: Home });
  }

  if (canManageAgencies || isHrOfficer) {
    items.push({ label: "Departments", href: "/departments", icon: FolderKanban });
  }

  if (isAdmin || isHrOfficer || isExecutive) {
    items.push({ label: "Standard Reports", href: "/reports", icon: BarChart3 });
  }

  if (isAdmin) {
    items.push({ label: "User Management", href: "/users", icon: Settings });
    items.push({ label: "Integration Builder", href: "/integrations", icon: Puzzle });
  }

  if (isAdmin || isHrOfficer || isHiringManager) {
    items.push({ label: "Pipeline SLA", href: "/settings/pipeline-sla", icon: Clock });
  }

  return items;
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      data-testid="button-theme-toggle"
      className="p-2 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function LiveWelcome({ email }: { email: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const firstName = email.split("@")[0].split(/[._-]/)[0];
  const name = firstName ? `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}` : "there";
  return (
    <div className="hidden lg:block text-right leading-tight" data-testid="live-welcome">
      <p className="text-sm font-medium text-foreground">Welcome, {name}</p>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {now.toLocaleDateString("en-PG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        {" · "}{now.toLocaleTimeString("en-PG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
    </div>
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [location] = useLocation();
  const active = location === item.href || location.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <span
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </span>
    </Link>
  );
}

function groupNavItems(items: NavItem[]): NavGroup[] {
  const definitions: Array<[string, string[]]> = [
    ["Overview", ["/dashboard", "/executive-dashboard", "/org-chart"]],
    ["Recruitment", ["/jobs", "/applications", "/shortlisted", "/candidates", "/workflow"]],
    ["People management", ["/employees", "/onboarding", "/contracts", "/offboarding"]],
    ["Employee services", ["/leave", "/attendance", "/documents", "/hr-letters", "/performance", "/training", "/benefits", "/housing"]],
    ["Administration", ["/departments", "/reports", "/users", "/integrations", "/settings/pipeline-sla"]],
    ["My profile", ["/account", "/my-applications"]],
  ];
  return definitions.map(([label, hrefs]) => ({ label, items: items.filter((item) => hrefs.includes(item.href)) })).filter((group) => group.items.length > 0);
}

function NavSection({ group, collapsed, open, onToggle }: { group: NavGroup; collapsed: boolean; open: boolean; onToggle: () => void }) {
  const [location] = useLocation();
  const hasActiveItem = group.items.some((item) => location === item.href || location.startsWith(`${item.href}/`));
  if (collapsed) return <>{group.items.map((item) => <NavLink key={item.href} item={item} collapsed />)}</>;
  return (
    <div className="mb-1">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45 hover:text-sidebar-foreground/80" aria-expanded={open}>
        <span>{group.label}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {(open || hasActiveItem) && <div className="space-y-0.5">{group.items.map((item) => <NavLink key={item.href} item={item} collapsed={false} />)}</div>}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ Overview: true, Recruitment: true, "People management": true, "Employee services": false, Administration: false, "My profile": true });
  const { user, logout, role } = useAuth();
  const navItems = useNavItems();
  const navGroups = groupNavItems(navItems);

  const roleLabel: Record<string, string> = {
    admin: "System Admin",
    hr_officer: "HR Officer",
    hiring_manager: "Hiring Manager",
    executive: "Executive",
    applicant: "Applicant",
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={cn(
      "flex flex-col bg-sidebar border-r border-sidebar-border h-full",
      mobile ? "w-64" : collapsed ? "w-16" : "w-64",
      "transition-all duration-200"
    )}>
      <div className={cn(
        "flex items-center h-14 px-4 border-b border-sidebar-border shrink-0",
        collapsed && !mobile ? "justify-center" : "justify-between"
      )}>
        {(!collapsed || mobile) && (
          <Link href="/">
            <div className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity cursor-pointer">
              <img src="/nisit-logo.png" alt="PNG NISIT" className="w-7 h-7 object-contain rounded shrink-0" />
              <div className="min-w-0">
                <span className="text-sidebar-foreground font-bold text-sm tracking-tight">PNG NISIT</span>
                <span className="block text-sidebar-primary text-xs font-medium">HR Portal</span>
              </div>
            </div>
          </Link>
        )}
        {collapsed && !mobile && (
          <Link href="/">
            <img src="/nisit-logo.png" alt="PNG NISIT" className="w-7 h-7 object-contain rounded hover:opacity-80 transition-opacity" />
          </Link>
        )}
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            data-testid="button-sidebar-toggle"
            className="p-1 rounded text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/50">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navGroups.map((group) => (
          <NavSection key={group.label} group={group} collapsed={collapsed && !mobile} open={openSections[group.label] ?? false} onToggle={() => setOpenSections((current) => ({ ...current, [group.label]: !current[group.label] }))} />
        ))}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-1 shrink-0">
        {(!collapsed || mobile) && user && (
          <Link href="/account">
            <div className="px-3 py-2 rounded-md cursor-pointer hover:bg-sidebar-accent transition-colors" data-testid="button-sidebar-profile" title="View my profile">
              <p className="text-sidebar-foreground text-sm font-medium truncate">{roleLabel[user.role] ?? user.role}</p>
              <p className="text-sidebar-foreground/50 text-xs truncate">{user.email} · ID: {user.userId}</p>
            </div>
          </Link>
        )}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {(!collapsed || mobile) && (
            <button
              onClick={logout}
              data-testid="button-logout"
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}
          {collapsed && !mobile && (
            <button
              onClick={logout}
              className="p-2 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-foreground"
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="font-bold text-sm flex-1">PNG NISIT HR Portal</Link>
          <NotificationBell />
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex h-14 border-b border-border items-center px-6 gap-4 bg-card shrink-0 justify-end">
          {user && <LiveWelcome email={user.email} />}
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
