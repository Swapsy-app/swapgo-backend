const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // The product being commented on
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The commenter (buyer/seller)
    commentText: { type: String, required: true }, // The actual comment text
    taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who are tagged in the comment
    replies: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The user replying
        replyText: { type: String, required: true }, // Reply content
        taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users tagged in reply
        createdAt: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;
