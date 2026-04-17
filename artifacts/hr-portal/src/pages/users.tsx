import { useState } from "react";
import { useGetUsers, useGetRoles, useUpdateUser, useCreateUser } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Users, Search, Edit, UserPlus } from "lucide-react";
import type { UserWithRole, Role } from "@workspace/api-client-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "System Admin",
  hr_officer: "HR Officer",
  hiring_manager: "Hiring Manager",
  executive: "Executive",
  applicant: "Applicant",
};

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

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !roleId) {
      toast({ title: "All fields required", variant: "destructive" });
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
      setName(""); setEmail(""); setPassword(""); setRoleId("");
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({ title: "Creation failed", description: msg ?? "Please try again.", variant: "destructive" });
    }
  };

  const staffRoles = roles.filter((r) => r.name !== "applicant");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Staff User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Full Name</p>
            <Input
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-create-user-name"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Email</p>
            <Input
              type="email"
              placeholder="jane@agency.gov.pg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-create-user-email"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Temporary Password</p>
            <Input
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-create-user-password"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Role</p>
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
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createUser.isPending}
              data-testid="button-confirm-create-user"
            >
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  open,
  onClose,
}: {
  user: UserWithRole;
  roles: Role[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [roleId, setRoleId] = useState(user.roleId?.toString() ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(user.status === "active" ? "active" : "inactive");

  const updateUser = useUpdateUser();

  const handleSave = async () => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: {
          roleId: roleId ? parseInt(roleId) : undefined,
          status,
        },
      });
      toast({ title: "User updated", description: `${user.name} has been updated.` });
      onClose();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const isSelf = me?.userId === user.id;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit User: {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{user.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Role</p>
            <Select value={roleId} onValueChange={setRoleId} disabled={isSelf}>
              <SelectTrigger data-testid="select-role">
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
            {isSelf && <p className="text-xs text-muted-foreground">You cannot change your own role.</p>}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Status</p>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")} disabled={isSelf}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive (Deactivated)</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && <p className="text-xs text-muted-foreground">You cannot deactivate your own account.</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateUser.isPending || isSelf}>
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: users = [], isLoading: loadingUsers, refetch } = useGetUsers();
  const { data: roles = [], isLoading: loadingRoles } = useGetRoles();

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="heading-users">User Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? "s" : ""}</p>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              data-testid="button-create-user"
            >
              <UserPlus className="h-4 w-4 mr-1" /> Invite Staff
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-users"
          />
        </div>

        {loadingUsers || loadingRoles ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.id} data-testid="row-user">
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {user.roleName ? (ROLE_LABELS[user.roleName] ?? user.roleName) : "No role"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "destructive"}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditUser(user)}
                          data-testid="button-edit-user"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateUserDialog
        roles={roles}
        open={showCreate}
        onClose={() => { setShowCreate(false); refetch(); }}
      />

      {editUser && (
        <EditUserDialog
          user={editUser}
          roles={roles}
          open={!!editUser}
          onClose={() => {
            setEditUser(null);
            refetch();
          }}
        />
      )}
    </AppLayout>
  );
}
