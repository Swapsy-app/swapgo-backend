const express = require("express");
const router = express.Router();
const Issue = require("../../../Models/issue/issue");
const adminAuth = require("../../../Modules/adminAuthMiddleware");

// 🔹 GET /api/admin/issues
// 🔐 Protected by adminAuth
router.get("/adminissuestatus", adminAuth("superadmin"), async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const { userId, orderNumber, status } = req.query;

    let query = {};

    if (userId) {
      query.userId = userId;
    }

    if (orderNumber) {
      query.orderNumber = { $regex: orderNumber, $options: "i" };
    }

    if (status) {
      query.status = status;
    }

    const total = await Issue.countDocuments(query);

    const issues = await Issue.find(query)
      .populate("userId", "name email") // Populate user name and email
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      issues,
    });
  } catch (error) {
    console.error("Error fetching issues for admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin Reply + Status Update (Separate status for Issue and Order)
router.patch("/admreply/:id", adminAuth(), async (req, res) => {
  const { issueStatus, orderIssueStatus, message } = req.body;

  if (!issueStatus && !orderIssueStatus && !message) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    // Update issue schema fields
    if (issueStatus) {
      issue.status = issueStatus;
    }

    if (message) {
      issue.reply.push({
        sender: "admin",
        message,
      });
    }

    await issue.save();

    // Update order schema if linked
    if (orderIssueStatus && issue.orderNumber) {
      const updatedOrder = await Order.findOneAndUpdate(
        { transactionId: issue.orderNumber },
        {
          issueStatus: orderIssueStatus,
          issueResolution: message || undefined, // Optional: add resolution note
        },
        { new: true }
      );

      if (!updatedOrder) {
        console.warn(`Order not found with transactionId: ${issue.orderNumber}`);
      }
    }

    res.json({ message: "Issue updated", issue });

  } catch (err) {
    console.error("Admin update issue error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
