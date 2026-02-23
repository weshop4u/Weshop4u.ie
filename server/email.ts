import nodemailer from "nodemailer";

/**
 * Email notification utility for WeShop4U.
 * 
 * Requires these environment variables:
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
 * - SMTP_PORT: SMTP port (e.g., 587)
 * - SMTP_USER: SMTP username/email
 * - SMTP_PASS: SMTP password or app password
 * - ADMIN_EMAIL: Email address to receive notifications
 */

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log("[Email] SMTP not configured — skipping email notification");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendNewMessageNotification(message: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const transporter = getTransporter();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!transporter || !adminEmail) {
    console.log("[Email] Skipping notification — SMTP or ADMIN_EMAIL not configured");
    return;
  }

  try {
    await transporter.sendMail({
      from: `"WeShop4U" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `New Contact Message: ${message.subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0F172A, #1E293B); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #00E5FF; margin: 0; font-size: 20px;">📬 New Contact Message</h1>
            <p style="color: #94A3B8; margin: 4px 0 0 0; font-size: 13px;">WeShop4U Admin Notification</p>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 13px; width: 80px; vertical-align: top;">From:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-weight: 600;">${message.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 13px; vertical-align: top;">Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:${message.email}" style="color: #00E5FF; text-decoration: none; font-size: 14px;">${message.email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 13px; vertical-align: top;">Subject:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-weight: 600;">${message.subject}</td>
              </tr>
            </table>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
            <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message.message}</div>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
            <p style="color: #94A3B8; font-size: 12px; margin: 0;">
              Reply directly to <a href="mailto:${message.email}" style="color: #00E5FF;">${message.email}</a> or view in your admin dashboard.
            </p>
          </div>
        </div>
      `,
    });
    console.log(`[Email] Notification sent to ${adminEmail} for message from ${message.name}`);
  } catch (error) {
    console.error("[Email] Failed to send notification:", error);
    // Don't throw — email failure shouldn't block the contact form submission
  }
}
