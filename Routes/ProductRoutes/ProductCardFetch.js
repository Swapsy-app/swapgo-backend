const express = require("express");
const Product = require("../../Models/ProductModels/Product");
const User = require("../../Models/User");
const router = express.Router();

// Fetch all product cards with pagination (15 per page)
router.get("/products-card-fetch", async (req, res) => {
  try {
    let { page = 1 } = req.query; 
    page = parseInt(page);
    const limit = 15;
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find()
      .select("images brand title size price sellerId")
      .populate({
        path: "sellerId",
        select: "username avatar",
      })
      .skip(skip)
      .limit(limit);

    const formattedProducts = products.map((product) => {
      const price = {
        mrp: product.price.mrp,
        cashPrice: product.price.cash?.enteredAmount || false,
        coinPrice: product.price.coin?.enteredAmount || false,
        mixPrice:
          product.price.mix?.enteredCash && product.price.mix?.enteredCoin
            ? { enteredCash: product.price.mix.enteredCash, enteredCoin: product.price.mix.enteredCoin }
            : false,
        sellerReceivesCash: product.price.cash?.sellerReceivesCash || 0,
        sellerReceivesCoin: product.price.coin?.sellerReceivesCoin || 0,
        sellerReceivesmixCoin: product.price.mix?.sellerReceivesCoin || 0,
        sellerReceivesmixCash: product.price.mix?.sellerReceivesCash || 0,
      };

      return {
        _id: product._id,
        images: product.images?.length ? [product.images[0]] : [], // Fetch only first image
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

    res.json({ success: true, page, totalPages, totalProducts, products: formattedProducts });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch product card by user ID with pagination (latest products first)
router.get("/products-cards/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = 15;
    const skip = (page - 1) * pageSize;

    const products = await Product.find({ sellerId: userId })
      .select("images brand title size price sellerId createdAt")
      .sort({ createdAt: -1 }) // Sorting in descending order (latest first)
      .skip(skip)
      .limit(pageSize)
      .populate({
        path: "sellerId",
        select: "username avatar",
      });

    const formattedProducts = products.map((product) => {
      const price = {
        mrp: product.price.mrp,
        cashPrice: product.price.cash?.enteredAmount || false,
        coinPrice: product.price.coin?.enteredAmount || false,
        mixPrice:
          product.price.mix?.enteredCash && product.price.mix?.enteredCoin
            ? { enteredCash: product.price.mix.enteredCash, enteredCoin: product.price.mix.enteredCoin }
            : false,
        sellerReceivesCash: product.price.cash?.sellerReceivesCash || 0,
        sellerReceivesCoin: product.price.coin?.sellerReceivesCoin || 0,
        sellerReceivesmixCoin: product.price.mix?.sellerReceivesCoin || 0,
        sellerReceivesmixCash: product.price.mix?.sellerReceivesCash || 0,
      };

      return {
        _id: product._id,
        images: product.images?.length ? [product.images[0]] : [], // Fetch only first image
        brand: product.brand || null,
        title: product.title,
        size: product.size || null,
        price,
        seller: {
          username: product.sellerId?.username || "Unknown",
          avatar: product.sellerId?.avatar || null,
        },
        createdAt: product.createdAt, // Keeping track of creation date
      };
    });

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
