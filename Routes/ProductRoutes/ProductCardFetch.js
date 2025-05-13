const express = require("express");
const Product = require("../../Models/ProductModels/Product");
const User = require("../../Models/User");
const router = express.Router();

//fetch product card with filter, sort and search
router.get("/products-card-fetch", async (req, res) => {
  try {
    let { page = 1, sort, priceType, minPrice, maxPrice, search, ...filters } = req.query;
    page = parseInt(page);
    const limit = 15;
    const skip = (page - 1) * limit;

    let query = { status: { $in: ["available", "sold"] } };

    // Apply filters
    if (filters.status) {
      const statusList = filters.status.split(",");
      query.status = { $in: statusList };
    }
    if (filters.condition) {
      const conditionList = filters.condition.split(",");
      query.condition = { $in: conditionList };
    }
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

    // if (filters.primaryCategory) query["category.primaryCategory"] = new RegExp(filters.primaryCategory, "i"); // Case-insensitive
    // if (filters.secondaryCategory) query["category.secondaryCategory"] = new RegExp(filters.secondaryCategory, "i"); // Case-insensitive
    // if (filters.tertiaryCategory) query["category.tertiaryCategory"] = new RegExp(filters.tertiaryCategory, "i"); // Case-insensitive

    if (filters.primaryCategory) {
      const primaryCategories = filters.primaryCategory.split(",").map(cat => new RegExp(cat, "i"));
      query["category.primaryCategory"] = { $in: primaryCategories };
    }
    
    if (filters.secondaryCategory) {
      const secondaryCategories = filters.secondaryCategory.split(",").map(cat => new RegExp(cat, "i"));
      query["category.secondaryCategory"] = { $in: secondaryCategories };
    }
    
    if (filters.tertiaryCategory) {
      const tertiaryCategories = filters.tertiaryCategory.split(",").map(cat => new RegExp(cat, "i"));
      query["category.tertiaryCategory"] = { $in: tertiaryCategories };
    }

    if (filters.combinedCategory) {
      // Split the incoming comma-separated values, convert them to lowercase, and trim whitespace.
      const combinedValues = filters.combinedCategory
        .split(",")
        .map(val => val.trim().toLowerCase());
    
      // Use $expr to compute a concatenated string from category.primaryCategory and category.tertiaryCategory
      query.$expr = {
        $in: [
          {
            $toLower: {
              $concat: ["$category.primaryCategory", "_", "$category.tertiaryCategory"]
            }
          },
          combinedValues
        ]
      };
    }
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

    // Search feature
    if (search) {
      const searchWords = search.trim().split(/\s+/);

      // First Attempt: Full-Text Search (If Indexed)
      query["$text"] = { $search: search };

      // Count matching documents (To check if $text search works)
      const textMatchCount = await Product.countDocuments(query);

      // If no results from full-text, use regex fallback
      if (textMatchCount === 0) {
        delete query["$text"]; // Remove conflicting $text search

        query["$or"] = searchWords.flatMap(word => [
          { title: { $regex: new RegExp(word, "i") } },
          { brand: { $regex: new RegExp(word, "i") } },
          { "category.primaryCategory": { $regex: new RegExp(word, "i") } },
          { "category.secondaryCategory": { $regex: new RegExp(word, "i") } },
          { "category.tertiaryCategory": { $regex: new RegExp(word, "i") } }
        ]);
      }
    }

    // Dynamic sort object
    let sortObj = {
      isLowView: -1,
      isNew: -1,
      random: 1,
      createdAt: -1
    };

    if (sort) {
      const direction = sort.includes("lowToHigh") ? 1 : -1;

      if (sort.includes("views")) {
        sortObj = { views: direction };
      } else if (priceType === "cash" && sort.includes("price")) {
        sortObj = { "price.cash.enteredAmount": direction };
      } else if (priceType === "coin" && sort.includes("price")) {
        sortObj = { "price.coin.enteredAmount": direction };
      } else if (priceType === "mix" && sort.includes("price")) {
        // Sorting by total value of mix price (enteredCash + enteredCoin)
        sortObj = {
          $add: [
            { $ifNull: ["$price.mix.enteredCash", 0] },
            { $ifNull: ["$price.mix.enteredCoin", 0] }
          ]
        };
      }
    }
    
    // Fetch products with aggregation
    const products = await Product.aggregate([
      { $match: query },
      { $addFields: { random: { $rand: {} } } },
      {
        $addFields: {
          isNew: {
            $gte: ["$createdAt", new Date(Date.now() - 3 * 7 * 24 * 60 * 60 * 1000)]
          },
          isLowView: { $lt: ["$views", 100] }
        }
      },
      ...(sort && priceType === "mix" && sort.includes("price") ? [
        {
          $addFields: {
            mixTotal: {
              $add: [
                { $ifNull: ["$price.mix.enteredCash", 0] },
                { $ifNull: ["$price.mix.enteredCoin", 0] }
              ]
            }
          }
        },
        { $sort: { mixTotal: sort.includes("lowToHigh") ? 1 : -1 } }
      ] : [
        { $sort: sortObj }
      ])
    ]);

    // Separate products into high-view and low-view sets
    const lowViewProducts = products.filter(product => product.isLowView);
    const highViewProducts = products.filter(product => !product.isLowView);

    // Shuffle each set
    const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);
    const shuffledLowViewProducts = shuffleArray(lowViewProducts);
    const shuffledHighViewProducts = shuffleArray(highViewProducts);

    // Mix the sets in the desired ratio (70% low-view, 30% high-view)
    const mixedProducts = [];
    const lowViewCount = Math.ceil(0.7 * limit);
    const highViewCount = limit - lowViewCount;

    for (let i = 0; i < lowViewCount && i < shuffledLowViewProducts.length; i++) {
      mixedProducts.push(shuffledLowViewProducts[i]);
    }
    for (let i = 0; i < highViewCount && i < shuffledHighViewProducts.length; i++) {
      mixedProducts.push(shuffledHighViewProducts[i]);
    }

    // Prioritize new products (created within the last 3 weeks)
    const newProducts = mixedProducts.filter(product => product.isNew);
    const oldProducts = mixedProducts.filter(product => !product.isNew);

    // Combine and shuffle the final list
    const finalProducts = shuffleArray([...newProducts, ...oldProducts]);

    // Paginate the final list
    const paginatedProducts = finalProducts.slice(skip, skip + limit);

    // Format products
    const formattedProducts = paginatedProducts.map((product) => ({
      _id: product._id,
      images: product.images?.length ? [product.images[0]] : [],
      brand: product.brand || null,
      title: product.title,
      size: product.size || null,
      price: {
        mrp: product.price.mrp,
        cashPrice: product.price.cash?.enteredAmount,
        coinPrice: product.price.coin?.enteredAmount,
        mixPrice:
          product.price.mix?.enteredCash && product.price.mix?.enteredCoin
            ? { enteredCash: product.price.mix.enteredCash, enteredCoin: product.price.mix.enteredCoin }
            : null,
        sellerReceivesCash: product.price.cash?.sellerReceivesCash || 0,
        sellerReceivesCoin: product.price.coin?.sellerReceivesCoin || 0,
        sellerReceivesmixCoin: product.price.mix?.sellerReceivesCoin || 0,
        sellerReceivesmixCash: product.price.mix?.sellerReceivesCash || 0,
      },
      seller: {
        username: product.sellerId?.username || "Unknown",
        avatar: product.sellerId?.avatar || null,
      },
      views: product.views, // Include views in the response for verification
    }));
    res.json({ success: true, page, totalPages: Math.ceil(products.length / limit), totalProducts: products.length, products: formattedProducts });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Autocomplete route for search suggestion based on brand and primary/tertiary category
router.get("/autocomplete", async (req, res) => {
  const { search } = req.query;

  if (!search) return res.json({ suggestions: [] });

  try {
    const searchWords = search.trim().split(/\s+/);

    // Create case-insensitive regex for each word
    const regexArray = searchWords.map(word => new RegExp(word, "i")); 

    const suggestions = await Product.find({
      $or: [
        { brand: { $in: regexArray } },
        { "category.primaryCategory": { $in: regexArray } },
        { "category.tertiaryCategory": { $in: regexArray } }
      ]
    }).select("brand category").limit(5);

    // Extract unique suggestions excluding secondary category
    const uniqueSuggestions = new Set();
    
    suggestions.forEach(item => {
      if (item.brand) uniqueSuggestions.add(item.brand);
      if (item.category?.primaryCategory) uniqueSuggestions.add(item.category.primaryCategory);
      if (item.category?.tertiaryCategory) uniqueSuggestions.add(item.category.tertiaryCategory);
    });

    res.json({ suggestions: Array.from(uniqueSuggestions) });
  } catch (error) {
    console.error("Error fetching autocomplete:", error);
    res.status(500).json({ error: "Internal server error" });
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
