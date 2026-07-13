const express = require("express");
const { getConversation, createMessage } = require("../controllers/messageController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET  /api/messages/:peerUsername -> conversation history (requires accepted connection)
router.get("/:peerUsername", requireAuth, getConversation);

// POST /api/messages -> send a message (REST fallback; requires accepted connection)
router.post("/", requireAuth, createMessage);

module.exports = router;
