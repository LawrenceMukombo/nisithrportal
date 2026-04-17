import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, agenciesTable, rolesTable } from "@workspace/db";
import { authMiddleware, generateToken } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, password, agencyName, agencyType, roleName } = req.body;

  if (!name || !email || !password || !agencyName) {
    res.status(400).json({ error: "name, email, password, and agencyName are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [agency] = await db.insert(agenciesTable).values({
    name: agencyName,
    type: agencyType ?? "government",
  }).returning();

  let roleId: number | null = null;
  if (roleName) {
    const existing = await db.select().from(rolesTable).where(eq(rolesTable.name, roleName));
    if (existing.length > 0) {
      roleId = existing[0].id;
    } else {
      const [role] = await db.insert(rolesTable).values({ name: roleName }).returning();
      roleId = role.id;
    }
  } else {
    const adminRoles = await db.select().from(rolesTable).where(eq(rolesTable.name, "admin"));
    if (adminRoles.length > 0) {
      roleId = adminRoles[0].id;
    } else {
      const [role] = await db.insert(rolesTable).values({ name: "admin" }).returning();
      roleId = role.id;
    }
  }

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    agencyId: agency.id,
    roleId,
    status: "active",
  }).returning();

  const token = generateToken({
    userId: user.id,
    email: user.email,
    roleId: user.roleId ?? null,
    agencyId: user.agencyId ?? null,
    roleName: roleName ?? "admin",
  });

  res.status(201).json({
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

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

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
