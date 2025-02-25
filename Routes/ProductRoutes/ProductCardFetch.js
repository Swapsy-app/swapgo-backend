const express = require("express");
const Product = require("../../Models/ProductModels/Product");
const User = require("../../Models/User");
const router = express.Router();

//product card fetch for all purpose with filter and sort
router.get("/products-card-fetch", async (req, res) => {
  try {
    let { page = 1, sort, priceType, minPrice, maxPrice, search, ...filters } = req.query;
    page = parseInt(page);
    const limit = 15;
    const skip = (page - 1) * limit;

    let query = { status: { $ne: "unavailable" } };

    // Apply filters
    if (filters.status) query.status = filters.status;
    if (filters.condition) query.condition = filters.condition;
    if (filters.brand) query.brand = new RegExp(filters.brand, "i"); // Case-insensitive
    if (filters.fabric) query.fabric = filters.fabric;
    if (filters.color) query.color = filters.color;
    if (filters.occasion) query.occasion = filters.occasion;

// Size Filters
if (filters.sizeString) query["size.sizeString"] = filters.sizeString;
if (filters.freeSize) query["size.freeSize"] = filters.freeSize === "true"; // Convert to boolean
if (filters.sizeAttributeName && filters.sizeAttributeValue) {
  query["size.attributes"] = { 
    $elemMatch: { 
      name: filters.sizeAttributeName, 
      value: filters.sizeAttributeValue 
    } 
  };
}

if (filters.primaryCategory) query["category.primaryCategory"] = new RegExp(filters.primaryCategory, "i"); // Case-insensitive
if (filters.secondaryCategory) query["category.secondaryCategory"] = new RegExp(filters.secondaryCategory, "i"); // Case-insensitive
if (filters.tertiaryCategory) query["category.tertiaryCategory"] = new RegExp(filters.tertiaryCategory, "i"); // Case-insensitive
    

// Apply price range filter based on priceType and ensure non-empty values
if (priceType && ["cash", "coin", "mix"].includes(priceType)) {
  let priceField;

  if (priceType === "cash") {
    priceField = "price.cash.enteredAmount";
    query[priceField] = { $exists: true, $ne: null }; // Ensure cash amount exists
    if (minPrice) query[priceField].$gte = parseFloat(minPrice);
    if (maxPrice) query[priceField].$lte = parseFloat(maxPrice);
  } else if (priceType === "coin") {
    priceField = "price.coin.enteredAmount";
    query[priceField] = { $exists: true, $ne: null }; // Ensure coin amount exists
    if (minPrice) query[priceField].$gte = parseFloat(minPrice);
    if (maxPrice) query[priceField].$lte = parseFloat(maxPrice);
  } else if (priceType === "mix") {
    // Ensure mixCash and mixCoin exist
    query["$and"] = [
      { "price.mix.enteredCash": { $exists: true, $ne: null } },
      { "price.mix.enteredCoin": { $exists: true, $ne: null } }
    ];

    let mixCashConditions = {};
    let mixCoinConditions = {};

    if (req.query.minCashMix) mixCashConditions.$gte = parseFloat(req.query.minCashMix);
    if (req.query.maxCashMix) mixCashConditions.$lte = parseFloat(req.query.maxCashMix);
    if (req.query.minCoinMix) mixCoinConditions.$gte = parseFloat(req.query.minCoinMix);
    if (req.query.maxCoinMix) mixCoinConditions.$lte = parseFloat(req.query.maxCoinMix);

    let orConditions = [];
    if (Object.keys(mixCashConditions).length > 0) {
      orConditions.push({ "price.mix.enteredCash": mixCashConditions });
    }
    if (Object.keys(mixCoinConditions).length > 0) {
      orConditions.push({ "price.mix.enteredCoin": mixCoinConditions });
    }

    if (orConditions.length > 0) {
      query["$and"].push({ $or: orConditions });
    }
  }
}

// Search Feature (Case-Insensitive + Prioritized Fuzzy Search)
if (search) {
  const searchWords = search.trim().split(/\s+/); // Split by spaces
  const searchRegexArray = searchWords.map(word => new RegExp(word, "i"));

  query["$or"] = [
    { title: { $all: searchRegexArray } }, // Prioritize full match of all words in title
    { brand: { $all: searchRegexArray } },
    { "category.primaryCategory": { $all: searchRegexArray } },
    { "category.secondaryCategory": { $all: searchRegexArray } },
    { "category.tertiaryCategory": { $all: searchRegexArray } },
  ];

  // If no results for full matches, allow partial matches (at least one word)
  const partialMatchQuery = {
    "$or": searchWords.flatMap(word => [
      { title: new RegExp(word, "i") },
      { brand: new RegExp(word, "i") },
      { "category.primaryCategory": new RegExp(word, "i") },
      { "category.secondaryCategory": new RegExp(word, "i") },
      { "category.tertiaryCategory": new RegExp(word, "i") }
    ])
  };

  // Check if there are full matches, else use partial match query
  const exactMatchCount = await Product.countDocuments(query);
  if (exactMatchCount === 0) {
    query = partialMatchQuery;
  }
}

    // Sorting logic
    let sortQuery = {};
    if (sort === "newest") sortQuery.createdAt = -1;
    else if (sort === "oldest") sortQuery.createdAt = 1;
    else if (sort === "priceLowToHigh" && priceType) sortQuery[`price.${priceType}.enteredAmount`] = 1;
    else if (sort === "priceHighToLow" && priceType) sortQuery[`price.${priceType}.enteredAmount`] = -1;

    // Count total products matching the query
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch products
    const products = await Product.find(query)
      .select("images brand title size price sellerId createdAt")
      .populate({ path: "sellerId", select: "username avatar" })
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    // Format products
    const formattedProducts = products.map((product) => ({
      _id: product._id,
      images: product.images?.length ? [product.images[0]] : [],
      brand: product.brand || null,
      title: product.title,
      size: product.size || null,
      price: {
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
      },
      seller: {
        username: product.sellerId?.username || "Unknown",
        avatar: product.sellerId?.avatar || null,
      },
    }));

    res.json({ success: true, page, totalPages, totalProducts, products: formattedProducts });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Fetch product card by user ID with pagination (latest products first)
router.get("/products-cards/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; // Get status from query params
    const page = parseInt(req.query.page) || 1;
    const pageSize = 15;
    const skip = (page - 1) * pageSize;

    // Define query with sellerId
    let query = { sellerId: userId };

    // Apply status filter if provided
    if (status) {
      query.status = status; // Assuming status is a string like "active", "sold", etc.
    }

    const products = await Product.find(query)
      .select("images brand title size price sellerId createdAt status") // Include status in selection
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
        status: product.status, // Include status in response
        createdAt: product.createdAt, // Keeping track of creation date
      };
    });

    const totalProducts = await Product.countDocuments(query);

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
