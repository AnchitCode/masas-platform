import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import env from '../config/env.js';
import logger from './logger.js';

// ─── Provider Interface ──────────────────────────────────────────
// Swap implementation without changing auth logic (Resend, SES, SendGrid, etc.)

interface EmailProvider {
  sendMail(options: { to: string; subject: string; html: string }): Promise<void>;
}

// ─── Nodemailer Provider ─────────────────────────────────────────

function createNodemailerProvider(): EmailProvider {
  const transporter: Transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return {
    async sendMail({ to, subject, html }) {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        html,
      });
    },
  };
}

// ─── Singleton Provider ──────────────────────────────────────────

let emailProvider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (!emailProvider) {
    emailProvider = createNodemailerProvider();
  }
  return emailProvider;
}

// ─── HTML Email Templates (MASAS green branding) ─────────────────

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">MASAS</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Medicine Availability &amp; Shortage Alert System</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                This email was sent by MASAS. If you didn't request this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonHtml(text: string, url: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Send a verification email with a CTA button to verify the email address.
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string,
): Promise<void> {
  const displayName = name || to.split('@')[0];

  const html = baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Verify your email address</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${displayName},
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Thanks for creating an account with MASAS. Please click the button below to verify your email address and activate your account.
    </p>
    ${buttonHtml('Verify Email Address', verifyUrl)}
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5;">
      If the button doesn't work, copy and paste this link in your browser:
    </p>
    <p style="margin:0;font-size:13px;color:#16a34a;word-break:break-all;">
      <a href="${verifyUrl}" style="color:#16a34a;">${verifyUrl}</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      This link will expire in 24 hours.
    </p>
  `);

  try {
    await getProvider().sendMail({
      to,
      subject: 'Verify your email address — MASAS',
      html,
    });
    logger.info('Verification email sent', { to });
  } catch (error) {
    logger.error('Failed to send verification email', { to, error: String(error) });
    throw error;
  }
}

/**
 * Send a password reset email with a CTA button to reset the password.
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string,
): Promise<void> {
  const displayName = name || to.split('@')[0];

  const html = baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Reset your password</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${displayName},
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      We received a request to reset the password for your MASAS account. Click the button below to create a new password.
    </p>
    ${buttonHtml('Reset Password', resetUrl)}
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5;">
      If the button doesn't work, copy and paste this link in your browser:
    </p>
    <p style="margin:0;font-size:13px;color:#16a34a;word-break:break-all;">
      <a href="${resetUrl}" style="color:#16a34a;">${resetUrl}</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
  `);

  try {
    await getProvider().sendMail({
      to,
      subject: 'Reset your password — MASAS',
      html,
    });
    logger.info('Password reset email sent', { to });
  } catch (error) {
    logger.error('Failed to send password reset email', { to, error: String(error) });
    throw error;
  }
}

/**
 * Send an email notifying a user that their pharmacy was verified.
 */
export async function sendPharmacyVerifiedEmail(
  to: string,
  pharmacyName: string,
  dashboardUrl: string,
): Promise<void> {
  const html = baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Pharmacy Verified! 🎉</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Great news! Your pharmacy <strong>${pharmacyName}</strong> has been successfully verified by our administrators.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      You can now log in and start managing your inventory on MASAS.
    </p>
    ${buttonHtml('Go to Dashboard', dashboardUrl)}
  `);

  try {
    await getProvider().sendMail({
      to,
      subject: 'Pharmacy Verified — MASAS',
      html,
    });
    logger.info('Pharmacy verified email sent', { to });
  } catch (error) {
    logger.error('Failed to send pharmacy verified email', { to, error: String(error) });
    throw error;
  }
}

/**
 * Send an email notifying a user that their pharmacy was rejected.
 */
export async function sendPharmacyRejectedEmail(
  to: string,
  pharmacyName: string,
  reason: string | null,
  dashboardUrl: string,
): Promise<void> {
  const reasonText = reason ? `<p style="margin:0 0 16px;font-size:15px;color:#ef4444;line-height:1.6;padding:12px;background:#fef2f2;border-radius:6px;"><strong>Reason for rejection:</strong> ${reason}</p>` : '';

  const html = baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Pharmacy Application Update</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Unfortunately, we were unable to approve your application for the pharmacy <strong>${pharmacyName}</strong> at this time.
    </p>
    ${reasonText}
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Please log in to your dashboard to review your application, update any incorrect details, and resubmit for approval.
    </p>
    ${buttonHtml('Review Application', dashboardUrl)}
  `);

  try {
    await getProvider().sendMail({
      to,
      subject: 'Pharmacy Application Update — MASAS',
      html,
    });
    logger.info('Pharmacy rejected email sent', { to });
  } catch (error) {
    logger.error('Failed to send pharmacy rejected email', { to, error: String(error) });
    throw error;
  }
}

/**
 * Send an email notifying a customer that a medicine they're watching is now available.
 */
export async function sendMedicineAvailableEmail(
  to: string,
  userName: string | null,
  medicineName: string,
  pharmacyName: string,
  quantity: number,
  distanceKm: string,
  searchUrl: string,
): Promise<void> {
  const displayName = userName || to.split('@')[0];

  const html = baseTemplate(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Medicine Now Available! 💊</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${displayName},
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Great news! <strong>${medicineName}</strong> is now available at <strong>${pharmacyName}</strong>, approximately ${distanceKm} km from your saved location.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Current stock: <strong>${quantity} units</strong>
    </p>
    ${buttonHtml('View Availability', searchUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
      You're receiving this because you have an active saved search for this medicine on MASAS.
    </p>
  `);

  try {
    await getProvider().sendMail({
      to,
      subject: `${medicineName} is now available — MASAS`,
      html,
    });
    logger.info('Medicine available email sent', { to, medicineName });
  } catch (error) {
    logger.error('Failed to send medicine available email', { to, medicineName, error: String(error) });
    throw error;
  }
}
