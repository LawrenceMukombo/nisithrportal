import { useState, useMemo, useEffect, useCallback } from "react";
import { useGetUsers, useGetRoles, useUpdateUser, useCreateUser, useGetAgencies } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Users, Search, UserPlus, AlertTriangle, Shield, Key, User, Check, X } from "lucide-react";
import type { UserWithRole, Role } from "@workspace/api-client-react";
import { isStaffDomain, STAFF_ROLES } from "@/lib/emailDomain";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getToken } from "@/lib/api-config";

const ROLE_LABELS: Record<string, string> = {
  admin: "System Admin",
  hr_officer: "HR Officer",
  hiring_manager: "Hiring Manager",
  executive: "Executive",
  applicant: "Applicant",
};

const RESOURCES = [
  { key: "jobs", label: "Job Postings" },
  { key: "applications", label: "Applications" },
  { key: "candidates", label: "Candidates" },
  { key: "employees", label: "Employees" },
  { key: "contracts", label: "Contracts" },
  { key: "dashboard", label: "Dashboard / Analytics" },
  { key: "users", label: "User Management" },
] as const;

const ACTIONS = [
  { key: "create", label: "Create" },
  { key: "read", label: "View" },
  { key: "update", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "review", label: "Review" },
] as const;

type PermMap = Record<string, boolean | string[]>;

function hasPermission(permissions: PermMap | null, resource: string, action: string): boolean {
  if (!permissions) return false;
  if ((permissions as { all?: boolean }).all) return true;
  if (resource === "users" && (permissions as { all?: boolean }).all) return true;
  const perm = permissions[resource];
  if (perm === true) return true;
  if (Array.isArray(perm)) return perm.includes(action);
  return false;
}

type UserRow = UserWithRole & { agencyName?: string | null };

type FullUser = UserRow & {
  permissions: PermMap | null;
  updatedAt?: string | null;
};

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function PermissionsMatrix({ permissions, roleName }: { permissions: PermMap | null; roleName: string | null }) {
  const isAdmin = !!(permissions as { all?: boolean } | null)?.all;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Permissions are determined by the assigned role.
        {roleName && <span className="font-medium text-foreground"> Current role: {ROLE_LABELS[roleName] ?? roleName}</span>}
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">Resource</th>
              {ACTIONS.map((a) => (
                <th key={a.key} className="text-center px-2 py-2 font-medium text-muted-foreground">{a.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((r, i) => {
              const anyAccess = ACTIONS.some((a) => hasPermission(permissions, r.key, a.key));
              return (
                <tr key={r.key} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"} ${!anyAccess ? "opacity-40" : ""}`}>
                  <td className="px-3 py-2 font-medium">{r.label}</td>
                  {ACTIONS.map((a) => {
                    const allowed = hasPermission(permissions, r.key, a.key);
                    return (
                      <td key={a.key} className="text-center px-2 py-2">
                        {allowed
                          ? <Check className="h-4 w-4 text-green-600 mx-auto" />
                          : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {isAdmin && (
              <tr className="border-t bg-amber-50">
                <td colSpan={6} className="px-3 py-2 text-xs text-amber-700 font-medium">
                  System Admin has unrestricted access to all resources and actions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserDetailSheet({
  userId,
  open,
  onClose,
  roles,
  agencies,
  onSaved,
}: {
  userId: number | null;
  open: boolean;
  onClose: () => void;
  roles: Role[];
  agencies: { id: number; name: string }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const updateUser = useUpdateUser();

  const [user, setUser] = useState<FullUser | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const selectedRole = useMemo(() => roles.find((r) => r.id.toString() === roleId), [roles, roleId]);
  const livePermissions = useMemo(() => {
    if (!selectedRole) return user?.permissions ?? null;
    const fromRoles = roles.find((r) => r.id.toString() === roleId);
    return (fromRoles as { permissions?: PermMap } | undefined)?.permissions ?? null;
  }, [selectedRole, roles, roleId, user]);

  const isSelf = me?.userId === userId;

  const fetchUser = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const data: FullUser = await apiFetch(`/users/${id}`);
      setUser(data);
      setName(data.name ?? "");
      setEmail(data.email ?? "");
      setAgencyId(data.agencyId?.toString() ?? "");
      setRoleId(data.roleId?.toString() ?? "");
      setStatus(data.status === "active" ? "active" : "inactive");
      setNewPassword("");
    } catch {
      toast({ title: "Failed to load user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open && userId != null) fetchUser(userId);
  }, [open, userId, fetchUser]);

  const emailChanged = email !== (user?.email ?? "");
  const roleChanged = roleId !== (user?.roleId?.toString() ?? "");

  const domainError = useMemo(() => {
    if (!selectedRole || !email.trim()) return null;
    if (!emailChanged && !roleChanged) return null;
    if (STAFF_ROLES.has(selectedRole.name) && !isStaffDomain(email.trim()))
      return `Role "${ROLE_LABELS[selectedRole.name] ?? selectedRole.name}" requires a government domain email.`;
    if (selectedRole.name === "applicant" && isStaffDomain(email.trim()))
      return "Government domain emails cannot be assigned the applicant role.";
    return null;
  }, [selectedRole, email, emailChanged, roleChanged]);

  const handleSaveProfile = async () => {
    if (domainError) {
      toast({ title: "Invalid assignment", description: domainError, variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    try {
      const payload: Record<string, unknown> = {};
      if (name !== user?.name) payload.name = name;
      if (email !== user?.email) payload.email = email;
      if (roleId !== user?.roleId?.toString()) payload.roleId = parseInt(roleId);
      const newAgencyId = agencyId ? parseInt(agencyId) : null;
      if (newAgencyId !== (user?.agencyId ?? null)) payload.agencyId = newAgencyId;
      if (status !== user?.status) payload.status = status;

      if (Object.keys(payload).length === 0) {
        toast({ title: "No changes to save" });
        return;
      }

      await apiFetch(`/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "User updated successfully" });
      onSaved();
      if (userId != null) fetchUser(userId);
    } catch (err: unknown) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch(`/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      toast({ title: "Password reset successfully" });
      setNewPassword("");
    } catch (err: unknown) {
      toast({ title: "Failed to reset password", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const agencyOptions = useMemo(() => [
    { value: "", label: "— No agency —" },
    ...agencies.map((a) => ({ value: a.id.toString(), label: a.name })),
  ], [agencies]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[560px] sm:max-w-none overflow-y-auto p-0">
        {loading || !user ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                  {initials(user.name ?? "?")}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-bold truncate">{user.name}</SheetTitle>
                  <SheetDescription className="text-sm truncate">{user.email}</SheetDescription>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={user.status === "active" ? "default" : "destructive"} className="text-xs">
                      {user.status}
                    </Badge>
                    {user.roleName && (
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[user.roleName] ?? user.roleName}
                      </Badge>
                    )}
                    {user.agencyName && (
                      <span className="text-xs text-muted-foreground truncate">{user.agencyName}</span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="profile" className="px-6 pt-4">
              <TabsList className="mb-4">
                <TabsTrigger value="profile"><User className="h-3.5 w-3.5 mr-1.5" />Profile</TabsTrigger>
                <TabsTrigger value="security"><Key className="h-3.5 w-3.5 mr-1.5" />Security</TabsTrigger>
                <TabsTrigger value="permissions"><Shield className="h-3.5 w-3.5 mr-1.5" />Permissions</TabsTrigger>
              </TabsList>

              {/* ── PROFILE TAB ─────────────────────────────────── */}
              <TabsContent value="profile" className="space-y-4 pb-6">
                {isSelf && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    You are editing your own account. Role changes are disabled.
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@example.com" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Agency</label>
                  <SearchableSelect
                    value={agencyId}
                    onValueChange={setAgencyId}
                    options={agencyOptions}
                    placeholder="— No agency —"
                    searchPlaceholder="Search agencies…"
                    triggerClassName="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={roleId} onValueChange={setRoleId} disabled={isSelf}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>
                          {ROLE_LABELS[r.name] ?? r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {domainError && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" />{domainError}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Account Status</label>
                  <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")} disabled={isSelf}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive (Deactivated)</SelectItem>
                    </SelectContent>
                  </Select>
                  {isSelf && <p className="text-xs text-muted-foreground">You cannot deactivate your own account.</p>}
                </div>

                <Separator />

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>ID: #{user.id}</span>
                  <span>·</span>
                  <span>Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
                  {user.updatedAt && <><span>·</span><span>Last updated: {new Date(user.updatedAt).toLocaleDateString()}</span></>}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || !!domainError}
                    className="flex-1"
                  >
                    {savingProfile ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </TabsContent>

              {/* ── SECURITY TAB ────────────────────────────────── */}
              <TabsContent value="security" className="space-y-4 pb-6">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Reset Password</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set a new password for this account. The user will need to use the new password on their next login.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">New Password</label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                      />
                      {newPassword.length > 0 && newPassword.length < 8 && (
                        <p className="text-xs text-destructive">Password must be at least 8 characters.</p>
                      )}
                    </div>
                    <Button
                      onClick={handleResetPassword}
                      disabled={savingPassword || newPassword.length < 8}
                      variant="destructive"
                      className="w-full"
                    >
                      {savingPassword ? "Resetting…" : "Reset Password"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ── PERMISSIONS TAB ─────────────────────────────── */}
              <TabsContent value="permissions" className="pb-6">
                <PermissionsMatrix
                  permissions={livePermissions as PermMap | null}
                  roleName={selectedRole?.name ?? user.roleName ?? null}
                />
                <p className="text-xs text-muted-foreground mt-4">
                  To change permissions, update the user's Role in the Profile tab. Each role grants a fixed set of access rights across the system.
                </p>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CreateUserDialog({
  roles,
  open,
  onClose,
}: {
  roles: Role[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");

  const createUser = useCreateUser();

  const selectedRole = useMemo(() => roles.find((r) => r.id.toString() === roleId), [roles, roleId]);
  const isStaffRole = selectedRole ? STAFF_ROLES.has(selectedRole.name) : false;
  const emailIsStaff = email.trim() ? isStaffDomain(email.trim()) : null;
  const domainError = useMemo(() => {
    if (!email.trim() || !selectedRole) return null;
    if (isStaffRole && emailIsStaff === false)
      return `Staff roles require a government domain email (e.g. @dept.gov.pg).`;
    if (!isStaffRole && emailIsStaff === true)
      return "Government domain emails cannot be assigned non-staff roles.";
    return null;
  }, [email, selectedRole, isStaffRole, emailIsStaff]);

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !roleId) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (domainError) {
      toast({ title: "Invalid email domain", description: domainError, variant: "destructive" });
      return;
    }
    try {
      await createUser.mutateAsync({
        data: {
          name: name.trim(),
          email: email.trim(),
          password,
          roleId: parseInt(roleId),
        },
      });
      toast({ title: "User created", description: `${name} has been added.` });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({ title: "Failed to create user", description: msg ?? "Please try again.", variant: "destructive" });
    }
  };

  const staffRoles = roles.filter((r) => r.name !== "applicant");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Full Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" data-testid="input-create-user-name" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.gov.pg" data-testid="input-create-user-email" />
            {isStaffRole && email.trim() && !domainError && (
              <p className="text-xs text-green-700">Government domain email confirmed for staff role.</p>
            )}
            {domainError && <p className="text-xs text-destructive">{domainError}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" data-testid="input-create-user-password" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger data-testid="select-create-user-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {staffRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    {ROLE_LABELS[r.name] ?? r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending || !!domainError} className="flex-1">
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: rawUsers = [], isLoading: loadingUsers, refetch } = useGetUsers();
  const users = rawUsers as UserRow[];
  const { data: roles = [], isLoading: loadingRoles } = useGetRoles();
  const { data: agenciesRaw = [] } = useGetAgencies();
  const agencies = agenciesRaw as { id: number; name: string }[];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.agencyName ?? "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || u.roleName === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="heading-users">User Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-user">
              <UserPlus className="h-4 w-4 mr-1" /> Invite Staff
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, email or agency..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-users"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-filter-role">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || roleFilter !== "all") && (
            <Button size="sm" variant="ghost" className="h-9 text-sm" onClick={() => { setSearch(""); setRoleFilter("all"); }}>
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        {loadingUsers || loadingRoles ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: "name",
                label: "Name",
                sortable: true,
                csvValue: (u) => u.name ?? "",
                renderCell: (u) => <span className="font-medium">{u.name}</span>,
              },
              {
                key: "email",
                label: "Email",
                sortable: true,
                csvValue: (u) => u.email ?? "",
                renderCell: (u) => <span className="text-muted-foreground text-sm">{u.email}</span>,
              },
              {
                key: "agency",
                label: "Agency",
                sortable: true,
                csvValue: (u) => (u as UserRow).agencyName ?? "",
                renderCell: (u) => (
                  <span className="text-sm text-muted-foreground" title={(u as UserRow).agencyName ?? "—"}>
                    {(u as UserRow).agencyName ?? "—"}
                  </span>
                ),
              },
              {
                key: "role",
                label: "Role",
                sortable: true,
                csvValue: (u) => u.roleName ? (ROLE_LABELS[u.roleName] ?? u.roleName) : "No role",
                renderCell: (u) => (
                  <Badge variant="outline" className="text-xs">
                    {u.roleName ? (ROLE_LABELS[u.roleName] ?? u.roleName) : "No role"}
                  </Badge>
                ),
              },
              {
                key: "status",
                label: "Status",
                sortable: true,
                csvValue: (u) => u.status ?? "",
                renderCell: (u) => (
                  <Badge variant={u.status === "active" ? "default" : "destructive"} className="text-xs">
                    {u.status}
                  </Badge>
                ),
              },
              {
                key: "joined",
                label: "Joined",
                sortable: true,
                csvValue: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
                renderCell: (u) => (
                  <span className="text-sm text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </span>
                ),
              },
            ] as DataTableColumn<UserRow>[]}
            data={filtered}
            getRowId={(u) => u.id}
            emptyMessage="No users found."
            onRowClick={(u) => setSelectedUserId(u.id)}
            data-testid="table-users"
          />
        )}
      </div>

      <UserDetailSheet
        userId={selectedUserId}
        open={selectedUserId != null}
        onClose={() => setSelectedUserId(null)}
        roles={roles}
        agencies={agencies}
        onSaved={() => refetch()}
      />

      <CreateUserDialog
        roles={roles}
        open={showCreate}
        onClose={() => { setShowCreate(false); refetch(); }}
      />
    </AppLayout>
  );
}
