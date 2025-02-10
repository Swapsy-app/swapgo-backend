const express = require("express");
const mongoose = require("mongoose");
const authenticateToken = require("../../Modules/authMiddleware");
const Product = require("../../Models/ProductModels/Product"); // Import Product Schema
const Bargain = require("../../Models/ProductModels/Bargain"); // Import Bargain Schema
const User = require("../../Models/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Make a bargain
router.post("/bargain-offer/:productId", authenticateToken, async (req, res) => {
  try {
      const { productId } = req.params;
      const { offeredPrice, offeredIn, sellerReceives, message } = req.body;
      const buyerId = req.user.id;

      if (!["cash", "coin"].includes(offeredIn)) {
          return res.status(400).json({ message: "Bargain can only be in cash or coin." });
      }

      if (!sellerReceives) {
          return res.status(400).json({ message: "sellerReceives is required." });
      }

      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const sellerId = product.sellerId;

      // Prevent sellers from bargaining on their own product
      if (sellerId.toString() === buyerId) {
          return res.status(403).json({ message: "You cannot bargain on your own product." });
      }

      // Check if bargain already exists
      const existingBargain = await Bargain.findOne({ productId, buyerId });
      if (existingBargain) {
          return res.status(400).json({ message: "You already made an offer. Use PUT to edit it." });
      }

      // Create a new bargain
      const bargain = await Bargain.create({
          productId,
          sellerId,
          buyerId,
          offeredPrice,
          offeredIn,
          sellerReceives,
          message,
          status: "pending",
      });

      return res.status(201).json({ message: "Bargain created successfully", bargain });
  } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a bargain
router.put("/bargain-update/:productId", authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { offeredPrice, offeredIn, message, sellerReceives } = req.body; // Include sellerReceives
    const buyerId = req.user.id;

    if (!["cash", "coin"].includes(offeredIn)) {
      return res.status(400).json({ message: "Bargain can only be in cash or coin." });
    }

    const bargain = await Bargain.findOne({ productId, buyerId });
    if (!bargain) {
      return res.status(404).json({ message: "No existing bargain found. Use POST to create one." });
    }

    // Prevent modification if already accepted
    if (bargain.status === "accepted") {
      return res.status(400).json({ message: "Your offer has already been accepted and cannot be modified." });
    }

    // Update the bargain fields
    bargain.offeredPrice = offeredPrice;
    bargain.offeredIn = offeredIn;
    bargain.sellerReceives = sellerReceives; // Update sellerReceives
    bargain.message = message;
    bargain.status = "pending"; // Reset to pending after update

    await bargain.save();
    return res.status(200).json({ message: "Bargain updated successfully", bargain });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all bargains for a product (seller/public) for product page with pagination and sorting
router.get("/seller-bargain-fetch/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { status, page = 1 } = req.query;
    const limit = 10; // Limit per page
    const skip = (page - 1) * limit;

    // Extract user ID from token (if provided)
    let userId = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]; // Extract token
      try {
        const decoded = jwt.verify(token, process.env.JWT_TOKEN);
        userId = decoded.id; // Extract user ID from decoded token
        console.log("Decoded User ID:", userId); // Debugging
      } catch (error) {
        console.log("Invalid token:", error.message);
      }
    }

    // Find the product to check sellerId
    const product = await Product.findById(productId).select("sellerId").exec();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    console.log("Product Seller ID:", product.sellerId.toString()); // Debugging

    // Determine user type (seller, buyer, or public)
    let userType = "public"; // Default is public
    const isSeller = userId && product.sellerId.toString() === userId;
    if (isSeller) {
      userType = "seller";
    }

    // Fetch all bargains for the product
    let filter = { productId };
    if (status) {
      filter.status = status;
    }

    let allBargains = await Bargain.find(filter)
      .populate("buyerId", "username avatar") // Fetch only username and avatar from User model
      .sort({ createdAt: -1 }) // Fetch latest first
      .exec();

    if (allBargains.length === 0) {
      return res.status(200).json({ message: "No bargains found", userType, bargains: [] });
    }

    // Check if the user is a buyer
    let buyerOffer = null;
    if (userId) {
      buyerOffer = allBargains.find(bargain => bargain.buyerId._id.toString() === userId);
      if (buyerOffer) {
        userType = "buyer"; // If found, user is a buyer
      }
    }

    // Separate offers by status
    let pendingOffers = allBargains.filter(bargain => bargain.status === "pending");
    let acceptedOffers = allBargains.filter(bargain => bargain.status === "accepted");

    // If user is a buyer, remove their offer from pending/accepted to avoid duplication
    if (userType === "buyer" && buyerOffer) {
      pendingOffers = pendingOffers.filter(bargain => bargain._id.toString() !== buyerOffer._id.toString());
      acceptedOffers = acceptedOffers.filter(bargain => bargain._id.toString() !== buyerOffer._id.toString());
    }

    // Organize offers:
    let sortedBargains = [];
    if (userType === "buyer" && buyerOffer) {
      sortedBargains.push(buyerOffer); // Add buyer's own offer at the top
    }
    sortedBargains.push(...pendingOffers); // Add pending offers sorted latest first
    sortedBargains.push(...acceptedOffers); // Add accepted offers sorted latest first

    // Apply pagination
    const paginatedBargains = sortedBargains.slice(skip, skip + limit);

    // Modify response based on user role
    const formattedBargains = paginatedBargains.map((bargain) => {
      return {
        _id: bargain._id,
        buyerId: bargain.buyerId,
        productId: bargain.productId,
        sellerId: product.sellerId, // Always include seller ID
        offeredIn: bargain.offeredIn, // Always show
        status: bargain.status,
        message: bargain.message,
        // Show `offeredPrice` & `sellerReceives` to sellers & buyers for their own offer
        ...(isSeller || (userType === "buyer" && bargain.buyerId._id.toString() === userId) 
          ? { offeredPrice: bargain.offeredPrice, sellerReceives: bargain.sellerReceives } 
          : {})
      };
    });

    res.status(200).json({
      userType,
      currentPage: Number(page),
      totalBargains: sortedBargains.length,
      hasNextPage: skip + limit < sortedBargains.length,
      bargains: formattedBargains
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// show your offer in profile page
router.get("/buyer-bargain-fetch/user/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1 } = req.query;
    const limit = 10;

    if (req.user.id !== userId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    let filter = { buyerId: userId };
    if (status) {
      filter.status = status;
    }

    const totalBargains = await Bargain.countDocuments(filter);

    const bargains = await Bargain.find(filter)
      .populate({
        path: "productId",
        select: "title images price mrp sellerId",
        populate: {
          path: "sellerId",
          select: "username avatar"
        }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const formattedBargains = bargains.map(bargain => ({
      _id: bargain._id,
      status: bargain.status,
      offeredPrice: bargain.offeredPrice,
      sellerReceives: bargain.sellerReceives,
      product: {
        _id: bargain.productId._id,
        title: bargain.productId.title,
        image: bargain.productId.images?.[0] || null,
        mrp: bargain.productId.price?.mrp || null,
        cashPrice: bargain.productId.price?.cash?.enteredAmount || null,
        coinPrice: bargain.productId.price?.coin?.enteredAmount || null,
        mixPrice: {
          cash: bargain.productId.price?.mix?.enteredCash || null,
          coin: bargain.productId.price?.mix?.enteredCoin || null
        }
      },
      seller: {
        _id: bargain.productId.sellerId._id,
        username: bargain.productId.sellerId.username,
        avatar: bargain.productId.sellerId.avatar
      }
    }));

    res.status(200).json({
      totalPages: Math.ceil(totalBargains / limit),
      currentPage: parseInt(page),
      totalBargains,
      bargains: formattedBargains
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//get all bargain received by a seller
router.get("/seller-bargains/:sellerId", authenticateToken, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { status, page = 1 } = req.query;
    const limit = 10;

    if (req.user.id !== sellerId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    let filter = { sellerId };

    // Apply status filter if provided
    if (status && ["pending", "accepted"].includes(status)) {
      filter.status = status;
    }

    const totalBargains = await Bargain.countDocuments(filter);

    const bargains = await Bargain.find(filter)
      .populate({
        path: "productId",
        select: "title images price",
      })
      .populate({
        path: "buyerId",
        select: "username avatar",
      })
      .sort({
        status: 1, // Sort pending first (since "pending" < "accepted" alphabetically)
        createdAt: -1, // Newest first within each status
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    // Format response
    const formattedBargains = bargains.map((bargain) => ({
      _id: bargain._id,
      status: bargain.status,
      offeredPrice: bargain.offeredPrice,
      sellerReceives: bargain.sellerReceives,
      message: bargain.message,
      product: {
        _id: bargain.productId._id,
        title: bargain.productId.title,
        image: bargain.productId.images?.[0] || null,
        mrp: bargain.productId.price?.mrp || null,
        cashPrice: bargain.productId.price?.cash?.enteredAmount || null,
        coinPrice: bargain.productId.price?.coin?.enteredAmount || null,
        mixPrice: {
          cash: bargain.productId.price?.mix?.enteredCash || null,
          coin: bargain.productId.price?.mix?.enteredCoin || null
        }
      },
      buyer: {
        _id: bargain.buyerId._id,
        username: bargain.buyerId.username,
        avatar: bargain.buyerId.avatar,
      },
      createdAt: bargain.createdAt,
    }));

    res.status(200).json({
      totalPages: Math.ceil(totalBargains / limit),
      currentPage: parseInt(page),
      totalBargains,
      bargains: formattedBargains,
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Accept a bargain (for seller)
router.patch("/accept-bargain/:bargainId", authenticateToken, async (req, res) => {
  try {
    const { bargainId } = req.params;
    const sellerId = req.user.id;

    const bargain = await Bargain.findById(bargainId);
    if (!bargain) return res.status(404).json({ message: "Bargain not found" });

    if (bargain.sellerId.toString() !== sellerId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Check if the bargain is already accepted
    if (bargain.status === "accepted") {
      return res.status(400).json({ message: "Bargain is already accepted." });
    }

    // Mark the offer as accepted
    bargain.status = "accepted";
    await bargain.save();

    res.status(200).json({ message: "Bargain accepted", bargain });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


module.exports = router;
