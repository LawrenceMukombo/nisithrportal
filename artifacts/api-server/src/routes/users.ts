import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, rolesTable } from "@workspace/db";
import { z } from "zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { isStaffDomain, STAFF_ROLES } from "../lib/emailDomain";

const router: IRouter = Router();

const CreateUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.number().int().positive(),
});

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  roleId: z.number().int().positive().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

router.post("/users", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  const body = CreateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const roles = await db.select().from(rolesTable).where(eq(rolesTable.id, body.data.roleId));
  const roleName = roles[0]?.name ?? null;

  if (roleName && STAFF_ROLES.has(roleName) && !isStaffDomain(body.data.email)) {
    res.status(400).json({
      error: `Staff role "${roleName}" requires a government email domain (e.g. @dept.gov.pg). Please use a valid government email address.`,
    });
    return;
  }
  if (roleName === "applicant" && isStaffDomain(body.data.email)) {
    res.status(400).json({
      error: "Government domain emails cannot be assigned the applicant role. Use a personal email address.",
    });
    return;
  }

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
    agencyId: agencyId ?? undefined,
    status: "active",
  }).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    roleId: usersTable.roleId,
    agencyId: usersTable.agencyId,
    status: usersTable.status,
    createdAt: usersTable.createdAt,
  });

  res.status(201).json({ ...user, roleName });
});

router.get("/users", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  const conditions = [];
  if (agencyId != null) {
    conditions.push(eq(usersTable.agencyId, agencyId));
  }

  const users = conditions.length > 0
    ? await db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        roleId: usersTable.roleId,
        agencyId: usersTable.agencyId,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
      }).from(usersTable).where(and(...conditions)).orderBy(usersTable.name)
    : await db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        roleId: usersTable.roleId,
        agencyId: usersTable.agencyId,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
      }).from(usersTable).orderBy(usersTable.name);

  const roles = await db.select().from(rolesTable);
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  const result = users.map((u) => ({
    ...u,
    roleName: u.roleId != null ? (roleMap[u.roleId] ?? null) : null,
  }));

  res.json(result);
});

router.get("/roles", authMiddleware, requireRole("admin"), async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.name);
  res.json(roles);
});

router.patch("/users/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
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

  const agencyId = getTenantAgencyId(req);
  if (!assertTenantAccess(res, existing.agencyId, agencyId)) return;

  const body = UpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (body.data.roleId != null) {
    const newRoles = await db.select().from(rolesTable).where(eq(rolesTable.id, body.data.roleId));
    const newRoleName = newRoles[0]?.name ?? null;
    if (newRoleName && STAFF_ROLES.has(newRoleName) && !isStaffDomain(existing.email)) {
      res.status(400).json({
        error: `Staff role "${newRoleName}" requires a government email domain. The user's email (${existing.email}) does not qualify. Update their email or choose a different role.`,
      });
      return;
    }
    if (newRoleName === "applicant" && isStaffDomain(existing.email)) {
      res.status(400).json({
        error: "Government domain emails cannot be assigned the applicant role.",
      });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.data.name != null) updates.name = body.data.name;
  if (body.data.roleId != null) updates.roleId = body.data.roleId;
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

  res.json(updated);
});

export default router;
