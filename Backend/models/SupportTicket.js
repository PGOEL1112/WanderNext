const mongoose = require("mongoose");
const { Schema } = mongoose;

// Chat message subdocument
const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    text: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

// Main ticket model
const supportSchema = new Schema(
  {
    chatType: {
      type: String,
      enum: [
        "ticket",
        "user-admin",
        "owner-admin",
        "user-owner"
      ],
      required: true
    },

    // INITIAL CREATOR (not required anymore)
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false   // ← IMPORTANT
    },

    email: String,

    issueType: String,

    message: String,

    status: {
      type: String,
      enum: ["open", "pending", "in-progress", "resolved", "closed"],
      default: "open"
    },

    // Main participants
    participants: {
      user: { type: Schema.Types.ObjectId, ref: "User", required: true },
      other: { type: Schema.Types.ObjectId, ref: "User", required: true }
    },

    messages: [messageSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportTicket", supportSchema);
