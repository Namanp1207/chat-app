const Message = require("../models/Message");
const Connection = require("../models/Connection");

// GET /api/messages/:peerUsername
// Fetch the 1:1 conversation history between the logged-in user and :peerUsername.
// Requires an accepted Connection between them - this is the privacy boundary:
// without it, no one can read a conversation they're not part of, even by
// guessing/crafting the URL, because the check is against the verified JWT
// identity (req.user.username), not anything the client claims.
const getConversation = async (req, res, next) => {
  try {
    const me = req.user.username;
    const { peerUsername } = req.params;

    if (!(await Connection.isAccepted(me, peerUsername))) {
      return res.status(403).json({
        success: false,
        error: "You can only view conversations with users you're connected with",
      });
    }

    const messages = await Message.getConversation(me, peerUsername);
    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

// POST /api/messages
// REST fallback for sending a message (normal sends go through the socket
// for instant delivery - see socket/socketHandler.js, which calls the same
// Message model). Requires an accepted connection with the recipient.
const createMessage = async (req, res, next) => {
  try {
    const { toUsername, text, type, imageUrl } = req.body;
    const fromUsername = req.user.username;
    const messageType = type === "image" ? "image" : "text";

    if (!toUsername || typeof toUsername !== "string") {
      return res.status(400).json({ success: false, error: "toUsername is required" });
    }
    if (!(await Connection.isAccepted(fromUsername, toUsername))) {
      return res.status(403).json({
        success: false,
        error: "You can only message users you're connected with",
      });
    }

    if (messageType === "text") {
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: "text is required" });
      }
      if (text.length > 2000) {
        return res.status(400).json({ success: false, error: "text is too long (max 2000 chars)" });
      }
    } else if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ success: false, error: "imageUrl is required for image messages" });
    }

    const message = await Message.create({
      fromUsername,
      toUsername,
      type: messageType,
      text: messageType === "text" ? text.trim() : null,
      imageUrl: messageType === "image" ? imageUrl : null,
    });
    return res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConversation, createMessage };
