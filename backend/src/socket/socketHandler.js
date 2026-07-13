const Message = require("../models/Message");
const Connection = require("../models/Connection");
const { socketAuth } = require("../middleware/auth");
const presence = require("./presence");

function registerSocketHandlers(io) {
  presence.setIO(io);

  // Every socket must present a valid JWT (issued by POST /api/auth/login
  // or /api/auth/register) via `socket.handshake.auth.token` before the
  // "connection" event fires. Sockets that fail this are rejected with a
  // "connect_error" on the client and never reach the handlers below.
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const username = socket.data.username; // set by socketAuth middleware
    console.log(`[socket] connected: ${socket.id} as ${username}`);

    presence.addUserSocket(username, socket.id);

    // Online/offline presence is broadcast to everyone (just "who's online",
    // no message content) - this is different from chat privacy, which is
    // enforced per-conversation below.
    io.emit("users:online", presence.getOnlineUsernames());
    socket.broadcast.emit("user:joined", { username });

    // --- New chat message (text or image), scoped to a private 1:1 conversation ---
    socket.on("message:send", async (payload, ack) => {
      try {
        const toUsername = payload && payload.toUsername;
        if (!toUsername || typeof toUsername !== "string") {
          if (typeof ack === "function") ack({ success: false, error: "toUsername is required" });
          return;
        }

        // The core privacy guarantee: you can only send (and by extension,
        // only the two of you can ever read) a message if there's an
        // accepted Connection between you. No global room, no broadcast.
        if (!(await Connection.isAccepted(username, toUsername))) {
          if (typeof ack === "function") {
            ack({ success: false, error: "You can only message users you're connected with" });
          }
          return;
        }

        const type = payload.type === "image" ? "image" : "text";
        let message;

        if (type === "text") {
          const text = typeof payload.text === "string" ? payload.text.trim() : "";
          if (!text) {
            if (typeof ack === "function") ack({ success: false, error: "Message text cannot be empty" });
            return;
          }
          if (text.length > 2000) {
            if (typeof ack === "function") ack({ success: false, error: "Message too long (max 2000 chars)" });
            return;
          }
          message = await Message.create({ fromUsername: username, toUsername, type: "text", text });
        } else {
          const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl : "";
          if (!imageUrl) {
            if (typeof ack === "function") ack({ success: false, error: "imageUrl is required for image messages" });
            return;
          }
          message = await Message.create({ fromUsername: username, toUsername, type: "image", imageUrl });
        }

        // Deliver only to the two participants' own sockets (all their open
        // tabs/devices) - never a global io.emit(). This is what makes the
        // conversation private at the transport level, not just in the UI.
        presence.emitToUser(username, "message:receive", message);
        presence.emitToUser(toUsername, "message:receive", message);

        // Simulate "delivered" status shortly after and notify both participants.
        setTimeout(async () => {
          try {
            const updated = await Message.markDelivered(message.id);
            if (updated) {
              presence.emitToUser(username, "message:statusUpdate", { id: updated.id, status: updated.status });
              presence.emitToUser(toUsername, "message:statusUpdate", { id: updated.id, status: updated.status });
            }
          } catch (err) {
            console.error("[socket] markDelivered error", err);
          }
        }, 300);

        if (typeof ack === "function") ack({ success: true, data: message });
      } catch (err) {
        console.error("[socket] message:send error", err);
        if (typeof ack === "function") ack({ success: false, error: "Failed to send message" });
      }
    });

    // --- Typing indicator, scoped to a single conversation partner ---
    socket.on("typing:start", async ({ toUsername } = {}) => {
      if (!toUsername || !(await Connection.isAccepted(username, toUsername))) return;
      presence.emitToUser(toUsername, "typing:update", { username, isTyping: true });
    });

    socket.on("typing:stop", async ({ toUsername } = {}) => {
      if (!toUsername || !(await Connection.isAccepted(username, toUsername))) return;
      presence.emitToUser(toUsername, "typing:update", { username, isTyping: false });
    });

    // =========================================================================
    // WebRTC call signaling (audio + video) - also gated behind an accepted
    // connection, consistent with the rest of the app: you can only call
    // someone you're allowed to message. The server never touches media -
    // it only relays offer/answer/ICE-candidate messages between the two
    // participants.
    // =========================================================================

    socket.on("call:invite", async ({ toUsername, offer, callType }, ack) => {
      if (!toUsername || !offer) {
        if (typeof ack === "function") ack({ success: false, error: "toUsername and offer are required" });
        return;
      }
      if (toUsername === username) {
        if (typeof ack === "function") ack({ success: false, error: "You can't call yourself" });
        return;
      }
      if (!(await Connection.isAccepted(username, toUsername))) {
        if (typeof ack === "function") ack({ success: false, error: "You can only call users you're connected with" });
        return;
      }

      const delivered = presence.emitToUser(toUsername, "call:incoming", {
        fromUsername: username,
        offer,
        callType: callType === "video" ? "video" : "audio",
      });

      if (!delivered) {
        if (typeof ack === "function") ack({ success: false, error: `${toUsername} is not online` });
        return;
      }
      if (typeof ack === "function") ack({ success: true });
    });

    socket.on("call:answer", ({ toUsername, answer }) => {
      if (!toUsername || !answer) return;
      presence.emitToUser(toUsername, "call:answered", { fromUsername: username, answer });
    });

    socket.on("call:ice-candidate", ({ toUsername, candidate }) => {
      if (!toUsername || !candidate) return;
      presence.emitToUser(toUsername, "call:ice-candidate", { fromUsername: username, candidate });
    });

    socket.on("call:reject", ({ toUsername }) => {
      if (!toUsername) return;
      presence.emitToUser(toUsername, "call:rejected", { fromUsername: username });
    });

    socket.on("call:end", ({ toUsername }) => {
      if (!toUsername) return;
      presence.emitToUser(toUsername, "call:ended", { fromUsername: username });
    });

    // --- Disconnect handling ---
    socket.on("disconnect", (reason) => {
      presence.removeUserSocket(username, socket.id);
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);

      io.emit("users:online", presence.getOnlineUsernames());
      socket.broadcast.emit("user:left", { username });

      // If this was the user's last open socket, let anyone mid-call with
      // them know the call dropped, so their UI doesn't hang indefinitely.
      if (!presence.isOnline(username)) {
        socket.broadcast.emit("call:ended", { fromUsername: username });
      }
    });

    // --- Socket-level error handling ---
    socket.on("error", (err) => {
      console.error(`[socket] error on ${socket.id}:`, err);
    });
  });

  // Errors thrown by the socketAuth middleware surface here for logging.
  io.engine.on("connection_error", (err) => {
    console.error("[socket] connection_error:", err.message);
  });
}

module.exports = { registerSocketHandlers };
