const mongoose = require("mongoose");

// MongoDB is what makes data survive real deployments: unlike the old
// JSON-file store, it doesn't live on the app server's local disk, so it's
// unaffected by redeploys, restarts, or ephemeral filesystems (the #1 cause
// of "my data disappeared after deploying" on platforms like Render/Railway).
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is not set. Add it to backend/.env (see .env.example) — " +
      "e.g. a free MongoDB Atlas cluster connection string."
  );
}

mongoose.set("strictQuery", true);

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

mongoose.connection.on("error", (err) => {
  console.error("[mongoose] connection error:", err.message);
});
mongoose.connection.on("disconnected", () => {
  console.warn("[mongoose] disconnected");
});

module.exports = { connectDB, mongoose };
