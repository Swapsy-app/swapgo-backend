const express = require("express");
const router = express.Router();
const WishlistItem = require("../../Models/ProductModels/wishlist");
const authenticateToken = require("../../Modules/authMiddleware");
const User = require("../../Models/User");
const Product = require("../../Models/ProductModels/Product");

// Add product to wishlist
router.post("/add-wishlist", authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Ensure product is not already in wishlist
    const exists = await WishlistItem.findOne({ userId, productId });
    if (exists) {
      return res.status(400).json({ message: "Product is already in wishlist" });
    }

    const wishlistItem = new WishlistItem({ userId, productId });
    await wishlistItem.save();

    res.json({ success: true, message: "Product added to wishlist" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove product from wishlist
router.post("/remove-wishlist", authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    await WishlistItem.deleteOne({ userId, productId });

    res.json({ success: true, message: "Product removed from wishlist" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's wishlist with sorting and filtering
router.get("/wishlist-fetch", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
  
      // Sorting and filtering options from query params
      const { sort, primaryCategory, secondaryCategory, tertiaryCategory, condition, status } = req.query;
  
      // Fetch wishlist items for the user
      let wishlist = await WishlistItem.find({ userId }).populate({
        path: "productId",
        model: Product, // ✅ Explicitly specify the Product model
        select: "images title brand size price status condition category createdAt updatedAt",
      });
  
      // Filter out null values (cases where productId was removed)
      wishlist = wishlist.filter(item => item.productId);
  
      // Apply filters manually
      if (primaryCategory) wishlist = wishlist.filter(item => item.productId.category.primaryCategory === primaryCategory);
      if (secondaryCategory) wishlist = wishlist.filter(item => item.productId.category.secondaryCategory === secondaryCategory);
      if (tertiaryCategory) wishlist = wishlist.filter(item => item.productId.category.tertiaryCategory === tertiaryCategory);
      if (condition) wishlist = wishlist.filter(item => item.productId.condition === condition);
      if (status) wishlist = wishlist.filter(item => item.productId.status === status);
  
      // Sorting logic
      if (sort === "newest") wishlist.sort((a, b) => b.productId.createdAt - a.productId.createdAt);
      if (sort === "oldest") wishlist.sort((a, b) => a.productId.createdAt - b.productId.createdAt);
      if (sort === "lowToHigh") wishlist.sort((a, b) => a.productId.price.mrp - b.productId.price.mrp);
      if (sort === "highToLow") wishlist.sort((a, b) => b.productId.price.mrp - a.productId.price.mrp);
  
      // Transform response to return structured data
      const transformedWishlist = wishlist.map((item) => ({
        productId: item.productId._id,
        title: item.productId.title,
        brand: item.productId.brand,
        size: item.productId.size,
        price: item.productId.price,
        status: item.productId.status,
        condition: item.productId.condition,
        category: item.productId.category,
        createdAt: item.productId.createdAt,
        updatedAt: item.productId.updatedAt,
        image: item.productId.images.length > 0 ? item.productId.images[0] : null,
      }));
  
      res.json({ success: true, wishlist: transformedWishlist });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });


  // Get wishlist count for a specific product
router.get("/wishlist-count/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
  
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }
  
      const wishlistCount = await WishlistItem.countDocuments({ productId });
  
      res.json({
        success: true,
        wishlistCount, // This directly represents the number of users who have wishlisted it
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  

module.exports = router;
