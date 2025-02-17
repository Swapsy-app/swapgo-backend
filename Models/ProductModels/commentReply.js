const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
    {
      commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", required: true }, // Link to parent comment
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The user replying
      replyText: { type: String, required: true }, // Reply content
      taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Tagged users in reply
    },
    { timestamps: true }
  );
  
  const Reply = mongoose.model("Reply", replySchema);
  module.exports = Reply;
  