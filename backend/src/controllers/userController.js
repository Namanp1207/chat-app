const User = require("../models/User");
const Connection = require("../models/Connection");
const presence = require("../socket/presence");

// GET /api/users
// Returns every other user with a `status` relative to the caller so the
// frontend can render "Follow" / "Requested" / "Accept" / "Chat" appropriately,
// plus `requestId` when the caller has a pending action available (accepting
// an incoming request).
const listUsers = async (req, res, next) => {
  try {
    const me = req.user.username;
    const { accepted, incoming, outgoing } = await Connection.listForUser(me);
    const acceptedSet = new Set(accepted);

    const allUsers = await User.findAll();

    const data = allUsers
      .filter((u) => u.username !== me)
      .map((u) => {
        let status = "none";
        let requestId;

        if (acceptedSet.has(u.username)) {
          status = "connected";
        } else {
          const inReq = incoming.find((c) => c.fromUsername === u.username);
          const outReq = outgoing.find((c) => c.toUsername === u.username);
          if (inReq) {
            status = "incoming_pending";
            requestId = inReq.id;
          } else if (outReq) {
            status = "outgoing_pending";
          }
        }

        return {
          username: u.username,
          status,
          requestId,
          online: presence.isOnline(u.username),
        };
      });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers };
