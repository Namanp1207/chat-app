const { mongoose } = require("../config/db");

/**
 * Two users can only chat once a Connection between them has status
 * "accepted" - this is what makes conversations private (see Message model
 * and socketHandler.js, which both check Connection.isAccepted before
 * allowing any message to be read or sent).
 */
const connectionSchema = new mongoose.Schema({
  fromUsername: { type: String, required: true, index: true }, // who sent the follow request
  toUsername: { type: String, required: true, index: true }, // who received it
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ConnectionModel = mongoose.model("Connection", connectionSchema);

connectionSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

class Connection {
  static async findById(id) {
    try {
      return await ConnectionModel.findById(id);
    } catch (err) {
      return null;
    }
  }

  // Finds any connection record between the two usernames, regardless of direction
  static async findBetween(userA, userB) {
    return ConnectionModel.findOne({
      $or: [
        { fromUsername: userA, toUsername: userB },
        { fromUsername: userB, toUsername: userA },
      ],
    });
  }

  static async isAccepted(userA, userB) {
    const conn = await Connection.findBetween(userA, userB);
    return !!conn && conn.status === "accepted";
  }

  static async create({ fromUsername, toUsername }) {
    return ConnectionModel.create({ fromUsername, toUsername, status: "pending" });
  }

  // Re-opens a previously rejected request (so a user isn't permanently
  // blocked from ever re-requesting), re-attributing it to whoever is
  // requesting now.
  static async reopen(id, fromUsername, toUsername) {
    return ConnectionModel.findByIdAndUpdate(
      id,
      { fromUsername, toUsername, status: "pending", updatedAt: new Date() },
      { new: true }
    );
  }

  static async updateStatus(id, status) {
    return ConnectionModel.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true });
  }

  // Returns { accepted: [usernames], incoming: [connection], outgoing: [connection] }
  // relative to `username` — everything needed to render the sidebar.
  static async listForUser(username) {
    const all = await ConnectionModel.find({
      $or: [{ fromUsername: username }, { toUsername: username }],
    });

    const accepted = all
      .filter((c) => c.status === "accepted")
      .map((c) => (c.fromUsername === username ? c.toUsername : c.fromUsername));

    const incoming = all.filter((c) => c.status === "pending" && c.toUsername === username);
    const outgoing = all.filter((c) => c.status === "pending" && c.fromUsername === username);

    return { accepted, incoming, outgoing };
  }

  // Cascade delete: called when a user deletes their account, so no orphaned
  // follow requests/connections referencing a username that no longer exists.
  static async deleteAllForUser(username) {
    await ConnectionModel.deleteMany({ $or: [{ fromUsername: username }, { toUsername: username }] });
  }
}

module.exports = Connection;
