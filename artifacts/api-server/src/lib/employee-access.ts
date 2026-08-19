import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, employeesTable, usersTable } from "@workspace/db";
import { getTenantAgencyId } from "../middlewares/tenant";

const HR_ROLES = new Set(["admin", "hr_manager", "hr_officer"]);
const READ_ROLES = new Set(["admin", "hr_manager", "hr_officer", "hiring_manager", "executive"]);

export function hasHrAccess(req: Request): boolean { return HR_ROLES.has(req.user?.roleName ?? ""); }
export function hasSensitiveReadAccess(req: Request): boolean { return READ_ROLES.has(req.user?.roleName ?? ""); }

export async function currentEmployeeId(req: Request): Promise<number | null> {
  if (!req.user) return null;
  const [user] = await db.select({ employeeId: usersTable.employeeId, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.user.userId));
  if (!user) return null;
  if (user.employeeId) return user.employeeId;
  const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.email, user.email));
  return employee?.id ?? null;
}

export async function employeeBelongsToTenant(req: Request, employeeId: number): Promise<boolean> {
  const tenantId = getTenantAgencyId(req);
  const [employee] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, employeeId));
  return !!employee && (tenantId == null || employee.agencyId === tenantId);
}

export async function canReadEmployee(req: Request, employeeId: number): Promise<boolean> {
  if (!await employeeBelongsToTenant(req, employeeId)) return false;
  return hasSensitiveReadAccess(req) || (await currentEmployeeId(req)) === employeeId;
}

export async function canManageEmployee(req: Request, employeeId: number): Promise<boolean> {
  if (!await employeeBelongsToTenant(req, employeeId)) return false;
  if (hasHrAccess(req)) return true;
  if (req.user?.roleName !== "hiring_manager") return false;
  const managerEmployeeId = await currentEmployeeId(req);
  if (!managerEmployeeId) return false;
  const [employee] = await db.select({ supervisorId: employeesTable.supervisorId }).from(employeesTable).where(eq(employeesTable.id, employeeId));
  return employee?.supervisorId === managerEmployeeId;
}
