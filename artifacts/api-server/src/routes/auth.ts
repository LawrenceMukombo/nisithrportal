import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, asc } from "drizzle-orm";
import { db, usersTable, agenciesTable, rolesTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { authMiddleware, generateToken } from "../middlewares/auth";
import { isStaffDomain } from "../lib/emailDomain";

const router: IRouter = Router();

router.post("/auth/register", (_req, res): void => {
  res.status(404).json({ error: "Not found" });
});

router.post("/auth/applicant-register", async (req, res): Promise<void> => {
  const schema = RegisterBody.pick({ name: true, email: true, password: true });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  if (isStaffDomain(email)) {
    res.status(400).json({
      error: "Government email addresses cannot be used for applicant self-registration. Please use a personal email address.",
    });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const [agency] = await db.select().from(agenciesTable).orderBy(asc(agenciesTable.id)).limit(1);
  if (!agency) {
    res.status(500).json({ error: "System not initialised — no agency found" });
    return;
  }

  const applicantRoles = await db.select().from(rolesTable).where(eq(rolesTable.name, "applicant"));
  if (applicantRoles.length === 0) {
    res.status(500).json({ error: "System not initialised — applicant role not found" });
    return;
  }
  const roleId = applicantRoles[0].id;

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    agencyId: agency.id,
    roleId,
    status: "active",
  }).returning();

  res.status(201).json({
    message: "Account created. Please sign in.",
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
