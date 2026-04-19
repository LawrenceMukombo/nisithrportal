import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { eq, and, gt, or, lt, isNull } from "drizzle-orm";
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

  // #77 Link any candidate records submitted before account creation
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
    closingSoonDays: user.closingSoonDays,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/auth/me/preferences", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const [user] = await db
    .select({ emailSavedJobClosing: usersTable.emailSavedJobClosing })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ emailSavedJobClosing: user.emailSavedJobClosing });
});

router.patch("/auth/me/preferences", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const schema = z.object({
    emailSavedJobClosing: z.boolean().optional(),
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
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No preferences provided" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.userId))
    .returning({ emailSavedJobClosing: usersTable.emailSavedJobClosing });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  logger.info({ userId: req.user!.userId, updates }, "auth/me/preferences: applicant preferences updated");
  res.json({ emailSavedJobClosing: updated.emailSavedJobClosing });
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

      const baseUrl =
        process.env.APP_BASE_URL ??
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
      if (!baseUrl) {
        logger.error("[ResetRequest] APP_BASE_URL is not configured — cannot construct a trusted reset link. Set APP_BASE_URL in environment secrets to the frontend origin (e.g. https://your-app.replit.app).");
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
    .select({ id: usersTable.id, roleId: usersTable.roleId })
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

  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  await db.update(passwordResetTokensTable).set({ used: true }).where(eq(passwordResetTokensTable.id, record.id));

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
  const baseUrl =
    process.env.APP_BASE_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
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
