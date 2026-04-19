import nodemailer from "nodemailer";
import { logger } from "./logger";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  // Gmail App Passwords are displayed with spaces for readability but must be
  // submitted without them. Strip all whitespace to handle both forms.
  const pass = process.env.SMTP_PASS?.replace(/\s/g, "");

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return null;
}

export async function verifySMTPConnection(): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn("verifySMTPConnection: SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured — password-reset emails will not be sent. Set these environment secrets to enable email delivery.");
    return;
  }
  await transport.verify();
  logger.info({ host: process.env.SMTP_HOST }, "verifySMTPConnection: SMTP connection verified — password-reset emails are enabled");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "PNG NISIT HR Portal — Reset Your Password";
  const text = `You requested a password reset for your applicant account.\n\nClick the link below to set a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e3a5f">PNG NISIT HR Portal</h2>
      <p>You requested a password reset for your applicant account.</p>
      <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          Reset Password
        </a>
      </p>
      <p style="color:#666;font-size:13px">If you did not request this, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px"/>
      <p style="color:#999;font-size:12px">PNG National Institute of Standards and Industrial Technology</p>
    </div>
  `;

  const transport = createTransport();

  if (transport) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? `"PNG NISIT HR Portal" <no-reply@nisit.gov.pg>`,
        to,
        subject,
        text,
        html,
      });
      logger.info({ to }, "sendPasswordResetEmail: reset email sent successfully");
    } catch (err) {
      logger.error({ err, to }, "sendPasswordResetEmail: failed to send reset email via SMTP");
      throw err;
    }
  } else {
    logger.warn({ to }, "sendPasswordResetEmail: SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email delivery");
    if (!IS_PRODUCTION) {
      logger.info(`[dev] Reset URL for ${to}: ${resetUrl}`);
    }
  }
}
