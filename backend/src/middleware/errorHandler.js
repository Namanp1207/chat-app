// Catches errors thrown/forwarded (via next(err)) from any route handler
// so we never leak stack traces to clients and always return consistent JSON.
const errorHandler = (err, req, res, next) => {
  console.error("[ERROR]", err);

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message || "Something went wrong";

  res.status(status).json({ success: false, error: message });
};

// 404 handler for unknown REST routes
const notFound = (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
};

module.exports = { errorHandler, notFound };
