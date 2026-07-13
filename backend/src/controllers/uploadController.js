const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = path.resolve(__dirname, "..", "uploads");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error("Only JPEG, PNG, GIF, and WEBP images are allowed"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single("image");

// POST /api/upload  (requireAuth)
// multer runs as middleware inline here (rather than in the route file) so
// we can translate its errors into our standard { success, error } JSON
// shape instead of letting Express's default error handler return HTML/plain text.
const uploadImage = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, error: "Image is too large (max 5MB)" });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image file provided" });
    }

    // Public URL path; server.js serves UPLOAD_DIR statically at /uploads
    const url = `/uploads/${req.file.filename}`;
    return res.status(201).json({ success: true, data: { url } });
  });
};

module.exports = { uploadImage, UPLOAD_DIR };
