import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard, Briefcase, Users, FileText, UserCheck,
  ScrollText, Building2, FolderKanban, Settings, LogOut,
  ChevronRight, Menu, X, Moon, Sun, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useRole } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function useNavItems() {
  const { canViewCandidates, canManageJobs, canManageEmployees, canManageContracts, canManageAgencies, canViewDashboard } = useRole();

  const items: NavItem[] = [];

  if (canViewDashboard) {
    items.push({ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard });
  }

  items.push({ label: "Job Vacancies", href: "/jobs", icon: Briefcase });

  if (canManageJobs) {
    items.push({ label: "Applications", href: "/applications", icon: FileText });
  }

  if (canViewCandidates) {
    items.push({ label: "Candidates", href: "/candidates", icon: Users });
  }

  if (canManageEmployees) {
    items.push({ label: "Employees", href: "/employees", icon: UserCheck });
  }

  if (canManageContracts) {
    items.push({ label: "Contracts", href: "/contracts", icon: ScrollText });
  }

  if (canManageAgencies) {
    items.push({ label: "Agencies", href: "/agencies", icon: Building2 });
    items.push({ label: "Departments", href: "/departments", icon: FolderKanban });
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, role } = useAuth();
  const navItems = useNavItems();

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
          <div>
            <span className="text-sidebar-foreground font-bold text-sm tracking-tight">PNG NISIT</span>
            <span className="block text-sidebar-primary text-xs font-medium">HR Portal</span>
          </div>
        )}
        {collapsed && !mobile && <Shield className="h-5 w-5 text-sidebar-primary" />}
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
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed && !mobile} />
        ))}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-1 shrink-0">
        {(!collapsed || mobile) && user && (
          <div className="px-3 py-2">
            <p className="text-sidebar-foreground text-sm font-medium truncate">
              {roleLabel[user.role] ?? user.role}
            </p>
            <p className="text-sidebar-foreground/50 text-xs">ID: {user.userId}</p>
          </div>
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
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-foreground"
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm">PNG NISIT HR Portal</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
