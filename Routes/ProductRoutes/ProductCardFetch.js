const express = require("express");
const Product = require("../../Models/ProductModels/Product");
const User = require("../../Models/User");

const axios = require("axios");
const jwt = require('jsonwebtoken');
const Address = require("../../Models/ProductModels/address"); // Import User model 

const WishlistItem = require("../../Models/ProductModels/wishlist")
const router = express.Router();
const mongoose = require('mongoose');


// Utility function to normalize zone (D1, D2 → D, etc.)
const normalizeZone = (zone) => {
    if (zone && /^[A-F]\d*$/.test(zone)) {
        return zone.charAt(0); // Extract only the first letter
    }
    return "F"; // Default zone if invalid
};


// Helper function to calculate delivery days for a product
async function calculateDeliveryDays(productId, buyerPincode) {
    try {
        // Fetch product's pickup address (seller's pincode)
        const product = await Product.findById(productId).select("pickupAddress");
        if (!product || !product.pickupAddress) {
            return 9; // Default to maximum days if pickup address not found
        }

        const pickupAddress = await Address.findById(product.pickupAddress).select("pincode");
        if (!pickupAddress || !pickupAddress.pincode) {
            return 9; // Default to maximum days if seller pincode not found
        }
        const sellerPincode = pickupAddress.pincode;

        // Call Delhivery API for zone estimation
        const zoneResponse = await axios.get("https://track.delhivery.com/api/kinko/v1/invoice/charges/.json", {
            params: {
                md: "S",
                o_pin: sellerPincode,
                d_pin: buyerPincode,
                cgm: 500, // Default chargeable weight
                ss: "DTO"
            },
            headers: {
                "Authorization": `Token ${process.env.DELHIVERY_API_KEY}`,
                "Accept": "application/json"
            }
        });

        // Extract and normalize zone
        let deliveryZone = "F"; // Default
        if (zoneResponse.data && Array.isArray(zoneResponse.data) && zoneResponse.data.length > 0) {
            const zoneData = zoneResponse.data[0];
            if (zoneData.zone) {
                deliveryZone = normalizeZone(zoneData.zone.trim());
            }
        }

        // Determine estimated delivery days based on zone
        const zoneDaysMapping = {
            "A": 5,
            "B": 7,
            "C": 9,
            "D": 9,
            "E": 9,
            "F": 9
        };
        return zoneDaysMapping[deliveryZone] || 9;

    } catch (error) {
        console.error("Error calculating delivery days:", error);
        return 9; // Default to maximum days on error
    }
}

// Helper function to process size object
function processSize(size) {
    if (!size) return null;
    
    const attributes = size.attributes || [];
    const freeSize = size.freeSize || false;
    const sizeString = size.sizeString || null;
    
    // Return null if attributes is empty, freeSize is false, and sizeString is null
    if (attributes.length === 0 && freeSize === false && sizeString === null) {
        return null;
    }
    
    return size;
}

// Create a cache to store already sent product IDs
const sentProductsCache = new Set();
router.get("/products-card-fetch", async (req, res) => {
    try {
        let { page = 1, sort, priceType, minPriceCash, maxPriceCash, minPriceCoin, maxPriceCoin, search, limit = 15, seed, resetCache, ...filters } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        // Reset cache if requested or when it's a new search/filter
        if (resetCache === 'true' || page === 1) {
            sentProductsCache.clear();
        }

        // Generate or use provided seed for consistent randomization
        const currentSeed = seed ? parseInt(seed) : Math.floor(Math.random() * 1000000);

        // Get user ID and buyer pincode if authenticated
        const userId = req.query.userId;
        let buyerPincode = null;
        
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(" ")[1];
                const decoded = jwt.verify(token, process.env.JWT_TOKEN);
                const defaultAddress = await Address.findOne({ userId: decoded.id, defaultAddress: true });
                if (defaultAddress && defaultAddress.pincode) {
                    buyerPincode = defaultAddress.pincode;
                }
            } catch (error) {
                console.warn("Invalid or expired token, proceeding without user info.");
                console.warn(error.message);

            }
        }

        let query = { status: { $ne: "unavailable" } };

    // Apply filters
    if (filters.status) {
      const statusList = filters.status.split(",");
      query.status = { $in: statusList };
    }
    if (filters.condition) {
      const conditionList = filters.condition.split(",");
      query.condition = { $in: conditionList };
    }
    if (filters.brand) query.brand = new RegExp(filters.brand, "i");
    if (filters.fabric) query.fabric = filters.fabric;
    if (filters.color) query.color = filters.color;
    if (filters.occasion) query.occasion = filters.occasion;

    // Size Filters
    if (filters.sizeString) query["size.sizeString"] = filters.sizeString;
    if (filters.freeSize) query["size.freeSize"] = filters.freeSize === "true";
    if (filters.sizeAttributeName && filters.sizeAttributeValue) {
      query["size.attributes"] = {
        $elemMatch: {
          name: filters.sizeAttributeName,
          value: filters.sizeAttributeValue
        }
      };
    }

    // Category Filters
    if (filters.primaryCategory) {
      const primaryCategories = filters.primaryCategory.split(",").map(cat => new RegExp(`^${cat}$`, "i"));
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
      const combinedValues = filters.combinedCategory.split(",").map(v => v.trim().toLowerCase());
      query.$expr = {
        $in: [
          { $toLower: { $concat: ["$category.primaryCategory", "_", "$category.tertiaryCategory"] } },
          combinedValues
        ]
      };
    }

    // Price Filters (cash, coin, mix)
    if (priceType) {
      const priceTypes = priceType.split(",");
      
      if (priceTypes.length === 1) {
        // Single price type handling
        if (priceTypes[0] === "cash") {
          const pf = "price.cash.enteredAmount";
          const cashConditions = { $exists: true, $ne: null };
          
          if (minPriceCash || maxPriceCash) {
            if (minPriceCash) cashConditions.$gte = parseFloat(minPriceCash);
            if (maxPriceCash) cashConditions.$lte = parseFloat(maxPriceCash);
          }
          
          query[pf] = cashConditions;
        } 
        else if (priceTypes[0] === "coin") {
          const pf = "price.coin.enteredAmount";
          const coinConditions = { $exists: true, $ne: null };
          
          if (minPriceCoin || maxPriceCoin) {
            if (minPriceCoin) coinConditions.$gte = parseFloat(minPriceCoin);
            if (maxPriceCoin) coinConditions.$lte = parseFloat(maxPriceCoin);
          }
          
          query[pf] = coinConditions;
        } 
        else if (priceTypes[0] === "mix") {
          query.$and = [
            { "price.mix.enteredCash": { $exists: true, $ne: null } },
            { "price.mix.enteredCoin": { $exists: true, $ne: null } }
          ];
          
          const mixFilters = [];
          
          if (req.query.minCashMix || req.query.maxCashMix) {
            const cashMixConditions = {};
            if (req.query.minCashMix) cashMixConditions.$gte = parseFloat(req.query.minCashMix);
            if (req.query.maxCashMix) cashMixConditions.$lte = parseFloat(req.query.maxCashMix);
            mixFilters.push({ "price.mix.enteredCash": cashMixConditions });
          }
          
          if (req.query.minCoinMix || req.query.maxCoinMix) {
            const coinMixConditions = {};
            if (req.query.minCoinMix) coinMixConditions.$gte = parseFloat(req.query.minCoinMix);
            if (req.query.maxCoinMix) coinMixConditions.$lte = parseFloat(req.query.maxCoinMix);
            mixFilters.push({ "price.mix.enteredCoin": coinMixConditions });
          }
          
          if (mixFilters.length > 0) {
            query.$and.push({ $or: mixFilters });
          }
        }
      } 
      else {
        // Multiple price types
        const priceFilters = [];
        
        if (priceTypes.includes("cash")) {
          const cashConditions = { $exists: true, $ne: null };
          if (minPriceCash) cashConditions.$gte = parseFloat(minPriceCash);
          if (maxPriceCash) cashConditions.$lte = parseFloat(maxPriceCash);
          priceFilters.push({ "price.cash.enteredAmount": cashConditions });
        }
        
        if (priceTypes.includes("coin")) {
          const coinConditions = { $exists: true, $ne: null };
          if (minPriceCoin) coinConditions.$gte = parseFloat(minPriceCoin);
          if (maxPriceCoin) coinConditions.$lte = parseFloat(maxPriceCoin);
          priceFilters.push({ "price.coin.enteredAmount": coinConditions });
        }
        
        if (priceTypes.includes("mix")) {
          const mixFilter = {
            $and: [
              { "price.mix.enteredCash": { $exists: true, $ne: null } },
              { "price.mix.enteredCoin": { $exists: true, $ne: null } }
            ]
          };
          
          const mixConditions = [];
          
          if (req.query.minCashMix || req.query.maxCashMix) {
            const cashMixConditions = {};
            if (req.query.minCashMix) cashMixConditions.$gte = parseFloat(req.query.minCashMix);
            if (req.query.maxCashMix) cashMixConditions.$lte = parseFloat(req.query.maxCashMix);
            mixConditions.push({ "price.mix.enteredCash": cashMixConditions });
          }
          
          if (req.query.minCoinMix || req.query.maxCoinMix) {
            const coinMixConditions = {};
            if (req.query.minCoinMix) coinMixConditions.$gte = parseFloat(req.query.minCoinMix);
            if (req.query.maxCoinMix) coinMixConditions.$lte = parseFloat(req.query.maxCoinMix);
            mixConditions.push({ "price.mix.enteredCoin": coinMixConditions });
          }
          
          if (mixConditions.length > 0) {
            mixFilter.$and.push({ $or: mixConditions });
          }
          
          priceFilters.push(mixFilter);
        }
        
        if (priceFilters.length > 0) {
          query.$or = priceFilters;
        }
      }
    }

    // Search
    if (search) {
      const words = search.trim().split(/\s+/);
      query.$text = { $search: search };
      const count = await Product.countDocuments(query);
      if (!count) {
        delete query.$text;
        query.$or = words.flatMap(w => [
          { title: { $regex: new RegExp(w, "i") } },
          { brand: { $regex: new RegExp(w, "i") } },
          { "category.primaryCategory": { $regex: new RegExp(w, "i") } },
          { "category.secondaryCategory": { $regex: new RegExp(w, "i") } },
          { "category.tertiaryCategory": { $regex: new RegExp(w, "i") } }
        ]);
      }
    }

    // Exclude already sent products
        if (sentProductsCache.size > 0) {
            const sentIds = Array.from(sentProductsCache).map(id => new mongoose.Types.ObjectId(id));
            query._id = { $nin: sentIds };
        }

        // Count total products for pagination
        const totalProducts = await Product.countDocuments(query);

        // Get all product IDs that match the query
        let productsQuery = Product.find(query).select('_id createdAt price');
        
        // Apply sorting based on sort parameter
        let shuffledIds;
        
        if (sort === 'fastest-delivery' && buyerPincode) {
            // Handle fastest delivery sorting (existing implementation)
            const allProductIds = await productsQuery.lean();
            const productsWithDeliveryDays = await Promise.all(
                allProductIds.map(async (product) => {
                    const deliveryDays = await calculateDeliveryDays(product._id, buyerPincode);
                    return {
                        _id: product._id.toString(),
                        deliveryDays
                    };
                })
            );
            
            productsWithDeliveryDays.sort((a, b) => a.deliveryDays - b.deliveryDays);
            shuffledIds = productsWithDeliveryDays.map(p => p._id);
        } else {
            // Handle other sorting options
            let sortedProducts;
            
            switch (sort) {
                case 'newest':
                    sortedProducts = await productsQuery.sort({ createdAt: -1 }).lean();
                    break;
                case 'oldest':
                    sortedProducts = await productsQuery.sort({ createdAt: 1 }).lean();
                    break;
                case 'priceCashAsc':
                    sortedProducts = await productsQuery.sort({ 'price.cash.enteredAmount': 1 }).lean();
                    break;
                case 'priceCashDesc':
                    sortedProducts = await productsQuery.sort({ 'price.cash.enteredAmount': -1 }).lean();
                    break;
                case 'priceCoinAsc':
                    sortedProducts = await productsQuery.sort({ 'price.coin.enteredAmount': 1 }).lean();
                    break;
                case 'priceCoinDesc':
                    sortedProducts = await productsQuery.sort({ 'price.coin.enteredAmount': -1 }).lean();
                    break;
                default:
                    // Default randomized sorting
                    const allProductIds = await productsQuery.lean();
                    const deterministicShuffle = (array, seed) => {
                        const seededRandom = (max, min = 0) => {
                            seed = (seed * 9301 + 49297) % 233280;
                            return min + (seed / 233280) * (max - min);
                        };
                        
                        const result = [...array];
                        for (let i = result.length - 1; i > 0; i--) {
                            const j = Math.floor(seededRandom(i + 1));
                            [result[i], result[j]] = [result[j], result[i]];
                        }
                        return result;
                    };
                    
                    shuffledIds = deterministicShuffle(allProductIds.map(p => p._id.toString()), currentSeed);
                    break;
            }
            
            if (sortedProducts) {
                shuffledIds = sortedProducts.map(p => p._id.toString());
            }
        }
        
        // Get the IDs for the current page
        const pageIds = shuffledIds.slice(0, limit).map(id => new mongoose.Types.ObjectId(id));
        
        // Add these IDs to the sent products cache
        pageIds.forEach(id => sentProductsCache.add(id.toString()));
        
        // Fetch the full products for this page
        const paginatedProducts = await Product.find({ _id: { $in: pageIds } })
            .populate('sellerId', '_id username avatar')
            .lean();
        
        // Sort the products to match the order of the shuffled IDs
        const idToIndexMap = {};
        pageIds.forEach((id, index) => {
            idToIndexMap[id.toString()] = index;
        });
        
        paginatedProducts.sort((a, b) => {
            return idToIndexMap[a._id.toString()] - idToIndexMap[b._id.toString()];
        });
        
        // Format the products with delivery information
        const formatted = await Promise.all(paginatedProducts.map(async (p) => {
            // Check if product is wishlisted by current user
            let isWishlisted = false;
            if (userId) {
                const wishlistItem = await WishlistItem.findOne({ 
                    userId, 
                    productId: p._id 
                });
                isWishlisted = !!wishlistItem;
            }
            
            // Calculate delivery days for display (if buyer pincode available)
            let estimatedDeliveryDays = null;
            if (buyerPincode) {
                estimatedDeliveryDays = await calculateDeliveryDays(p._id, buyerPincode);
            }
            
            return {
                _id: p._id,
                images: p.images?.length ? [p.images[0]] : [],
                brand: p.brand || null,
                title: p.title,
                size: processSize(p.size),
                price: {
                    mrp: p.price.mrp,
                    cashPrice: p.price.cash?.enteredAmount,
                    coinPrice: p.price.coin?.enteredAmount,
                    mixPrice: p.price.mix?.enteredCash && p.price.mix?.enteredCoin
                              ? { enteredCash: p.price.mix.enteredCash, enteredCoin: p.price.mix.enteredCoin }
                              : null,
                    sellerReceivesCash: p.price.cash?.sellerReceivesCash || 0,
                    sellerReceivesCoin: p.price.coin?.sellerReceivesCoin || 0,
                    sellerReceivesmixCoin: p.price.mix?.sellerReceivesCoin || 0,
                    sellerReceivesmixCash: p.price.mix?.sellerReceivesCash || 0
                },
                seller: {
                    _id: p.sellerId?._id || p.sellerId || "",
                    username: p.sellerId?.username || "Unknown",
                    avatar: p.sellerId?.avatar || null
                },
                views: p.views,
                isWishlisted: isWishlisted,
                estimatedDeliveryDays: estimatedDeliveryDays
            };
        }));

        res.json({
            success: true,
            page,
            limit,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            products: formatted,
            seed: currentSeed,
            remainingProducts: totalProducts,
            sortedBy: sort || 'default'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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
      .select("images brand title size price sellerId createdAt status views") // Include status in selection
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
        cashPrice: product.price.cash?.enteredAmount || null,
        coinPrice: product.price.coin?.enteredAmount || null,
        mixPrice:
          product.price.mix?.enteredCash && product.price.mix?.enteredCoin
            ? { enteredCash: product.price.mix.enteredCash, enteredCoin: product.price.mix.enteredCoin }
            : null,
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
        views: product.views || 0,
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
