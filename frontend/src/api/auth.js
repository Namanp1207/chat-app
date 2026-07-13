import { SERVER_URL } from "./api";

const TOKEN_KEY = "chat_token";
const USER_KEY = "chat_user";

async function handleResponse(res) {
  let body;
  try {
    body = await res.json();
  } catch (e) {
    throw new Error("Invalid response from server");
  }
  if (!res.ok || !body.success) {
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return body.data;
}

// POST /api/auth/register
export async function register(username, password, email) {
  const res = await fetch(`${SERVER_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email: email || undefined }),
  });
  return handleResponse(res); // { token, user }
}

// POST /api/auth/login
export async function login(username, password) {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res); // { token, user }
}

// POST /api/auth/forgot-password
export async function forgotPassword(username) {
  const res = await fetch(`${SERVER_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return handleResponse(res); // { message } — never contains the reset link/token
}

// POST /api/auth/reset-password
export async function resetPassword(token, newPassword) {
  const res = await fetch(`${SERVER_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  return handleResponse(res); // { message }
}

// DELETE /api/auth/me
export async function deleteAccount(token) {
  const res = await fetch(`${SERVER_URL}/api/auth/me`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res); // { message }
}

// --- Local session helpers ---
export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Standard Authorization header for authenticated REST calls
export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
