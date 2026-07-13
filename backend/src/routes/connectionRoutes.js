const express = require("express");
const {
  listConnections,
  sendRequest,
  acceptRequest,
  rejectRequest,
} = require("../controllers/connectionController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, listConnections);
router.post("/request", requireAuth, sendRequest);
router.post("/:id/accept", requireAuth, acceptRequest);
router.post("/:id/reject", requireAuth, rejectRequest);

module.exports = router;
