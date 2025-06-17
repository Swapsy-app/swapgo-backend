const express = require("express");
const router = express.Router();
const Product = require("../Models/ProductModels/Product");
const ProductReport = require("../Models/productReport");
const authenticateToken = require('../Modules/authMiddleware');

// Submit a product report
router.post("/reportproduct", authenticateToken, async (req, res) => {
  const { productId, reportOption, reason } = req.body;

  if (!productId || !reportOption || !reason) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const product = await Product.findById(productId).select("sellerId");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Prevent reporting your own product
    if (product.sellerId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot report your own product." });
    }

    const report = await ProductReport.create({
      product: productId,
      reportedUser: product.sellerId,
      reportedBy: req.user._id,
      reportOption,
      reason,
    });

    res.status(201).json({ message: "Product reported", report });
  } catch (err) {
    console.error("Product report error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
