const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ["admin", "user"],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const issueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  orderNumber: {
    type: String,
  },
  description: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["ticket raised", "ongoing", "closed", "permanently_closed"],
    default: "ticket raised",
  },
  reply: [replySchema], // 🔄 Array of replies
}, { timestamps: true });

module.exports = mongoose.model("Issue", issueSchema);
