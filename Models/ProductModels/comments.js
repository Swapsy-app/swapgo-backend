const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // The product being commented on
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The commenter
    commentText: { type: String, required: true }, // Main comment text
    taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Tagged users
    replyCount: { type: Number, default: 0 }, // Store the number of replies for efficient fetching
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;
