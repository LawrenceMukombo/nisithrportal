import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

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
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? `"PNG NISIT HR Portal" <no-reply@nisit.gov.pg>`,
      to,
      subject,
      text,
      html,
    });
  } else {
    console.log(`[Email] Password reset requested for ${to}`);
    console.log(`[Email] Reset URL: ${resetUrl}`);
    console.log(`[Email] (Configure SMTP_HOST, SMTP_USER, SMTP_PASS to send real emails)`);
  }
}
