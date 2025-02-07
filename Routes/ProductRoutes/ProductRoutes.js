const express = require("express");
const router = express.Router();
const Product = require("../../Models/ProductModels/Product");
const authenticateToken = require("../../Modules/authMiddleware");
const User = require("../../Models/User");
const Address = require("../../Models/ProductModels/address");
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

    // Check if pickupAddress is provided, else get the default address for the user
    if (!productData.pickupAddress) { 
      const defaultAddress = await Address.findOne({ userId: req.user.id, defaultAddress: true });

      if (!defaultAddress) {
        return res.status(400).json({ success: false, message: "No default address found. Please provide a pickup address." });
      }

      productData.pickupAddress = defaultAddress._id; // Ensure ObjectId is stored
    }

    const product = new Product(productData);
    await product.save();
    
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

//  Edit a product
router.put("/edit-product/:id", authenticateToken, async (req, res) => {
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

module.exports = router;
