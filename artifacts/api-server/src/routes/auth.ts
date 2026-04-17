import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, agenciesTable, rolesTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { authMiddleware, generateToken } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, agencyName, agencyType, roleName } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.transaction(async (tx) => {
    const [agency] = await tx.insert(agenciesTable).values({
      name: agencyName,
      type: agencyType ?? "government",
    }).returning();

    const targetRoleName = roleName ?? "admin";
    const existingRoles = await tx.select().from(rolesTable).where(eq(rolesTable.name, targetRoleName));
    let roleId: number;
    if (existingRoles.length > 0) {
      roleId = existingRoles[0].id;
    } else {
      const [role] = await tx.insert(rolesTable).values({ name: targetRoleName }).returning();
      roleId = role.id;
    }

    const [user] = await tx.insert(usersTable).values({
      name,
      email,
      passwordHash,
      agencyId: agency.id,
      roleId,
      status: "active",
    }).returning();

    return { user, targetRoleName };
  });

  const token = generateToken({
    userId: result.user.id,
    email: result.user.email,
    roleId: result.user.roleId ?? null,
    agencyId: result.user.agencyId ?? null,
    roleName: result.targetRoleName,
  });

  res.status(201).json({
    token,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      roleId: result.user.roleId,
      agencyId: result.user.agencyId,
      status: result.user.status,
      createdAt: result.user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (users.length === 0) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = users[0];
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  let roleName: string | null = null;
  if (user.roleId) {
    const roles = await db.select().from(rolesTable).where(eq(rolesTable.id, user.roleId));
    if (roles.length > 0) roleName = roles[0].name;
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    roleId: user.roleId ?? null,
    agencyId: user.agencyId ?? null,
    roleName,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      agencyId: user.agencyId,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const user = users[0];
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    agencyId: user.agencyId,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
