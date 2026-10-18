import nodemailer from "nodemailer";
import { logger } from "./logger";
import { signUnsubscribeToken } from "./unsubscribeToken";

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

export async function sendOfferLetterEmail(to: string, candidateName: string, positionTitle: string, pdfBuffer: Buffer, applicationId: number): Promise<void> {
  const subject = `PNG NISIT HR Portal — Letter of Offer: ${positionTitle}`;
  const text = `Dear ${candidateName},\n\nPlease find attached your Letter of Offer for the position of ${positionTitle}.\n\nPlease review the attached document and return a signed copy within 7 working days.\n\nFor queries, contact the Human Resources Division.\n\nRegards,\nPNG NISIT HR Division`;
  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:auto">
      <div style="background:#003082;padding:18px 24px">
        <h2 style="color:#fff;margin:0;font-size:18px">Government of Papua New Guinea</h2>
        <p style="color:#f0c040;margin:4px 0 0;font-size:13px">National Institute of Standards & Industrial Technology (NISIT)</p>
      </div>
      <div style="padding:24px">
        <p>Dear <strong>${candidateName}</strong>,</p>
        <p>We are pleased to enclose your <strong>Letter of Offer</strong> for the position of <strong>${positionTitle}</strong>.</p>
        <p>Please review the attached PDF document carefully and return a signed copy within <strong>7 working days</strong>.</p>
        <p>Should you have any queries, please contact the Human Resources Division directly.</p>
        <p style="margin-top:32px">Warm regards,<br/><strong>HR Division</strong><br/>PNG NISIT</p>
      </div>
      <hr style="border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:11px;padding:12px 24px">Application reference #${applicationId}</p>
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
        attachments: [
          {
            filename: `offer-letter-${applicationId}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      logger.info({ to, applicationId }, "sendOfferLetterEmail: offer letter sent successfully");
    } catch (err) {
      logger.error({ err, to, applicationId }, "sendOfferLetterEmail: failed to send offer letter email");
      throw err;
    }
  } else {
    logger.warn({ to, applicationId }, "sendOfferLetterEmail: SMTP not configured — offer letter email not sent");
    if (!IS_PRODUCTION) {
      logger.info(`[dev] Would send offer letter for application #${applicationId} to ${to}`);
    }
  }
}

export async function sendSavedJobClosingEmail(to: string, candidateName: string, jobTitle: string, jobId: number, daysLeft: number, closingDate: string, userId: number): Promise<void> {
  const closingPhrase = daysLeft <= 0
    ? "closes today"
    : daysLeft === 1
      ? "closes tomorrow"
      : `closes in ${daysLeft} days`;
  const subject = `PNG NISIT HR Portal — Saved job ${closingPhrase}: ${jobTitle}`;
  const baseUrl = process.env.APP_BASE_URL ?? "";
  const unsubToken = signUnsubscribeToken(userId, "saved-job-closing");
  const unsubscribeUrl = `${baseUrl}/api/auth/unsubscribe/saved-job-closing?token=${unsubToken}`;
  const text = `Dear ${candidateName},\n\nA job you saved, "${jobTitle}", ${closingPhrase} (${closingDate}). If you intend to apply, please submit your application before the closing date.\n\nView the vacancy: ${baseUrl}/jobs/${jobId}\n\nRegards,\nPNG NISIT HR Division\n\n—\nUnsubscribe from these alerts: ${unsubscribeUrl}`;
  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:auto">
      <div style="background:#003082;padding:18px 24px">
        <h2 style="color:#fff;margin:0;font-size:18px">PNG NISIT HR Portal</h2>
        <p style="color:#f0c040;margin:4px 0 0;font-size:13px">Saved job closing soon</p>
      </div>
      <div style="padding:24px">
        <p>Dear <strong>${candidateName}</strong>,</p>
        <p>A vacancy you saved, <strong>${jobTitle}</strong>, <strong>${closingPhrase}</strong> (${closingDate}).</p>
        <p>If you still intend to apply, please submit your application before the closing date.</p>
        <p style="margin:24px 0">
          <a href="${baseUrl}/jobs/${jobId}" style="background:#003082;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
            View vacancy
          </a>
        </p>
        <p style="color:#666;font-size:13px">You're receiving this because you saved this job in your applicant account.</p>
      </div>
      <hr style="border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:11px;padding:12px 24px;text-align:center">
        <a href="${unsubscribeUrl}" style="color:#666;text-decoration:underline">Unsubscribe from these alerts</a>
      </p>
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
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      logger.info({ to, jobId, daysLeft }, "sendSavedJobClosingEmail: closing-soon email sent");
    } catch (err) {
      logger.error({ err, to, jobId }, "sendSavedJobClosingEmail: failed to send closing-soon email");
    }
  } else {
    logger.warn({ to, jobId, daysLeft }, "sendSavedJobClosingEmail: SMTP not configured — closing-soon email not sent");
    if (!IS_PRODUCTION) {
      logger.info(`[dev] Would send closing-soon email for job #${jobId} to ${to} (${closingPhrase})`);
    }
  }
}

export async function sendStaleApplicationEmail(
  to: string,
  recipientName: string,
  applicationId: number,
  jobTitle: string,
  status: string,
  daysInStatus: number,
  thresholdDays: number,
  unsubscribeUrl?: string,
): Promise<void> {
  const subject = `PNG NISIT HR Portal — Stalled application #${applicationId} needs review`;
  const appUrl = `${process.env.APP_BASE_URL ?? ""}/applications/${applicationId}`;
  const dayWord = daysInStatus === 1 ? "day" : "days";
  const unsubLineText = unsubscribeUrl
    ? `\n\nDon't want these emails? Unsubscribe (in-app alerts will still appear): ${unsubscribeUrl}`
    : "";
  const text = `Hello ${recipientName},\n\nApplication #${applicationId} for "${jobTitle}" has been in the "${status}" stage for ${daysInStatus} ${dayWord} (threshold: ${thresholdDays} days).\n\nPlease review and move it forward.\n\nView application: ${appUrl}${unsubLineText}\n\nRegards,\nPNG NISIT HR Portal`;
  const unsubHtml = unsubscribeUrl
    ? `<p style="color:#666;font-size:12px;margin-top:16px">Don't want these emails? <a href="${unsubscribeUrl}" style="color:#003082">Unsubscribe with one click</a>. You'll still see in-app alerts in the portal.</p>`
    : "";
  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:auto">
      <div style="background:#003082;padding:18px 24px">
        <h2 style="color:#fff;margin:0;font-size:18px">PNG NISIT HR Portal</h2>
        <p style="color:#f0c040;margin:4px 0 0;font-size:13px">Stalled application alert</p>
      </div>
      <div style="padding:24px">
        <p>Hello <strong>${recipientName}</strong>,</p>
        <p>Application <strong>#${applicationId}</strong> for <strong>${jobTitle}</strong> has been in the <strong>${status}</strong> stage for <strong>${daysInStatus} ${dayWord}</strong> (threshold: ${thresholdDays} days).</p>
        <p>Please review and move it forward so the candidate isn't kept waiting.</p>
        <p style="margin:24px 0">
          <a href="${appUrl}" style="background:#003082;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
            Review application
          </a>
        </p>
        <p style="color:#666;font-size:13px">You're receiving this because you are listed as the hiring manager or HR officer for this application.</p>
        ${unsubHtml}
      </div>
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
      logger.info({ to, applicationId, status, daysInStatus }, "sendStaleApplicationEmail: stalled-application email sent");
    } catch (err) {
      logger.error({ err, to, applicationId }, "sendStaleApplicationEmail: failed to send stalled-application email");
    }
  } else {
    logger.warn({ to, applicationId }, "sendStaleApplicationEmail: SMTP not configured — stalled-application email not sent");
    if (!IS_PRODUCTION) {
      logger.info(`[dev] Would send stalled-application email for #${applicationId} to ${to} (${daysInStatus}d in ${status})`);
    }
  }
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

export interface SendPayslipEmailParams {
  to: string;
  employeeName: string;
  periodName: string;
  periodCode: string;
  payDate: string;
  netPay: string;
  currency: string;
  passwordHint: string;
  pdfBuffer: Buffer;
  payslipNumber: string;
}

export async function sendPasswordProtectedPayslipEmail(params: SendPayslipEmailParams): Promise<{ delivered: boolean; mode: "smtp" | "simulated" }> {
  const { to, employeeName, periodName, periodCode, payDate, netPay, currency, passwordHint, pdfBuffer, payslipNumber } = params;

  const subject = `PNG NISIT Remuneration Advice: ${periodName} (${periodCode}) — ${employeeName}`;
  const filename = `NISIT-Payslip-${periodCode}-${payslipNumber}.pdf`;

  const text = `Dear ${employeeName},\n\nYour official remuneration advice / payslip for ${periodName} (Pay Date: ${payDate}) is attached.\n\nNet Take-Home Pay: ${currency} ${netPay}\n\nIMPORTANT SECURITY NOTICE:\nFor your privacy and statutory compliance, the attached PDF is encrypted.\nPassword Requirement: ${passwordHint}\n\nIf you have questions regarding your remuneration or deductions, please contact the NISIT Human Resources & Finance Division at hr@nisit.gov.pg.\n\nRegards,\nHuman Resources Directorate\nPNG National Institute of Standards & Industrial Technology (NISIT)`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
      <div style="background: #003082; padding: 24px; text-align: left;">
        <h3 style="color: #ffffff; margin: 0; font-size: 15px; letter-spacing: 0.5px; text-transform: uppercase;">Independent State of Papua New Guinea</h3>
        <h2 style="color: #f0c040; margin: 6px 0 0 0; font-size: 18px; font-weight: 700;">PNG National Institute of Standards & Technology</h2>
        <p style="color: #cbd5e1; margin: 4px 0 0 0; font-size: 12px;">Human Resources & Remuneration Directorate • Confidential Salary Advice</p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 15px; color: #1e293b; margin-top: 0;">Dear <strong>${employeeName}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.5;">
          Please find attached your official, confidential remuneration advice for <strong>${periodName}</strong> (Pay Date: <strong>${payDate}</strong>).
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
          <span style="font-size: 12px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Net Disbursed Take-Home Pay</span>
          <div style="font-size: 26px; font-weight: 800; color: #15803d; margin: 6px 0 2px 0;">${currency} ${netPay}</div>
          <span style="font-size: 12px; color: #15803d;">Credited to your registered bank account via electronic credit</span>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <strong style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">🔐 Password Protection Notice</strong>
          <p style="font-size: 13px; color: #78350f; margin: 6px 0 8px 0; line-height: 1.4;">
            For your personal privacy and statutory compliance under PNG regulations, this PDF document is encrypted with standard security.
          </p>
          <div style="background: #ffffff; border: 1px dashed #f59e0b; border-radius: 4px; padding: 10px 14px; font-size: 13px; color: #b45309; font-weight: 600;">
            🔑 Password Requirement: <span style="color: #78350f;">${passwordHint}</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          You can open the attached file using Adobe Acrobat Reader, Google Chrome, Safari, Apple Books, or any standard PDF viewing application on desktop or mobile by entering the required password above.
        </p>

        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
          For inquiries regarding salary computations, tax deductions, or superannuation contributions, please contact the <strong>NISIT Payroll Division</strong> at <a href="mailto:payroll@nisit.gov.pg" style="color: #003082;">payroll@nisit.gov.pg</a>.
        </p>

        <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 13px; color: #334155; margin: 0;"><strong>Human Resources Directorate</strong></p>
          <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">PNG National Institute of Standards and Industrial Technology (NISIT)</p>
          <p style="font-size: 11px; color: #94a3b8; margin: 2px 0 0 0;">Corner of Spring Garden Rd & Godwit Rd, Gordon, Port Moresby, NCD, Papua New Guinea</p>
        </div>
      </div>

      <div style="background: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
        Confidential Document #${payslipNumber} • Transmitted to registered private address ${to}
      </div>
    </div>
  `;

  const transport = createTransport();

  if (transport) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? `"PNG NISIT Payroll Office" <payroll@nisit.gov.pg>`,
        to,
        subject,
        text,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      logger.info({ to, payslipNumber, periodCode }, "sendPasswordProtectedPayslipEmail: encrypted payslip email dispatched successfully via SMTP");
      return { delivered: true, mode: "smtp" };
    } catch (err) {
      logger.error({ err, to, payslipNumber }, "sendPasswordProtectedPayslipEmail: failed to send payslip email via SMTP");
      throw err;
    }
  } else {
    logger.info({ to, payslipNumber, periodCode }, "sendPasswordProtectedPayslipEmail: SMTP not configured — encrypted payslip prepared and logged (simulation mode)");
    if (!IS_PRODUCTION) {
      logger.info(`[dev] Successfully prepared password-protected payslip ${filename} for ${employeeName} sent to private email ${to}`);
    }
    return { delivered: true, mode: "simulated" };
  }
}

