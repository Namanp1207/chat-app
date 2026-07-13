const { mongoose } = require("../config/db");

// Deterministic conversation id for a pair of users, independent of who's
// "from" and who's "to" - so both participants always look up the same
// conversation regardless of message direction.
function conversationIdFor(userA, userB) {
  return [userA, userB].sort().join("::");
}

/**
 * Every message belongs to exactly one 1:1 conversation. There is no global
 * broadcast - callers must always scope reads/writes to a conversationId,
 * which is what keeps conversations private between the two participants.
 *
 * Messages are never deleted except as part of User.deleteAccount's cascade
 * (see Message.deleteAllForUser) - they persist indefinitely otherwise,
 * which is the whole point of moving off a JSON file and onto MongoDB.
 */
const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  fromUsername: { type: String, required: true },
  toUsername: { type: String, required: true },
  type: { type: String, enum: ["text", "image"], default: "text" },
  text: { type: String, default: null },
  imageUrl: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ["sent", "delivered"], default: "sent" },
});

// The rest of the app (frontend included) expects a plain `id` field, the
// same shape the old lowdb-backed model produced — not Mongo's `_id`/`__v`.
messageSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const MessageModel = mongoose.model("Message", messageSchema);

class Message {
  static conversationIdFor(userA, userB) {
    return conversationIdFor(userA, userB);
  }

  static async getConversation(userA, userB) {
    const conversationId = conversationIdFor(userA, userB);
    return MessageModel.find({ conversationId }).sort({ timestamp: 1 });
  }

  static async create({ fromUsername, toUsername, text = null, type = "text", imageUrl = null }) {
    return MessageModel.create({
      conversationId: conversationIdFor(fromUsername, toUsername),
      fromUsername,
      toUsername,
      type,
      text,
      imageUrl,
      timestamp: new Date(),
      status: "sent",
    });
  }

  static async markDelivered(id) {
    return MessageModel.findByIdAndUpdate(id, { status: "delivered" }, { new: true });
  }

  // Cascade delete: called when a user deletes their account. This is the
  // ONLY thing that ever deletes messages — otherwise chat history persists
  // indefinitely, per the "chats shouldn't disappear until the user is
  // deleted" requirement.
  static async deleteAllForUser(username) {
    await MessageModel.deleteMany({ $or: [{ fromUsername: username }, { toUsername: username }] });
  }
}

module.exports = Message;
