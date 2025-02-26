const express = require("express");
const User = require("../../Models/User");
const authenticateToken = require("../../Modules/authMiddleware");

const router = express.Router();

// Toggle Holiday Mode
router.put("/holiday-mode", authenticateToken, async (req, res) => {
  try {
    const { holidayMode } = req.body; // true or false
    const userId = req.user.id; // Extract user ID from JWT token

    if (typeof holidayMode !== "boolean") {
      return res.status(400).json({ error: "Invalid holidayMode value" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.holidayMode = holidayMode; // Update holiday mode
    await user.save(); // ✅ Triggers the pre-save middleware in the User model

    res.json({ message: `Holiday mode ${holidayMode ? "enabled" : "disabled"} successfully!` });
  } catch (error) {
    console.error("Error toggling holiday mode:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
