import { io } from "socket.io-client";
import { SERVER_URL } from "../api/api";

// A single shared socket instance for the whole app.
// autoConnect is false so we only connect once the user is authenticated;
// `auth` is set dynamically right before connecting (see connectSocket).
export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

// Attaches the current JWT and (re)connects. Socket.io reads `socket.auth`
// fresh on every connection attempt, including automatic reconnects, so
// setting it once here is enough to cover reconnects too.
export function connectSocket(token) {
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  socket.disconnect();
}
