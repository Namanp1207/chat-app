// Deterministic conversation id for a pair of users, independent of message
// direction - must exactly match Message.conversationIdFor on the backend.
export function conversationIdFor(userA, userB) {
  return [userA, userB].sort().join("::");
}
