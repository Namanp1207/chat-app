const nodemailer = require("nodemailer");

// Password-reset emails are optional infrastructure: if SMTP isn't
// configured, we don't want registration/login/the rest of the app to be
// blocked on it. When SMTP_HOST etc. aren't set, the reset link is only
// ever logged server-side (never returned over the API — see
// authController.forgotPassword for why that matters).
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
// Default the From address to the authenticated SMTP user: several
// providers (Gmail included) silently reject or spam-flag mail whose From
// doesn't match (or isn't a verified alias of) the authenticated account.
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "no-reply@realtime-chat.local";

const isConfigured = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // 465 = implicit TLS; 587/25 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Nodemailer's defaults allow slow/bad connections to hang for a long
    // time before failing. Since forgotPassword awaits this call before
    // responding, a hung connection here means a hung "Sending..." button
    // on the frontend. These caps make a misconfigured/unreachable SMTP
    // server fail within ~10s instead — the request still succeeds from the
    // user's point of view (see the try/catch in authController), it just
    // won't have actually sent an email, and the reason will be logged.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  // Verify the connection at startup so misconfigured SMTP (wrong
  // host/port, or a regular Gmail password instead of an App Password,
  // etc.) shows up immediately in the server logs — not only when a user
  // happens to request a password reset.
  transporter.verify((err) => {
    if (err) {
      console.error(
        "[mailer] SMTP configured but verification failed — password reset emails will NOT be delivered:",
        err.message
      );
    } else {
      console.log(`[mailer] SMTP verified — password reset emails will be sent via ${SMTP_HOST} as ${SMTP_FROM}`);
    }
  });
} else {
  console.log(
    "[mailer] SMTP not configured (SMTP_HOST/PORT/USER/PASS) — password reset links will only be logged " +
      "server-side, not emailed. See backend/.env.example for setup."
  );
}

async function sendPasswordResetEmail({ to, username, resetUrl }) {
  if (!isConfigured) {
    console.log(`[mailer] SMTP not configured — reset link for ${username} (server-side only): ${resetUrl}`);
    return { sent: false };
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Reset your password",
    text: `Hi ${username},\n\nSomeone (hopefully you) requested a password reset. Click the link below within 15 minutes to choose a new password:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>Hi ${username},</p><p>Someone (hopefully you) requested a password reset. Click the link below within 15 minutes to choose a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
  console.log(`[mailer] password reset email sent to ${to}`);
  return { sent: true };
}

module.exports = { sendPasswordResetEmail, isConfigured };
