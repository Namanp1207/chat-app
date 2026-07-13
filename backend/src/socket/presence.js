// Tracks which usernames are currently connected via Socket.io, and lets
// any part of the backend (socket handlers OR plain REST controllers, e.g.
// when a follow request is created) push an event to a specific user's
// open tab(s) without broadcasting to everyone.

let ioInstance = null;

// socket.id -> username
const onlineUsers = new Map();
// username -> Set<socket.id>  (a user can have multiple tabs/devices open)
const userSockets = new Map();

function setIO(io) {
  ioInstance = io;
}

function addUserSocket(username, socketId) {
  onlineUsers.set(socketId, username);
  if (!userSockets.has(username)) userSockets.set(username, new Set());
  userSockets.get(username).add(socketId);
}

function removeUserSocket(username, socketId) {
  onlineUsers.delete(socketId);
  const set = userSockets.get(username);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(username);
}

function isOnline(username) {
  return userSockets.has(username);
}

function getOnlineUsernames() {
  return Array.from(userSockets.keys());
}

// Send an event to every open socket belonging to `username`. Returns false
// if the user isn't currently connected (nothing to do, not an error).
function emitToUser(username, event, payload) {
  if (!ioInstance) return false;
  const socketIds = userSockets.get(username);
  if (!socketIds || socketIds.size === 0) return false;
  socketIds.forEach((id) => ioInstance.to(id).emit(event, payload));
  return true;
}

// Forcibly disconnects every open socket for `username` (e.g. after their
// account is deleted, so an already-issued JWT can't keep driving a live
// session even though it hasn't technically expired yet).
function disconnectUser(username) {
  if (!ioInstance) return;
  const socketIds = userSockets.get(username);
  if (!socketIds) return;
  socketIds.forEach((id) => {
    const s = ioInstance.sockets.sockets.get(id);
    if (s) s.disconnect(true);
  });
}

module.exports = {
  setIO,
  addUserSocket,
  removeUserSocket,
  isOnline,
  getOnlineUsernames,
  emitToUser,
  disconnectUser,
};
