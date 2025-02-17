const express = require("express");
const Report = require("../Models/ReportUser"); // Adjust path to your Report model
const User = require("../Models/User"); // Adjust path to your User model
const router = express.Router();
const authenticateToken = require('../Modules/authMiddleware'); // Middleware to authenticate token and check if the user is verified
const jwt = require('jsonwebtoken');


// Route to submit a user report
router.post("/report", authenticateToken, async (req, res) => {
  const { reportedUserId, reportOption, reason } = req.body;

  // Validate input
  if (!reportedUserId || !reportOption || !reason) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Verify if the reported user exists
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ message: "Reported user not found." });
    }

    // Check if the user is not reporting themselves
    if (req.user.id === reportedUserId) {
      return res.status(400).json({ message: "You cannot report yourself." });
    }

    // Create and save the report
    const newReport = new Report({
      reportedUser: reportedUserId,
      reportedBy: req.user.id,
      reportOption,
      reason,
    });

    await newReport.save();

    res.status(201).json({ message: "Report submitted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

module.exports = router;
