const express = require("express");
const { uploadImage } = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/upload -> { url } ; requires auth so uploads can be attributed
router.post("/", requireAuth, uploadImage);

module.exports = router;
