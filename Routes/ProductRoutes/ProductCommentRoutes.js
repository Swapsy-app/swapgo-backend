const express = require("express");
const router = express.Router();
const Comment = require("../../Models/ProductModels/comments");
const Reply = require("../../Models/ProductModels/commentReply");
const Product = require("../../Models/ProductModels/Product");
const User = require("../../Models/User");
const authenticateToken = require("../../Modules/authMiddleware");

// 1️⃣ Add a comment (Only authenticated users)
router.post("/:productId", authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { commentText, taggedUsernames } = req.body;
    const userId = req.user.id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let taggedUsers = [];
    if (taggedUsernames?.length > 0) {
      taggedUsers = await User.find({
        username: { $in: taggedUsernames },
        isVerified: true,
      }).select("_id");
    }

    if (taggedUsers.length === 0 && String(product.sellerId) !== userId) {
      taggedUsers.push(product.sellerId);
    }

    const newComment = new Comment({ productId, userId, commentText, taggedUsers });
    await newComment.save();

    res.status(201).json({ message: "Comment added successfully", comment: newComment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2️⃣ Add a reply
router.post("/:commentId/reply", authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { replyText, taggedUsernames } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    let taggedUsers = [];
    if (taggedUsernames?.length > 0) {
      taggedUsers = await User.find({
        username: { $in: taggedUsernames },
        isVerified: true,
      }).select("_id");
    }

    if (taggedUsers.length === 0 && String(comment.userId) !== userId) {
      taggedUsers.push(comment.userId);
    }

    const reply = new Reply({ commentId, userId, replyText, taggedUsers });
    await reply.save();
    comment.replyCount += 1;
    await comment.save();

    res.status(201).json({ message: "Reply added successfully", reply });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3️⃣ Get all comments with pagination (latest first)
router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const totalCount = await Comment.countDocuments({ productId });
    const totalPages = Math.ceil(totalCount / limit);

    const comments = await Comment.find({ productId })
      .populate("userId", "username avatar")
      .populate("taggedUsers", "username avatar")
      .sort({ createdAt: -1 }) // Latest comments first
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      currentPage: page,
      totalPages,
      totalCount,
      data: comments
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4️⃣ Get replies with pagination (latest first)
router.get("/:commentId/replies", async (req, res) => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const totalCount = await Reply.countDocuments({ commentId });
    const totalPages = Math.ceil(totalCount / limit);

    const replies = await Reply.find({ commentId })
      .populate("userId", "username avatar")
      .populate("taggedUsers", "username avatar")
      .sort({ createdAt: -1 }) // Latest replies first
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      currentPage: page,
      totalPages,
      totalCount,
      data: replies
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// 5️⃣ Delete a comment
router.delete("/:commentId", authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (String(comment.userId) !== userId) {
      return res.status(403).json({ message: "Unauthorized to delete this comment" });
    }
    await Reply.deleteMany({ commentId });
    await Comment.findByIdAndDelete(commentId);
    res.status(200).json({ message: "Comment and replies deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6️⃣ Delete a reply
router.delete("/replies/:replyId", authenticateToken, async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = req.user.id;
    const reply = await Reply.findById(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });
    if (String(reply.userId) !== userId) {
      return res.status(403).json({ message: "Unauthorized to delete this reply" });
    }
    await Reply.findByIdAndDelete(replyId);
    await Comment.findByIdAndUpdate(reply.commentId, { $inc: { replyCount: -1 } });
    res.status(200).json({ message: "Reply deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 7️⃣ Search users (Exclude unverified users)
router.get("/users/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Search query is required" });
    const users = await User.find({
      username: new RegExp("^" + query.replace("@", ""), "i"),
      isVerified: true,
    }).select("username avatar");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
