import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { eq, and, gt, or, lt, isNull, sql } from "drizzle-orm";
import { db, usersTable, agenciesTable, rolesTable, candidatesTable, passwordResetTokensTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { authMiddleware, generateToken, requireRole } from "../middlewares/auth";
import { isStaffDomain } from "../lib/emailDomain";
import { logger } from "../lib/logger";
import { sendPasswordResetEmail } from "../lib/email";
import { verifyUnsubscribeToken } from "../lib/unsubscribeToken";
import { writeAuditLog } from "../lib/audit";
import { createNotification } from "../lib/notificationService";
import { CLOSING_SOON_DAY_OPTIONS } from "./saved-jobs";

const router: IRouter = Router();

const resetRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password-reset requests — please try again in 15 minutes." },
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — please try again in 15 minutes." },
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts from this IP — please try again in an hour." },
});

router.post("/auth/register", (_req, res): void => {
  res.status(404).json({ error: "Not found" });
});

router.post("/auth/applicant-register", registerRateLimit, async (req, res): Promise<void> => {
  const schema = RegisterBody.pick({ name: true, email: true, password: true });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  if (isStaffDomain(email)) {
    await writeAuditLog({
      targetEmail: email,
      actionType: "domain_violation",
      outcome: "rejected",
      details: { reason: "gov_email_for_applicant_self_registration", context: "applicant_register" },
    });
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

  const NISIT_AGENCY_NAME = "PNG National Institute of Standards and Industrial Technology";
  const agencies = await db.select().from(agenciesTable).where(eq(agenciesTable.name, NISIT_AGENCY_NAME));
  const agency = agencies[0] ?? null;
  if (!agency) {
    res.status(500).json({ error: "System not initialised — NISIT agency not found" });
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

  // Link any previously submitted (anonymous) candidate records with the same email
  const linked = await db
    .update(candidatesTable)
    .set({ userId: user.id })
    .where(and(eq(candidatesTable.email, email), isNull(candidatesTable.userId)))
    .returning({ id: candidatesTable.id });

  if (linked.length > 0) {
    logger.info({ userId: user.id, candidateIds: linked.map((c) => c.id) }, "Linked existing candidate records to new user account");
  }

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

router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password } = parsed.data;

    const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
    if (users.length === 0) {
      await writeAuditLog({
        targetEmail: email,
        actionType: "login_failure",
        outcome: "rejected",
        details: { reason: "user_not_found" },
      });
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

  const user = users[0];

  // Check account status
  if (user.status === "inactive") {
    await writeAuditLog({
      performedById: user.id,
      performedByEmail: user.email,
      targetUserId: user.id,
      targetEmail: user.email,
      actionType: "login_failure",
      outcome: "rejected",
      details: { reason: "account_deactivated" },
      agencyId: user.agencyId,
    });
    res.status(403).json({ error: "Your account has been deactivated. Please contact your system administrator." });
    return;
  }

  // Check lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const minsLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    await writeAuditLog({
      performedById: user.id,
      performedByEmail: user.email,
      targetUserId: user.id,
      targetEmail: user.email,
      actionType: "login_failure",
      outcome: "rejected",
      details: { reason: "account_currently_locked", minutesRemaining: minsLeft },
      agencyId: user.agencyId,
    });
    res.status(423).json({ error: `Account temporarily locked due to consecutive failed attempts. Please try again in ${minsLeft} minute(s) or contact administrator.` });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    if (newAttempts >= 5) {
      const lockTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await db.update(usersTable).set({ failedLoginAttempts: newAttempts, lockedUntil: lockTime }).where(eq(usersTable.id, user.id));
      await writeAuditLog({
        performedById: user.id,
        performedByEmail: user.email,
        targetUserId: user.id,
        targetEmail: user.email,
        actionType: "account_locked",
        outcome: "rejected",
        details: { consecutiveFailures: newAttempts, lockDurationMinutes: 30 },
        agencyId: user.agencyId,
      });
      res.status(423).json({ error: "Account locked for 30 minutes due to 5 consecutive failed login attempts." });
      return;
    }

    await db.update(usersTable).set({ failedLoginAttempts: newAttempts }).where(eq(usersTable.id, user.id));
    await writeAuditLog({
      performedById: user.id,
      performedByEmail: user.email,
      targetUserId: user.id,
      targetEmail: user.email,
      actionType: "login_failure",
      outcome: "rejected",
      details: { attempts: newAttempts, remainingAttempts: 5 - newAttempts },
      agencyId: user.agencyId,
    });
    res.status(401).json({ error: `Invalid credentials. ${5 - newAttempts} attempt(s) remaining before account lockout.` });
    return;
  }

  // Reset lockout counters on success and record login
  await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await writeAuditLog({
    performedById: user.id,
    performedByEmail: user.email,
    targetUserId: user.id,
    targetEmail: user.email,
    actionType: "login_success",
    outcome: "success",
    agencyId: user.agencyId,
  });

  let roleName: string | null = null;
  if (user.roleId) {
    const roles = await db.select().from(rolesTable).where(eq(rolesTable.id, user.roleId));
    if (roles.length > 0) roleName = roles[0].name;
  }

  // Link candidate records for applicant
  if (roleName === "applicant") {
    const linked = await db
      .update(candidatesTable)
      .set({ userId: user.id })
      .where(and(eq(candidatesTable.email, user.email), isNull(candidatesTable.userId)))
      .returning({ id: candidatesTable.id });
    if (linked.length > 0) {
      logger.info({ userId: user.id, candidateIds: linked.map((c) => c.id) }, "Linked candidate records to user account at login");
    }
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    roleId: user.roleId ?? null,
    agencyId: user.agencyId ?? null,
    roleName,
    tokenVersion: user.tokenVersion,
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
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error(err, "Login internal error occurred");
    console.error("DETAILED LOGIN ERROR:", err);
    // Do not reveal database, provider or configuration details to a login
    // caller. Full diagnostics remain in structured server logs.
    res.status(500).json({ error: "Unable to sign in at this time. Please try again later." });
  }
});

router.post("/auth/logout", authMiddleware, async (req, res): Promise<void> => {
  if (req.user) {
    await writeAuditLog({
      performedById: req.user.userId,
      performedByEmail: req.user.email,
      targetUserId: req.user.userId,
      targetEmail: req.user.email,
      actionType: "logout",
      outcome: "success",
      agencyId: req.user.agencyId,
    });
  }
  res.json({ success: true, message: "Logged out successfully" });
});

// JWTs are otherwise stateless. Incrementing a per-user version invalidates
// every existing token immediately, including tokens on lost devices.
router.post("/auth/logout-all", authMiddleware, async (req, res): Promise<void> => {
  await db.update(usersTable)
    .set({ tokenVersion: sql`${usersTable.tokenVersion} + 1` })
    .where(eq(usersTable.id, req.user!.userId));
  await writeAuditLog({
    performedById: req.user!.userId,
    performedByEmail: req.user!.email,
    targetUserId: req.user!.userId,
    targetEmail: req.user!.email,
    actionType: "logout",
    outcome: "success",
    agencyId: req.user!.agencyId,
  });
  res.json({ success: true, message: "All sessions have been signed out" });
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const user = users[0];
  let roleName = req.user?.roleName ?? null;
  if (!roleName && user.roleId) {
    const [role] = await db.select({ name: rolesTable.name }).from(rolesTable).where(eq(rolesTable.id, user.roleId));
    roleName = role?.name ?? null;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName,
    agencyId: user.agencyId ?? req.user?.agencyId ?? 1,
    status: user.status,
    closingSoonDays: user.closingSoonDays,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/auth/me/preferences", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db
    .select({
      emailSavedJobClosing: usersTable.emailSavedJobClosing,
      emailStaleApplications: usersTable.emailStaleApplications,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    emailSavedJobClosing: user.emailSavedJobClosing,
    emailStaleApplications: user.emailStaleApplications,
  });
});

router.patch("/auth/me/preferences", authMiddleware, async (req, res): Promise<void> => {
  const schema = z.object({
    emailSavedJobClosing: z.boolean().optional(),
    emailStaleApplications: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.emailSavedJobClosing !== undefined) {
    updates.emailSavedJobClosing = parsed.data.emailSavedJobClosing;
  }
  if (parsed.data.emailStaleApplications !== undefined) {
    updates.emailStaleApplications = parsed.data.emailStaleApplications;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No preferences provided" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.userId))
    .returning({
      emailSavedJobClosing: usersTable.emailSavedJobClosing,
      emailStaleApplications: usersTable.emailStaleApplications,
    });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  logger.info({ userId: req.user!.userId, updates }, "auth/me/preferences: user preferences updated");
  res.json({
    emailSavedJobClosing: updated.emailSavedJobClosing,
    emailStaleApplications: updated.emailStaleApplications,
  });
});

// One-click unsubscribe link from stalled-application emails. Public (no auth)
// because email clients won't pass through Bearer tokens — link is signed with
// an HMAC token tied to the user id so it cannot be forged.
router.get("/auth/unsubscribe/stale-applications", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const userId = token ? verifyUnsubscribeToken(token, "stale_applications") : null;
  const renderPage = (title: string, message: string, ok: boolean) => {
    res
      .status(ok ? 200 : 400)
      .type("html")
      .send(`<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#f6f7f9;margin:0;padding:48px 16px;color:#222}
.card{max-width:480px;margin:auto;background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden}
.hdr{background:#003082;color:#fff;padding:18px 24px}.hdr h1{margin:0;font-size:18px}
.body{padding:24px}.body p{line-height:1.5}
.muted{color:#666;font-size:13px;margin-top:16px}
a{color:#003082}</style></head>
<body><div class="card"><div class="hdr"><h1>PNG NISIT HR Portal</h1></div>
<div class="body"><h2 style="margin-top:0">${title}</h2><p>${message}</p>
<p class="muted">You can re-enable these emails any time from <a href="${(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}/account">My Account &rarr; Email Notifications</a>.</p>
</div></div></body></html>`);
  };
  if (userId == null) {
    renderPage("Invalid unsubscribe link", "This unsubscribe link is invalid or has been tampered with. If you keep getting unwanted emails, please update your preferences from the portal.", false);
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ emailStaleApplications: false })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, email: usersTable.email });
  if (!updated) {
    renderPage("Account not found", "We couldn't find an account for this unsubscribe link.", false);
    return;
  }
  logger.info({ userId }, "auth/unsubscribe/stale-applications: user unsubscribed via email link");
  renderPage(
    "You're unsubscribed",
    `We've turned off stalled-application emails for <strong>${updated.email}</strong>. You'll still see these alerts in the portal's notifications panel.`,
    true,
  );
});

router.get("/auth/me/notification-preferences", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const [user] = await db
    .select({ closingSoonDays: usersTable.closingSoonDays })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    closingSoonDays: user.closingSoonDays,
    options: [...CLOSING_SOON_DAY_OPTIONS],
  });
});

router.patch("/auth/me/notification-preferences", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const schema = z.object({
    closingSoonDays: z.number().int().refine(
      (n) => (CLOSING_SOON_DAY_OPTIONS as readonly number[]).includes(n),
      { message: `closingSoonDays must be one of ${CLOSING_SOON_DAY_OPTIONS.join(", ")}` },
    ),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const { closingSoonDays } = parsed.data;
  await db
    .update(usersTable)
    .set({ closingSoonDays })
    .where(eq(usersTable.id, req.user!.userId));
  logger.info({ userId: req.user!.userId, closingSoonDays }, "auth/me/notification-preferences: updated");
  res.json({ closingSoonDays, options: [...CLOSING_SOON_DAY_OPTIONS] });
});

router.patch("/auth/me/email", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const schema = z.object({
    newEmail: z.string().email("Enter a valid email address"),
    currentPassword: z.string().min(1, "Current password is required"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const { newEmail, currentPassword } = parsed.data;

  if (isStaffDomain(newEmail)) {
    res.status(400).json({ error: "Government email addresses cannot be used for applicant accounts. Please use a personal email address." });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (users.length === 0) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const user = users[0];

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  const normalised = newEmail.toLowerCase().trim();
  if (normalised === user.email.toLowerCase()) {
    res.status(400).json({ error: "The new email address is the same as your current one." });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalised));
  if (existing.length > 0) {
    res.status(409).json({ error: "That email address is already in use." });
    return;
  }

  await db.update(usersTable).set({ email: normalised }).where(eq(usersTable.id, user.id));

  // Keep linked candidate records in sync
  await db.update(candidatesTable).set({ email: normalised }).where(eq(candidatesTable.userId, user.id));

  // Notify the user that their email was changed
  try {
    await createNotification({
      userId: user.id,
      type: "email_changed",
      message: `Your email address has been updated to ${normalised}.`,
    });
  } catch (err) {
    logger.warn({ err, userId: user.id }, "auth/me/email: failed to create email-change notification");
  }

  logger.info({ userId: user.id, newEmail: normalised }, "auth/me/email: applicant email updated");
  res.json({ message: "Email address updated successfully.", email: normalised });
});

router.post("/auth/reset-request", resetRateLimit, async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  const users = await db
    .select({ id: usersTable.id, roleId: usersTable.roleId })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (users.length > 0) {
    const user = users[0];

    const roles = await db.select({ name: rolesTable.name }).from(rolesTable).where(eq(rolesTable.id, user.roleId!));
    const roleName = roles[0]?.name ?? null;

    if (roleName === "applicant") {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const baseUrl = process.env.APP_BASE_URL ?? null;
      if (!baseUrl) {
        logger.error("[ResetRequest] APP_BASE_URL is not configured — cannot construct a trusted reset link. Set APP_BASE_URL to the frontend origin.");
        res.json({ message: "If that email belongs to an applicant account, a reset link has been sent." });
        return;
      }
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      await sendPasswordResetEmail(email, resetUrl);
    }
  }

  res.json({ message: "If that email belongs to an applicant account, a reset link has been sent." });
});

router.get("/auth/verify-reset-token", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).json({ valid: false, error: "No token provided." });
    return;
  }

  const now = new Date();
  const records = await db
    .select({ id: passwordResetTokensTable.id })
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        eq(passwordResetTokensTable.used, false),
        gt(passwordResetTokensTable.expiresAt, now),
      ),
    );

  if (records.length === 0) {
    res.status(400).json({ valid: false, error: "This reset link is invalid or has expired." });
    return;
  }

  res.json({ valid: true });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body ?? {};

  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "Reset token is required." });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const now = new Date();
  const records = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        eq(passwordResetTokensTable.used, false),
        gt(passwordResetTokensTable.expiresAt, now),
      ),
    );

  if (records.length === 0) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const record = records[0];

  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, roleId: usersTable.roleId })
    .from(usersTable)
    .where(eq(usersTable.id, record.userId));

  if (users.length === 0) {
    res.status(400).json({ error: "Account not found." });
    return;
  }

  const user = users[0];

  const roles = await db.select({ name: rolesTable.name }).from(rolesTable).where(eq(rolesTable.id, user.roleId!));
  const roleName = roles[0]?.name ?? null;

  if (roleName !== "applicant") {
    res.status(403).json({ error: "Password reset is only available for applicant accounts." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .update(usersTable)
    .set({
      passwordHash,
      lastPasswordChangeAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(usersTable.id, user.id));

  await db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, record.id));

  await writeAuditLog({
    targetUserId: user.id,
    targetEmail: user.email,
    actionType: "password_reset",
    outcome: "success",
    details: { context: "applicant_self_service_reset" },
  });

  // Notify the applicant that their password was reset
  try {
    await createNotification({
      userId: user.id,
      type: "password_changed",
      message: "Your password has been successfully reset. If you did not request this, contact support immediately.",
    });
  } catch (err) {
    logger.warn({ err, userId: user.id }, "auth/reset-password: failed to create password-reset notification");
  }

  res.json({ message: "Password updated successfully. You can now sign in." });
});

/**
 * One-click unsubscribe for "saved-job closing soon" emails.
 *
 * The link is delivered in the email footer with a signed token tied to the
 * applicant's user id. Clicking it flips `email_saved_job_closing` to false
 * and redirects the recipient to a confirmation page on the frontend.
 *
 * Also accepts POST (per RFC 8058) to support one-click unsubscribe headers.
 */
async function handleSavedJobClosingUnsubscribe(req: import("express").Request, res: import("express").Response): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL ?? "";
  const confirmUrl = (status: "ok" | "invalid") =>
    `${baseUrl}/unsubscribed?type=saved-job-closing&status=${status}`;

  const tokenSource =
    typeof req.query.token === "string" ? req.query.token :
    typeof (req.body as Record<string, unknown> | undefined)?.token === "string" ? (req.body as Record<string, string>).token :
    "";

  if (!tokenSource) {
    res.redirect(302, confirmUrl("invalid"));
    return;
  }

  const userId = verifyUnsubscribeToken(tokenSource, "saved-job-closing");
  if (userId === null) {
    logger.warn("auth/unsubscribe/saved-job-closing: invalid or expired token");
    res.redirect(302, confirmUrl("invalid"));
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ emailSavedJobClosing: false })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });

  if (!updated) {
    logger.warn({ userId }, "auth/unsubscribe/saved-job-closing: user not found");
    res.redirect(302, confirmUrl("invalid"));
    return;
  }

  logger.info({ userId }, "auth/unsubscribe/saved-job-closing: applicant unsubscribed via email link");
  res.redirect(302, confirmUrl("ok"));
}

router.get("/auth/unsubscribe/saved-job-closing", handleSavedJobClosingUnsubscribe);
router.post("/auth/unsubscribe/saved-job-closing", handleSavedJobClosingUnsubscribe);

export default router;

/**
 * Deletes stale password-reset tokens to keep the table lean:
 * - Any token whose `expires_at` is in the past (expired, used or not).
 * - Any token marked `used = true` that was created more than 24 hours ago.
 *
 * Run on startup and on a recurring interval (see index.ts).
 */
export async function cleanupExpiredResetTokens(): Promise<void> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await db
    .delete(passwordResetTokensTable)
    .where(
      or(
        lt(passwordResetTokensTable.expiresAt, now),
        and(
          eq(passwordResetTokensTable.used, true),
          lt(passwordResetTokensTable.createdAt, oneDayAgo),
        ),
      ),
    );

  logger.info("cleanupExpiredResetTokens: stale password-reset tokens purged");
}
