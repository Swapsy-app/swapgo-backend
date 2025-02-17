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

// Fetch wishlisted products with sorting, filtering, and pagination
router.get("/fetch-wishlist", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        let { page = 1, sort, status, condition, category, priceType, minPrice, maxPrice } = req.query;

        page = parseInt(page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Fetch wishlisted product IDs sorted by latest wishlisted first
        const wishlistItems = await WishlistItem.find({ userId }).sort({ createdAt: -1 });
        const productIdToWishlistMap = {};
        wishlistItems.forEach(item => {
            productIdToWishlistMap[item.productId.toString()] = item._id; // Map productId to wishlistId
        });

        const productIds = wishlistItems.map(item => item.productId.toString()); // Maintain wishlisted order

        if (productIds.length === 0) {
            return res.json({ success: true, products: [], total: 0, page });
        }

        let filter = { _id: { $in: productIds } };

        // Apply filters
        if (status) filter.status = status;
        if (condition) filter.condition = condition;
        if (category) {
            filter.$or = [
                { "category.primaryCategory": category },
                { "category.secondaryCategory": category },
                { "category.tertiaryCategory": category }
            ];
        }

        // Price filter
        if (priceType && ["cash", "coin", "mix"].includes(priceType)) {
            let priceField = `price.${priceType}.enteredAmount`;
            filter[priceField] = { $gte: minPrice || 0 };
            if (maxPrice && maxPrice < 50000) {
                filter[priceField].$lte = maxPrice;
            }
        }

        // Sorting logic
        let sortOptions = {};
        if (sort === "newest") {
            sortOptions.createdAt = -1; // Sort by latest posted products
        } else if (sort === "oldest") {
            sortOptions.createdAt = 1; // Sort by oldest posted products
        }

        // Fetch products with selected fields
        let products = await Product.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .select("images title brand size price sellerId status createdAt");

        // Fetch seller details (user avatar and username)
        const sellerIds = [...new Set(products.map(p => p.sellerId))]; // Get unique seller IDs
        const sellers = await User.find({ _id: { $in: sellerIds } }).select("avatar username");

        // Map seller details to products
        const sellerMap = {};
        sellers.forEach(seller => {
            sellerMap[seller._id.toString()] = { avatar: seller.avatar, username: seller.username };
        });

        // If no explicit sorting is applied, maintain wishlist order
        if (!sort) {
            products = productIds
                .map(productId => products.find(p => p._id.toString() === productId))
                .filter(product => product !== undefined); // Remove any undefined entries
        }

        const finalProducts = products.map(product => ({
            productId: product._id,
            wishlistId: productIdToWishlistMap[product._id.toString()], // Get wishlist ID from map
            image: product.images[0], // First image only
            title: product.title,
            brand: product.brand,
            size: product.size,
            price: product.price,
            status: product.status, // Include status
            seller: sellerMap[product.sellerId.toString()] || null, // Attach seller details
            createdAt: product.createdAt
        }));

        res.json({
            success: true,
            products: finalProducts,
            total: await Product.countDocuments(filter),
            page,
            totalPages: Math.ceil(await Product.countDocuments(filter) / limit)
        });
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
