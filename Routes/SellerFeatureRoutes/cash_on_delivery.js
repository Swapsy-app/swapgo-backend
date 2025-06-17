const express = require("express");
const router = express.Router();
const User = require("../../Models/User");
const Product = require("../../Models/ProductModels//Product");
const authenticateToken = require("../../Modules/authMiddleware");

// Route to update COD status
router.post("/toggle-cod", authenticateToken, async (req, res) => {
  const userId = req.user._id;
  const { codEnabled } = req.body;

  if (typeof codEnabled !== "boolean") {
    return res.status(400).json({ error: "Invalid value for codEnabled" });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { codEnabled },
      { new: true }
    );

    res.status(200).json({
      message: `COD has been ${codEnabled ? "enabled" : "disabled"}.`,
      codEnabled: updatedUser.codEnabled,
    });
  } catch (error) {
    console.error("Failed to update COD status:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// to check if product is eligible for COD
router.get("/:productId/cod-status", async (req, res) => {
    const { productId } = req.params;
  
    try {
      const product = await Product.findById(productId).select("sellerId");
  
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
  
      const seller = await User.findById(product.sellerId).select("codEnabled");
  
      if (!seller) {
        return res.status(404).json({ error: "Seller not found" });
      }
  
      res.status(200).json({ codEnabled: seller.codEnabled });
    } catch (error) {
      console.error("Error checking COD status:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  // to check if buyer is eligible for COD
router.get("/cod-eligibility", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // From decoded token

    const user = await User.findById(userId).select("codeligibleasrbuyer");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      codEligibleAsBuyer: user.codeligibleasrbuyer,
      message: user.codeligibleasrbuyer
        ? "User is eligible for COD as a buyer."
        : "User is NOT eligible for COD as a buyer.",
    });
  } catch (error) {
    console.error("Error checking COD eligibility:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
