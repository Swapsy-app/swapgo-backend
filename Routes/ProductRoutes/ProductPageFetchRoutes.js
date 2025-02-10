const express = require("express");
const router = express.Router();
const Product = require("../../Models/ProductModels/Product");
const Bargain = require("../../Models/ProductModels/Bargain");
const jwt = require("jsonwebtoken");

// Fetch product details and price by product ID
router.get("/product-details/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    let buyerId = null;

    // Extract JWT from Authorization Header
    const authHeader = req.header("Authorization");
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_TOKEN);
        buyerId = decoded.id; // Extract buyer ID from token
      } catch (error) {
        console.log("Invalid or expired token, proceeding as guest.");
      }
    }

    console.log("Received Product ID:", productId);
    console.log("Buyer ID (from token or null):", buyerId || "Guest User");

    // Fetch product details excluding some fields
    const product = await Product.findById(productId)
      .select("-gstNumber -pickupAddress -quantity -shippingMethod") // Exclude unnecessary fields
      .populate({
        path: "sellerId",
        select: "username avatar", // Populate seller details
      });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Initialize finalPrice from product price
    let finalPrice = {
      mrp: product.price.mrp,
      cash: product.price.cash?.enteredAmount || null,
      coin: product.price.coin?.enteredAmount || null,
      mix: {
        cash: product.price.mix?.enteredCash || null,
        coin: product.price.mix?.enteredCoin || null,
      },
    };

    // If user is logged in, check for an accepted bargain
    if (buyerId) {
      console.log("Checking bargain for Buyer...");

      const userBargain = await Bargain.findOne({
        productId: productId,
        buyerId: buyerId,
        status: "accepted", // Fetch only accepted bargains
      }).select("offeredPrice offeredIn sellerReceives");

      console.log("Fetched Bargain:", userBargain);

      if (userBargain) {
        // Merge bargain values while keeping non-bargained values from the product
        finalPrice = {
          mrp: product.price.mrp, // Always show MRP from product
          cash:
            userBargain.offeredIn === "cash"
              ? userBargain.offeredPrice
              : product.price.cash?.enteredAmount || null,
          coin:
            userBargain.offeredIn === "coin"
              ? userBargain.offeredPrice
              : product.price.coin?.enteredAmount || null,
          mix: {
            cash:
              userBargain.offeredIn === "mix"
                ? userBargain.sellerReceives?.cash || product.price.mix?.enteredCash || null
                : product.price.mix?.enteredCash || null,
            coin:
              userBargain.offeredIn === "mix"
                ? userBargain.sellerReceives?.coin || product.price.mix?.enteredCoin || null
                : product.price.mix?.enteredCoin || null,
          },
        };
      }
    }

    res.json({
      success: true,
      productId,
      product, // Includes all product details
      finalPrice, // Includes price details (with or without bargain)
    });

  } catch (error) {
    console.error("Error fetching product details and price:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
