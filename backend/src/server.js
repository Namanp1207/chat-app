require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const { connectDB } = require("./config/db");
const messageRoutes = require("./routes/messageRoutes");
const authRoutes = require("./routes/authRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const userRoutes = require("./routes/userRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { registerSocketHandlers } = require("./socket/socketHandler");

const PORT = process.env.PORT || 5000;
// When the frontend is deployed separately (e.g. on Vercel), set this to its
// URL. When running the single combined deployment (this server also serves
// the built frontend — see "Serve the built frontend" below), the frontend
// is same-origin, so CORS/Socket.io origin checks are a non-issue and this
// can be left at its default.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
// Support a comma-separated list of origins for flexibility across dev/prod
const allowedOrigins = CLIENT_ORIGIN.split(",").map((o) => o.trim());

const app = express();
const server = http.createServer(app);

// --- Core middleware ---
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// --- Health check (useful for hosting platforms like Render/Railway) ---
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Static file serving for uploaded images ---
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

// --- REST API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/connections", connectionRoutes);

// --- Serve the built frontend (single combined deployment) ---
// If the root "npm run build" script has been run (see the project root
// package.json), its output is copied to backend/src/public, and this
// server serves the React app directly — one service, one URL, no separate
// frontend host needed. If that folder doesn't exist (e.g. local dev, where
// the frontend runs on its own dev server via `npm start`), this is
// silently skipped and has no effect. See the README's "Deployment" section
// for when to use this vs. deploying frontend/backend separately.
const publicDir = path.resolve(__dirname, "public");
const hasBuiltFrontend = fs.existsSync(path.join(publicDir, "index.html"));

if (hasBuiltFrontend) {
  app.use(express.static(publicDir));

  // Any GET that isn't an API/upload/health route and isn't a real static
  // file falls back to index.html, so a browser refresh on any page still
  // loads the app instead of a 404.
  app.get(/^(?!\/api|\/uploads|\/health).*/, (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// --- 404 + centralized error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

// --- Socket.io setup ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

registerSocketHandlers(io);

// --- Process-level safety nets ---
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

// Connect to MongoDB before accepting any traffic, so the very first
// requests don't race a not-yet-ready connection.
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`Allowed client origins: ${allowedOrigins.join(", ")}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
