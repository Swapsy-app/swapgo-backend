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

  // Ensure status is set to "available" if not provided
  productData.status = productData.status || "available";
  productData.quantityMode = Number(productData.quantity) > 1 ? true : false;
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

    delete req.body.quantityMode; // Prevent changing quantityMode

    Object.assign(product, req.body);
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------
// 4. Change product status to "unavailable" or "Availaible"
// ----------------------------------------------------------------
router.patch("/product/:id/toggle-availability", authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (product.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Toggle status
    product.status = product.status === "available" ? "unavailable" : "available";
    
    await product.save();
    res.json({ 
      success: true, 
      message: `Product status set to ${product.status}`, 
      product 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});


// 🔁 Toggle available/sold status if quantityMode is true
router.patch("/toggle-status-if-quantity-mode/:id", authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (!product.quantityMode) {
      return res.status(400).json({ success: false, message: "Toggle not allowed: quantityMode is false" });
    }

    const currentStatus = product.status;

    if (currentStatus === "available") {
      // Toggling to 'sold'
      product.status = "sold";
      product.quantity = 0;
    } else if (currentStatus === "sold") {
      // Toggling to 'available' - require quantity in request body
      const { quantity } = req.body;
      if (!quantity || quantity < 1) {
        return res.status(400).json({ success: false, message: "Quantity must be at least 1 to mark as available" });
      }
      product.status = "available";
      product.quantity = quantity;
    } else {
      return res.status(400).json({ success: false, message: `Toggle not supported for status: ${currentStatus}` });
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: `Product status toggled to ${product.status}`,
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 🔒 Delete product only if not sold and never purchased
router.delete("/delete-product/:id", authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.status === "sold") {
      return res.status(400).json({ error: "Cannot delete a product that is marked as sold" });
    }

    if (product.quantitySold > 0) {
      return res.status(400).json({ error: "Cannot delete a product that has been sold even once" });
    }

    await product.deleteOne();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
