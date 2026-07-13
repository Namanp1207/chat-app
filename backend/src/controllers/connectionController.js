const Connection = require("../models/Connection");
const User = require("../models/User");
const presence = require("../socket/presence");

// GET /api/connections
// Everything the sidebar needs: accepted connections (people you can chat
// with), plus incoming/outgoing pending follow requests.
const listConnections = async (req, res, next) => {
  try {
    const me = req.user.username;
    const { accepted, incoming, outgoing } = await Connection.listForUser(me);

    return res.status(200).json({
      success: true,
      data: {
        accepted,
        incoming: incoming.map((c) => ({ id: c.id, fromUsername: c.fromUsername })),
        outgoing: outgoing.map((c) => ({ id: c.id, toUsername: c.toUsername })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/connections/request  { toUsername }
// Sends a follow request. The other user must accept before either side can
// see or send any messages between them.
const sendRequest = async (req, res, next) => {
  try {
    const me = req.user.username;
    const { toUsername } = req.body;

    if (!toUsername || typeof toUsername !== "string") {
      return res.status(400).json({ success: false, error: "toUsername is required" });
    }
    if (toUsername === me) {
      return res.status(400).json({ success: false, error: "You can't follow yourself" });
    }

    const target = await User.findByUsername(toUsername);
    if (!target) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const existing = await Connection.findBetween(me, toUsername);
    let connection;

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(409).json({ success: false, error: "You're already connected" });
      }
      if (existing.status === "pending") {
        return res.status(409).json({ success: false, error: "A request is already pending" });
      }
      // Previously rejected - allow trying again, re-attributed to this request
      connection = await Connection.reopen(existing.id, me, target.username);
    } else {
      connection = await Connection.create({ fromUsername: me, toUsername: target.username });
    }

    // Real-time nudge if the target is online right now; harmless no-op otherwise
    presence.emitToUser(target.username, "connection:incoming", {
      id: connection.id,
      fromUsername: me,
    });

    return res.status(201).json({ success: true, data: connection });
  } catch (err) {
    next(err);
  }
};

// POST /api/connections/:id/accept
const acceptRequest = async (req, res, next) => {
  try {
    const me = req.user.username;
    const { id } = req.params;

    const connection = await Connection.findById(id);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }
    if (connection.toUsername !== me) {
      return res.status(403).json({ success: false, error: "You can't accept this request" });
    }
    if (connection.status !== "pending") {
      return res.status(400).json({ success: false, error: "Request is no longer pending" });
    }

    const updated = await Connection.updateStatus(id, "accepted");
    presence.emitToUser(connection.fromUsername, "connection:accepted", { username: me });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// POST /api/connections/:id/reject
const rejectRequest = async (req, res, next) => {
  try {
    const me = req.user.username;
    const { id } = req.params;

    const connection = await Connection.findById(id);
    if (!connection) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }
    if (connection.toUsername !== me) {
      return res.status(403).json({ success: false, error: "You can't reject this request" });
    }
    if (connection.status !== "pending") {
      return res.status(400).json({ success: false, error: "Request is no longer pending" });
    }

    const updated = await Connection.updateStatus(id, "rejected");
    presence.emitToUser(connection.fromUsername, "connection:rejected", { username: me });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { listConnections, sendRequest, acceptRequest, rejectRequest };
