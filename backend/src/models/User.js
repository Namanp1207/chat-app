const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { mongoose } = require("../config/db");

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  // Lowercased mirror of `username`, used for case-insensitive uniqueness
  // and lookups (so "Alice" and "alice" are treated as the same account).
  usernameLower: { type: String, required: true, unique: true, index: true },
  // Optional — only needed if you want real "forgot password" emails
  // delivered. Without it (or without SMTP configured), the reset link is
  // shown directly in the UI / logged server-side instead of emailed.
  email: { type: String, default: null, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  // Password-reset support: a hash of the reset token (never the raw token
  // itself) plus its expiry. Nulled out again once used or expired.
  resetPasswordTokenHash: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

const UserModel = mongoose.model("User", userSchema);

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    delete ret.resetPasswordTokenHash;
    delete ret.resetPasswordExpires;
    return ret;
  },
});

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

class User {
  static async findByUsername(username) {
    if (!username) return null;
    return UserModel.findOne({ usernameLower: username.trim().toLowerCase() });
  }

  static async findById(id) {
    try {
      return await UserModel.findById(id);
    } catch (err) {
      // Malformed ObjectId (e.g. a stale/garbage id) — treat as "not found"
      return null;
    }
  }

  static async create({ username, password, email = null }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({
      username: username.trim(),
      usernameLower: username.trim().toLowerCase(),
      email: email ? email.trim().toLowerCase() : null,
      passwordHash,
    });
    return user;
  }

  static async verifyPassword(user, password) {
    return bcrypt.compare(password, user.passwordHash);
  }

  // Generates a password-reset token, stores only its hash + a 15-minute
  // expiry on the user, and returns the *raw* token (only ever exposed once,
  // to the reset email/response — never persisted or logged in full).
  static async createResetToken(user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = hashToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();
    return rawToken;
  }

  static async findByValidResetToken(rawToken) {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);
    return UserModel.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });
  }

  static async resetPassword(user, newPassword) {
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();
  }

  static async deleteAccount(username) {
    await UserModel.deleteOne({ usernameLower: username.trim().toLowerCase() });
  }

  static async findAll() {
    return UserModel.find({});
  }

  // Strips sensitive fields before sending a user object back to a client
  static toPublic(user) {
    return { id: user.id, username: user.username, email: user.email || null, createdAt: user.createdAt };
  }
}

module.exports = User;
