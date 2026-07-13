// If REACT_APP_SERVER_URL is set (typical for local dev, where frontend and
// backend run on different ports), use it. Otherwise fall back to the page's
// own origin — this is what makes a single combined deployment (the Express
// backend serving this app's build output, see backend/src/server.js) work
// with zero configuration: API calls and the socket connection just go to
// wherever this page was served from.
const SERVER_URL =
  process.env.REACT_APP_SERVER_URL && process.env.REACT_APP_SERVER_URL.trim()
    ? process.env.REACT_APP_SERVER_URL.trim()
    : window.location.origin;

// A 401 means the token is missing/invalid/expired. We throw a distinguishable
// error so App.jsx can react by logging the user out, rather than just
// showing a generic "failed to load" message.
class UnauthorizedError extends Error {}

async function handleResponse(res) {
  let body;
  try {
    body = await res.json();
  } catch (e) {
    throw new Error("Invalid response from server");
  }
  if (res.status === 401) {
    throw new UnauthorizedError(body.error || "Session expired, please log in again");
  }
  if (!res.ok || !body.success) {
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return body.data;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function get(path, token) {
  return fetch(`${SERVER_URL}${path}`, { headers: { ...authHeaders(token) } }).then(handleResponse);
}

function post(path, token, body) {
  return fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body || {}),
  }).then(handleResponse);
}

// GET /api/messages/:peerUsername - conversation history with one specific
// connection. Requires an accepted connection (enforced server-side).
export function fetchConversation(token, peerUsername) {
  return get(`/api/messages/${encodeURIComponent(peerUsername)}`, token);
}

// POST /api/messages - REST fallback for sending a message. Normal sends go
// through the socket for instant delivery; this covers the required REST
// contract and works even if the socket is temporarily down.
export function sendMessageRest(token, toUsername, text) {
  return post("/api/messages", token, { toUsername, type: "text", text });
}

// POST /api/upload - uploads an image file (multipart/form-data), returns { url }
export async function uploadImage(token, file) {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${SERVER_URL}/api/upload`, {
    method: "POST",
    headers: { ...authHeaders(token) }, // no Content-Type: fetch sets the multipart boundary itself
    body: formData,
  });
  return handleResponse(res); // { url }
}

// GET /api/users - every other user, with follow/connection status relative to me
export function fetchUsers(token) {
  return get("/api/users", token);
}

// GET /api/connections - { accepted: [usernames], incoming: [...], outgoing: [...] }
export function fetchConnections(token) {
  return get("/api/connections", token);
}

// POST /api/connections/request { toUsername } - send a follow request
export function sendFollowRequest(token, toUsername) {
  return post("/api/connections/request", token, { toUsername });
}

// POST /api/connections/:id/accept
export function acceptConnection(token, id) {
  return post(`/api/connections/${id}/accept`, token);
}

// POST /api/connections/:id/reject
export function rejectConnection(token, id) {
  return post(`/api/connections/${id}/reject`, token);
}

export { SERVER_URL, UnauthorizedError };
