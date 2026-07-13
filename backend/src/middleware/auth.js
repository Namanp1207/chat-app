const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with `undefined`
  throw new Error("JWT_SECRET is not set. Add it to backend/.env (see .env.example).");
}

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  // Throws if invalid/expired — callers decide how to handle that
  return jwt.verify(token, JWT_SECRET);
}

// Express middleware: requires a valid `Authorization: Bearer <token>` header.
// On success, attaches req.user = { id, username }.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, error: "Missing or malformed Authorization header" });
  }

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, username: decoded.username };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

// Socket.io middleware: expects the token on socket.handshake.auth.token.
// On success, attaches socket.data.user = { id, username }.
function socketAuth(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: no token provided"));
  }

  try {
    const decoded = verifyToken(token);
    socket.data.user = { id: decoded.sub, username: decoded.username };
    // Keep this for backwards compatibility with the rest of socketHandler.js
    socket.data.username = decoded.username;
    next();
  } catch (err) {
    next(new Error("Authentication error: invalid or expired token"));
  }
}

module.exports = { signToken, verifyToken, requireAuth, socketAuth };
