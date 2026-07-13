const User = require("../models/User");
const Connection = require("../models/Connection");
const Message = require("../models/Message");
const { signToken } = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../utils/mailer");
const presence = require("../socket/presence");

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !USERNAME_REGEX.test(username.trim())) {
      return res.status(400).json({
        success: false,
        error: "Username must be 3-20 characters and contain only letters, numbers, and underscores",
      });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }
    if (email && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, error: "That email address doesn't look valid" });
    }

    const existing = await User.findByUsername(username);
    if (existing) {
      return res.status(409).json({ success: false, error: "Username is already taken" });
    }

    const user = await User.create({ username, password, email });
    const token = signToken(user);

    return res.status(201).json({ success: true, data: { token, user: User.toPublic(user) } });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password are required" });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }

    const valid = await User.verifyPassword(user, password);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }

    const token = signToken(user);
    return res.status(200).json({ success: true, data: { token, user: User.toPublic(user) } });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me  (requires auth middleware)
const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    return res.status(200).json({ success: true, data: User.toPublic(user) });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password  { username }
// SECURITY: always responds with the exact same generic message, no matter
// what happened server-side (account doesn't exist, account has no email,
// email sent successfully, or email sending failed). The reset link/token
// is NEVER returned in the API response — only ever delivered by email, or
// (if no email is on file / SMTP isn't configured) logged server-side where
// only someone with access to the server's logs can see it. Returning it in
// the response would let anyone reset any account just by knowing/guessing
// a username, which defeats the entire point of a reset flow.
const forgotPassword = async (req, res, next) => {
  const genericMessage = "If that account exists, a password reset link has been sent.";

  try {
    const { username } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({ success: false, error: "username is required" });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(200).json({ success: true, data: { message: genericMessage } });
    }

    const rawToken = await User.createResetToken(user);
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

    if (user.email) {
      try {
        await sendPasswordResetEmail({ to: user.email, username: user.username, resetUrl });
      } catch (emailErr) {
        // Don't let an email-provider failure change the response (that
        // would leak account existence) or crash the request — just log it
        // so whoever runs the server can see delivery is broken.
        console.error(`[auth] failed to send password reset email to ${user.username}:`, emailErr.message);
      }
    } else {
      console.log(`[auth] no email on file for ${user.username} — reset link (server-side only): ${resetUrl}`);
    }

    return res.status(200).json({ success: true, data: { message: genericMessage } });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password  { token, newPassword }
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ success: false, error: "Reset token is required" });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const user = await User.findByValidResetToken(token);
    if (!user) {
      return res.status(400).json({ success: false, error: "This reset link is invalid or has expired" });
    }

    await User.resetPassword(user, newPassword);
    return res.status(200).json({ success: true, data: { message: "Password updated. You can now log in." } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/auth/me  (requires auth middleware)
// Deletes the account and cascades: their connections and every message
// they sent or received are deleted too. This is the ONLY path that ever
// deletes chat history — messages otherwise persist indefinitely.
const deleteAccount = async (req, res, next) => {
  try {
    const username = req.user.username;
    const { accepted } = await Connection.listForUser(username);

    await Promise.all([
      Connection.deleteAllForUser(username),
      Message.deleteAllForUser(username),
      User.deleteAccount(username),
    ]);

    // Let anyone who was connected to this account know in real time, and
    // disconnect this account's own live sockets so the (now-orphaned) JWT
    // can't keep driving an active session.
    accepted.forEach((peer) => presence.emitToUser(peer, "connection:removed", { username }));
    presence.disconnectUser(username);

    return res.status(200).json({ success: true, data: { message: "Account deleted" } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me, forgotPassword, resetPassword, deleteAccount };
