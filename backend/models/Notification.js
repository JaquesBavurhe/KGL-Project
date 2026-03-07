const mongoose = require("mongoose");

// Director-facing activity log item (profile updates by users).
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 220,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  expiresAt: {
    type: Date,
    // TTL cleanup: remove each notification 10 minutes after creation.
    default: () => new Date(Date.now() + 10 * 60 * 1000),
    expires: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
