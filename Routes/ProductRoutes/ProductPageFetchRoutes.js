const express = require("express");
const router = express.Router();
const Product = require("../../Models/ProductModels/Product");

// Fetch product details by product ID
router.get("/product-page-fetch/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .select("-gstNumber -pickupAddress -quantity -shippingMethod") // Exclude these fields
      .populate({
        path: "sellerId",
        select: "username avatar", // Populate seller details
      });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
