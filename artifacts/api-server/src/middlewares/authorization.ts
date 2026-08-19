import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, permissionsTable, rolePermissionsTable, rolesTable } from "@workspace/db";

export type DataScope = "own" | "department" | "organisation";

function legacyGrantAllows(grants: unknown, resource: string, action: string): boolean {
  if (!grants || typeof grants !== "object") return false;
  const map = grants as Record<string, unknown>;
  if (map.all === true || map[resource] === true) return true;
  const value = map[resource];
  return Array.isArray(value) && (value.includes(action) || value.includes("write") || (action === "read" && value.includes("view")));
}

/** Returns grants for the current role. Admin remains a deliberate break-glass role. */
export async function getGrantedScopes(req: Request, resource: string, action: string): Promise<DataScope[]> {
  if (!req.user?.roleId) return [];
  if (req.user.roleName === "admin") return ["organisation"];

  const grants = await db
    .select({ scope: rolePermissionsTable.scope })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(and(eq(rolePermissionsTable.roleId, req.user.roleId), eq(permissionsTable.resource, resource), eq(permissionsTable.action, action)));
  if (grants.length) return grants.map((grant) => grant.scope as DataScope);

  // Existing deployments use roles.permissions JSON. Keep it as a migration
  // bridge rather than silently removing established administrator grants.
  const [role] = await db.select({ permissions: rolesTable.permissions }).from(rolesTable).where(eq(rolesTable.id, req.user.roleId));
  return legacyGrantAllows(role?.permissions, resource, action) ? ["organisation"] : [];
}

export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const scopes = await getGrantedScopes(req, resource, action);
    if (!scopes.length) {
      res.status(403).json({ error: `Forbidden: requires ${resource}.${action}` });
      return;
    }
    next();
  };
}
