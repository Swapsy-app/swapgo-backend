const express = require("express");
const router = express.Router();
const Product = require("../../Models/ProductModels/Product");
const authenticateToken = require("../../Modules/authMiddleware");
const User = require("../../Models/User");
const { uploadImage, uploadVideo } = require("../../Modules/cloudinaryConfig");

// ----------------------------------------------------------------
// 1. Endpoint to upload media files (images and video)
//    - Expects multipart/form-data with keys "images" and "video"
//    - Returns the Cloudinary URLs for the uploaded media
// -----------------------------------------------------------------
router.post(
  "/upload-images",
  authenticateToken,
  uploadImage.array("images", 7),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }

      // Extract Cloudinary URLs
      const imageUrls = req.files.map((file) => file.path);

      res.status(200).json({
        message: "Images uploaded successfully",
        images: imageUrls,
      });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: "Error uploading images" });
    }
  }
);

// Route to upload a video (single video)
router.post(
  "/upload-video",
  authenticateToken,
  uploadVideo.single("video"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video uploaded" });
      }

      // Extract Cloudinary URL
      const videoUrl = req.file.path;

      res.status(200).json({
        message: "Video uploaded successfully",
        video: videoUrl,
      });
    } catch (error) {
      console.error("Video upload error:", error);
      res.status(500).json({ error: "Error uploading video" });
    }
  }
);

// -------------------------------------------------------------------------
// 2. Endpoint to add a new product using JSON data
//    - Expects JSON body with all other product details
//    - The JSON should include media URLs (returned from /upload-media)
// -------------------------------------------------------------------------
router.post("/add-product", authenticateToken, async (req, res) => {
  try {
    const productData = req.body;
    productData.sellerId = req.user.id; // Extract seller ID from JWT
    
    // Fetch GST number from user profile
    const user = await User.findById(req.user.id);
    productData.gstNumber = user?.gstNumber || "";
    
    // Check if addressId is provided, else get the default address for the user
    if (!productData.addressId) {
      const defaultAddress = await Address.findOne({ userId: req.user.id, isDefault: true });
      productData.addressId = defaultAddress ? defaultAddress._id : "";
    }

    const product = new Product(productData);
    await product.save();
    
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});



//  Edit a product
router.put("edit-product/:id", authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (product.sellerId.toString() !== req.user.id) return res.status(403).json({ success: false, message: "Unauthorized" });

    Object.assign(product, req.body);
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


// Delete a product
router.delete("/delete-product/:id", authenticateToken, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

//Fetch all product
router.get("/fetch-all-product", async (req, res) => {
  try {
    const products = await Product.find(req.query);
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch a single product by ID
router.get("fetch-all-product-user/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch all product card with pagination (15 per page)
router.get("/products-card-fetch", async (req, res) => {
  try {
    let { page = 1 } = req.query; // Get page number from query, default to 1
    page = parseInt(page);
    const limit = 15;
    const skip = (page - 1) * limit;

    // Fetch products with selected fields
    const products = await Product.find()
      .select("images brand title size price sellerId") // Fetch only required fields
      .populate({
        path: "sellerId",
        select: "username avatar", // Fetch username & avatar from User model
      })
      .skip(skip)
      .limit(limit);

    // Format response
    const formattedProducts = products.map((product) => {
      const price = {
        mrp: product.price.mrp,
        cashAvailable: product.price.cash?.enteredAmount
          ? product.price.cash.enteredAmount
          : false,
        coinAvailable: product.price.coin?.enteredAmount
          ? product.price.coin.enteredAmount
          : false,
        mixAvailable:
          product.price.mix?.enteredCash && product.price.mix?.enteredCoin
            ? { enteredCash: product.price.mix.enteredCash, enteredCoin: product.price.mix.enteredCoin }
            : false,
      };

      return {
        _id: product._id,
        images: product.images,
        brand: product.brand || null,
        title: product.title,
        size: product.size || null,
        price,
        seller: {
          username: product.sellerId?.username || "Unknown",
          avatar: product.sellerId?.avatar || null,
        },
      };
    });

    res.json({ success: true, page, products: formattedProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//to get product card by user id

router.get("/products-cards/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1; // Get the page number from query parameter, default to 1 if not provided
    const pageSize = 15; // Number of products per page

    // Calculate the skip value based on the page number
    const skip = (page - 1) * pageSize;

    // Fetch products belonging to the given userId with pagination
    const products = await Product.find({ sellerId: userId })
      .select("images brand title size price sellerId") // Fetch only required fields
      .skip(skip) // Skip products based on the page
      .limit(pageSize) // Limit the number of products per page
      .populate({
        path: "sellerId",
        select: "username avatar", // Fetch username & avatar from User model
      });

    // Format response
    const formattedProducts = products.map((product) => {
      const price = {
        mrp: product.price.mrp,
        cashAvailable: product.price.cash?.enteredAmount
          ? product.price.cash.enteredAmount
          : false,
        coinAvailable: product.price.coin?.enteredAmount
          ? product.price.coin.enteredAmount
          : false,
        mixAvailable:
          product.price.mix?.enteredCash && product.price.mix?.enteredCoin
            ? { enteredCash: product.price.mix.enteredCash, enteredCoin: product.price.mix.enteredCoin }
            : false,
      };

      return {
        _id: product._id,
        images: product.images,
        brand: product.brand || null,
        title: product.title,
        size: product.size || null,
        price,
        seller: {
          username: product.sellerId?.username || "Unknown",
          avatar: product.sellerId?.avatar || null,
        },
      };
    });

    // Count the total number of products to determine total pages
    const totalProducts = await Product.countDocuments({ sellerId: userId });

    res.json({
      success: true,
      userId,
      products: formattedProducts,
      totalProducts,
      totalPages: Math.ceil(totalProducts / pageSize),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



module.exports = router;
