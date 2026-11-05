import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter = null;

export function getMailTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });

  return transporter;
}

export async function sendOtpEmail(options) {
  let toEmail = options;
  let otpCode = '';
  let userName = 'Team Member';
  let expiresMinutes = 5;

  if (typeof options === 'object' && options !== null) {
    toEmail = options.toEmail;
    otpCode = options.otpCode;
    userName = options.userName || userName;
    expiresMinutes = options.expiresMinutes || expiresMinutes;
  } else if (arguments.length > 1) {
    otpCode = arguments[1];
  }

  const mailer = getMailTransporter();
  const from = process.env.SMTP_FROM || `"Nexxoory PM" <${process.env.SMTP_USER || 'no-reply@nexxoory.com'}>`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F4F7FB; margin: 0; padding: 24px; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 24px; }
          .title { font-size: 20px; font-weight: 700; color: #0B192C; margin-top: 12px; margin-bottom: 4px; }
          .subtitle { font-size: 13px; color: #536B82; }
          .otp-box { background: #F8FAFC; border: 2px dashed #635BFF; border-radius: 12px; text-align: center; padding: 18px; margin: 24px 0; }
          .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #635BFF; font-family: monospace; }
          .warning { font-size: 11px; color: #EF4444; margin-top: 8px; font-weight: 600; }
          .footer { font-size: 11px; color: #94A3B8; text-align: center; margin-top: 24px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2 class="title">Password Reset Verification</h2>
            <p class="subtitle">Use the verification code below to reset your Nexxoory account password.</p>
          </div>
          <div class="otp-box">
            <p>Hello ${userName},</p>
            <div class="otp-code">${otpCode}</div>
            <p>This code expires in ${expiresMinutes} minutes.</p>
            <div class="warning">Valid for 5 minutes only. Do not share this code.</div>
          </div>
          <p style="font-size: 12px; color: #536B82; line-height: 1.6;">
            If you did not request a password reset, please ignore this email or reach out to your administrator immediately.
          </p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Nexxoory Project Management Solutions. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  if (!mailer) {
    console.error(`[SMTP ERROR] No SMTP transporter configured. Check SMTP_HOST/USER/PASSWORD in .env.`);
    throw new Error('SMTP configuration missing or invalid');
  }

  try {
    const info = await mailer.sendMail({
      from,
      to: toEmail,
      subject: `Your Password Reset OTP: ${otpCode} - Nexxoory`,
      text: `Hello ${userName}. Your password reset code is ${otpCode}. Valid for ${expiresMinutes} minutes. Do not share this code.`,
      html
    });
    console.log('[SMTP SUCCESS] OTP email accepted', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[SMTP SEND ERROR]', err.name, err.code);
    throw err;
  }
}

