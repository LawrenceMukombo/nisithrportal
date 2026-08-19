import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, rolesTable, agenciesTable } from "@workspace/db";
import { z } from "zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";
import { logger } from "../lib/logger";
import { writeAuditLog } from "../lib/audit";
import { createNotification } from "../lib/notificationService";

const router: IRouter = Router();

const CreateUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.number().int().positive(),
  agencyId: z.number().int().positive().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  roleId: z.number().int().positive().optional(),
  agencyId: z.number().int().positive().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const ResetPasswordBody = z.object({
  password: z.string().min(8),
});

router.post("/users", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  // Administrators may create accounts in any configured agency and deliberately
  // override normal self-service email/role restrictions.
  const agencyId = req.body.agencyId ?? getTenantAgencyId(req);
  const body = CreateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const roles = await db.select().from(rolesTable).where(eq(rolesTable.id, body.data.roleId));
  const roleName = roles[0]?.name ?? null;
  if (!roleName) { res.status(400).json({ error: "Selected role does not exist" }); return; }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, body.data.email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);

  const [user] = await db.insert(usersTable).values({
    name: body.data.name,
    email: body.data.email,
    passwordHash,
    roleId: body.data.roleId,
    agencyId: body.data.agencyId ?? agencyId ?? undefined,
    status: body.data.status ?? "active",
  }).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    roleId: usersTable.roleId,
    agencyId: usersTable.agencyId,
    status: usersTable.status,
    createdAt: usersTable.createdAt,
  });

  await writeAuditLog({
    performedById: req.user?.userId ?? null,
    performedByEmail: req.user?.email ?? null,
    targetUserId: user.id,
    targetEmail: user.email,
    actionType: "user_create",
    outcome: "success",
    details: { roleName, agencyId: user.agencyId },
    agencyId: agencyId ?? null,
  });

  res.status(201).json({ ...user, roleName });
});

router.get("/users", authMiddleware, requireRole("admin"), async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: usersTable.roleId,
      agencyId: usersTable.agencyId,
      agencyName: agenciesTable.name,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(agenciesTable, eq(usersTable.agencyId, agenciesTable.id))
    .orderBy(usersTable.name);

  const roles = await db.select().from(rolesTable);
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  const result = users.map((u) => ({
    ...u,
    roleName: u.roleId != null ? (roleMap[u.roleId] ?? null) : null,
  }));

  res.json(result);
});

router.get("/users/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (id == null || isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: usersTable.roleId,
      agencyId: usersTable.agencyId,
      agencyName: agenciesTable.name,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .leftJoin(agenciesTable, eq(usersTable.agencyId, agenciesTable.id))
    .where(eq(usersTable.id, id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let roleName: string | null = null;
  let permissions: unknown = null;
  if (user.roleId != null) {
    const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, user.roleId));
    roleName = role?.name ?? null;
    permissions = role?.permissions ?? null;
  }

  res.json({ ...user, roleName, permissions });
});

router.get("/roles", authMiddleware, requireRole("admin"), async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.name);
  res.json(roles);
});

const UpdateRolePermissionsBody = z.object({
  permissions: z.record(z.string(), z.union([z.boolean(), z.array(z.string())])),
});

router.patch("/roles/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  const id = parseIntParam(req.params.id);
  if (id == null || isNaN(id)) {
    res.status(400).json({ error: "Invalid role id" });
    return;
  }

  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  if (existing.name === "admin") {
    res.status(400).json({ error: "The System Admin role permissions cannot be modified." });
    return;
  }

  const body = UpdateRolePermissionsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(rolesTable)
    .set({ permissions: body.data.permissions })
    .where(eq(rolesTable.id, id))
    .returning();

  logger.info(
    { roleId: id, roleName: existing.name, adminId: req.user?.userId },
    "AUDIT permissions-change: role permissions updated",
  );
  await writeAuditLog({
    performedById: req.user?.userId ?? null,
    performedByEmail: req.user?.email ?? null,
    actionType: "permissions_change",
    outcome: "success",
    details: {
      roleId: id,
      roleName: existing.name,
      oldPermissions: existing.permissions,
      newPermissions: body.data.permissions,
    },
    agencyId: agencyId ?? null,
  });

  res.json(updated);
});

router.patch("/users/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  const id = parseIntParam(req.params.id);
  if (id == null || isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = UpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const emailToCheck = body.data.email ?? existing.email;

  let newRoleName: string | null = null;
  if (body.data.roleId != null) {
    const newRoles = await db.select().from(rolesTable).where(eq(rolesTable.id, body.data.roleId));
    newRoleName = newRoles[0]?.name ?? null;
    if (!newRoleName) { res.status(400).json({ error: "Selected role does not exist" }); return; }
  }

  if (body.data.email != null && body.data.email !== existing.email) {
    const clash = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, body.data.email));
    if (clash.length > 0) {
      res.status(409).json({ error: "Email already in use by another account." });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.data.name != null) updates.name = body.data.name;
  if (body.data.email != null) updates.email = body.data.email;
  if (body.data.roleId != null) updates.roleId = body.data.roleId;
  if (body.data.agencyId !== undefined) updates.agencyId = body.data.agencyId;
  if (body.data.status != null) updates.status = body.data.status;

  const [updated] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: usersTable.roleId,
      agencyId: usersTable.agencyId,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    });

  if (body.data.name != null && body.data.name !== existing.name) {
    try {
      await createNotification({
        userId: id,
        type: "profile_updated",
        message: `Your account display name has been updated to "${body.data.name}" by an administrator.`,
      });
    } catch (err) {
      logger.warn({ err, targetUserId: id }, "users PATCH: failed to create name-change notification");
    }
  }

  if (body.data.roleId != null && body.data.roleId !== existing.roleId) {
    const oldRoles = await db.select({ name: rolesTable.name }).from(rolesTable).where(eq(rolesTable.id, existing.roleId!));
    const oldRoleName = oldRoles[0]?.name ?? null;
    logger.info({ targetUserId: id, email: existing.email, oldRoleName, newRoleName, adminId: req.user?.userId }, "AUDIT role-change: user role updated");
    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: id,
      targetEmail: existing.email,
      actionType: "role_change",
      outcome: "success",
      details: { oldRole: oldRoleName, newRole: newRoleName },
      agencyId: agencyId ?? null,
    });
    // Notify the affected user of the role change
    try {
      await createNotification({
        userId: id,
        type: "account_updated",
        message: `Your account role has been updated to "${newRoleName ?? "unknown"}".`,
      });
    } catch (err) {
      logger.warn({ err, targetUserId: id }, "users PATCH: failed to create role-change notification");
    }
  }
  if (body.data.status != null && body.data.status !== existing.status) {
    logger.info({ targetUserId: id, email: existing.email, oldStatus: existing.status, newStatus: body.data.status, adminId: req.user?.userId }, "AUDIT status-change: user status updated");
    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: id,
      targetEmail: existing.email,
      actionType: "status_change",
      outcome: "success",
      details: { oldStatus: existing.status, newStatus: body.data.status },
      agencyId: agencyId ?? null,
    });
    // Notify the affected user of the account status change
    try {
      const statusMsg = body.data.status === "inactive"
        ? "Your account has been deactivated by an administrator."
        : "Your account has been reactivated by an administrator.";
      await createNotification({ userId: id, type: "account_updated", message: statusMsg });
    } catch (err) {
      logger.warn({ err, targetUserId: id }, "users PATCH: failed to create status-change notification");
    }
  }
  if (body.data.email != null && body.data.email !== existing.email) {
    logger.info({ targetUserId: id, oldEmail: existing.email, newEmail: body.data.email, adminId: req.user?.userId }, "AUDIT email-change: admin updated user email");
    await writeAuditLog({
      performedById: req.user?.userId ?? null,
      performedByEmail: req.user?.email ?? null,
      targetUserId: id,
      targetEmail: body.data.email,
      actionType: "email_change",
      outcome: "success",
      details: { oldEmail: existing.email, newEmail: body.data.email },
      agencyId: agencyId ?? null,
    });
    // Notify the affected user of the email change
    try {
      await createNotification({
        userId: id,
        type: "email_changed",
        message: `Your account email address has been updated to ${body.data.email} by an administrator.`,
      });
    } catch (err) {
      logger.warn({ err, targetUserId: id }, "users PATCH: failed to create email-change notification");
    }
  }

  res.json(updated);
});

router.patch("/users/:id/password", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  const id = parseIntParam(req.params.id);
  if (id == null || isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = ResetPasswordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);
  await db.update(usersTable).set({
    passwordHash,
    lastPasswordChangeAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
  }).where(eq(usersTable.id, id));

  logger.info({ targetUserId: id, email: existing.email, adminId: req.user?.userId }, "AUDIT password-reset: admin reset user password");
  await writeAuditLog({
    performedById: req.user?.userId ?? null,
    performedByEmail: req.user?.email ?? null,
    targetUserId: id,
    targetEmail: existing.email,
    actionType: "password_reset",
    outcome: "success",
    agencyId: agencyId ?? null,
  });

  // Notify the affected user that their password was reset by an admin
  try {
    await createNotification({
      userId: id,
      type: "password_changed",
      message: "Your account password has been reset by an administrator. If you did not request this, contact support immediately.",
    });
  } catch (err) {
    logger.warn({ err, targetUserId: id }, "users PATCH password: failed to create password-reset notification");
  }

  res.json({ ok: true });
});

router.patch("/users/:id/unlock", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  const id = parseIntParam(req.params.id);
  if (id == null || isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(usersTable.id, id));

  await writeAuditLog({
    performedById: req.user?.userId ?? null,
    performedByEmail: req.user?.email ?? null,
    targetUserId: id,
    targetEmail: existing.email,
    actionType: "account_unlocked",
    outcome: "success",
    agencyId: agencyId ?? null,
  });

  res.json({ success: true, message: "User account unlocked successfully" });
});

export default router;
