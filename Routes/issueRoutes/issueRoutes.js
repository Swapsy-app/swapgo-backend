const express = require("express");
const router = express.Router();
const Issue = require("../../Models/issue/issue");
const User = require("../../Models/User");
const Order = require("../../Models/ProductOrder/ProductOrder");
const authenticateToken = require("../../Modules/authMiddleware");

// 🔹 POST /api/issue - Raise a new issue
router.post("/raiseticket", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, orderNumber, description, email, phone } = req.body;

    const user = await User.findById(userId).select("email mobile");

    if (!title || !description) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const issue = new Issue({
      userId,
      title,
      orderNumber,
      description,
      email: email || user.email,
      phone: phone || user.mobile,
    });

    await issue.save();

    // If orderNumber is provided, update related order
    if (orderNumber) {
      const matchedOrder = await Order.findOne({ transactionId: orderNumber });

      if (matchedOrder) {
        matchedOrder.issueStatus = "raised";
        matchedOrder.issueId = issue._id; // 👈 Add this in your Order schema
        await matchedOrder.save();
      }
    }

    res.status(201).json({ message: "Issue raised successfully", issue });

  } catch (err) {
    console.error("Error raising issue:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🔹 GET /api/issue - Get issues of logged-in user
router.get("/ticketdetail", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const issues = await Issue.find({ userId }).sort({ createdAt: -1 });

    res.json({ issues });
  } catch (err) {
    console.error("Error fetching issues:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// user reply to issue route
router.patch("/:id/reply", authenticateToken, async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: "Reply message is required" });
  }

  try {
    const issue = await Issue.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    if (issue.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (issue.status === "permanently_closed") {
      return res.status(403).json({ message: "This issue is permanently closed. You cannot reply to it." });
    }

    issue.reply.push({
      sender: "user",
      message,
      timestamp: new Date(), // Optional
    });

    // Set status to ongoing if it's not permanently closed (already checked above)
    issue.status = "ongoing";

    await issue.save();

    res.json({ message: "Reply added", issue });

  } catch (err) {
    console.error("User reply error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
