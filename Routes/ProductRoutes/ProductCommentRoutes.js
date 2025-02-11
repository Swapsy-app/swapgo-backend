const express = require("express");
const router = express.Router();
const Comment = require("../../Models/ProductModels/comments");
const Product = require("../../Models/ProductModels/Product");
const User = require("../../Models/User");

// 1️⃣ Add a comment
router.post("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { commentText, taggedUsernames } = req.body;
    const userId = req.user.id; // Get user from JWT token

    // Fetch product to get seller ID
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Find users by tagged usernames
    let taggedUsers = [];
    if (taggedUsernames?.length > 0) {
      taggedUsers = await User.find({ username: { $in: taggedUsernames } }).select("_id");
    }

    // If no tagged users, tag the seller by default
    if (taggedUsers.length === 0 && String(product.sellerId) !== userId) {
      taggedUsers.push(product.sellerId);
    }

    // Create comment
    const newComment = new Comment({
      productId,
      userId,
      commentText,
      taggedUsers
    });

    await newComment.save();
    res.status(201).json({ message: "Comment added successfully", comment: newComment });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2️⃣ Add a reply
router.post("/:commentId/reply", async (req, res) => {
  try {
    const { commentId } = req.params;
    const { replyText, taggedUsernames } = req.body;
    const userId = req.user.id; // Get user from JWT token

    // Find the original comment
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Find users by tagged usernames
    let taggedUsers = [];
    if (taggedUsernames?.length > 0) {
      taggedUsers = await User.find({ username: { $in: taggedUsernames } }).select("_id");
    }

    // If no tagged users, tag the original commenter by default
    if (taggedUsers.length === 0 && String(comment.userId) !== userId) {
      taggedUsers.push(comment.userId);
    }

    // Add reply
    const reply = {
      userId,
      replyText,
      taggedUsers,
      createdAt: new Date()
    };

    comment.replies.push(reply);
    await comment.save();

    res.status(201).json({ message: "Reply added successfully", reply });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3️⃣ Get all comments for a product
router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const comments = await Comment.find({ productId })
      .populate("userId", "username avatar")
      .populate("taggedUsers", "username avatar")
      .populate("replies.userId", "username avatar")
      .populate("replies.taggedUsers", "username avatar")
      .sort({ createdAt: -1 });

    res.status(200).json(comments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4️⃣ Search users by username
router.get("/users/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Search query is required" });

    const users = await User.find({ username: new RegExp("^" + query.replace("@", ""), "i") })
      .select("username avatar");

    res.status(200).json(users);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;