const express = require("express");
const router = express.Router();
const Review = require("../../Models/ProductModels/rating_review");
const Order = require("../../Models/ProductOrder/ProductOrder");
const CoinWallet = require("../../Models/CoinWalletModels/Coin");
const CoinTransaction = require("../../Models/CoinWalletModels/CoinTrans");
const authenticateToken = require("../../Modules/authMiddleware");
const User = require("../../Models/User");

// 🔁 Update seller rating function
async function updateSellerSuperFinalRating(sellerId) {
  const reviews = await Review.find({ sellerId });
  if (reviews.length === 0) return;

  const totalRating = reviews.reduce((acc, curr) => acc + curr.averageRating, 0);
  const superFinalRating = totalRating / reviews.length;

  let modified = superFinalRating + 0.5;
  if (modified > 5.0) modified = 5.0;

  await User.findByIdAndUpdate(sellerId, {
    sellerRating: superFinalRating,
    modifiedSellerRating: modified
  });
}

//very important note dont show individual rating to buyer in frontend if rating is below 3 show a thumps down emoji and if rating is above 3 show a thumps up emoji or you can use any other emoji you like
//to post review only works when order status is delivered and once a product is rateed it cannot be changed
router.post("/review", authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      reviewText,
      productQuality,
      communication,
      packaging,
      overallExperience
    } = req.body;

    const buyerId = req.user._id;

    // 1️⃣ Check order
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.buyerId.toString() !== buyerId.toString())
      return res.status(403).json({ error: "You are not authorized to review this order" });

const allowedStatuses = ["delivered", "returned"];
if (!allowedStatuses.includes(order.orderStatus))
  return res.status(400).json({ error: "Order not delivered yet" });

    // 2️⃣ Check if already reviewed
    const existing = await Review.findOne({ orderId });
    if (existing) return res.status(409).json({ error: "Review already submitted" });

    const sellerId = order.products[0].sellerId;

    // 3️⃣ Calculate and format rating as 2-decimal number
    let avg = (productQuality + communication + packaging + overallExperience) / 4;
    const averageRating = parseFloat(avg.toFixed(2)); // Always in format like 4.00

    // 4️⃣ Save Review
    const review = new Review({
      orderId,
      buyerId,
      sellerId,
      reviewText,
      productQuality,
      communication,
      packaging,
      overallExperience,
      averageRating
    });
    await review.save();

    // 5️⃣ Ensure wallet exists & update it
    const wallet = await CoinWallet.findOne({ userId: buyerId });
    if (!wallet) {
      await CoinWallet.create({
        userId: buyerId,
        rewardCoinBalance: 100,
        updatedAt: new Date()
      });
    } else {
      await CoinWallet.findOneAndUpdate(
        { userId: buyerId },
        {
          $inc: { rewardCoinBalance: 100 },
          $set: { updatedAt: new Date() }
        }
      );
    }

    // 6️⃣ Log coin transaction
    await CoinTransaction.create({
      userId: buyerId,
      orderId: order._id,
      coinAmount: 100,
      type: "credit",
      description: "Reward for submitting review"
    });

    // 7️⃣ Update seller rating
    await updateSellerSuperFinalRating(sellerId);

    res.status(201).json({ message: "Review submitted and reward granted." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// 🧠 Check if a particular order has already been reviewed by the logged-in buyer
router.get("/review/check/:orderId", authenticateToken, async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { orderId } = req.params;

    const existingReview = await Review.findOne({ orderId, buyerId });

    if (existingReview) {
      return res.json({ reviewed: true });
    } else {
      return res.json({ reviewed: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check review status" });
  }
});

// 📦 GET reviews for a seller (paginated)
router.get("/review/seller/:sellerId", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 15;
    const skip = (page - 1) * limit;

    const totalReviews = await Review.countDocuments({ sellerId: req.params.sellerId });

    const reviews = await Review.find({ sellerId: req.params.sellerId })
      .populate({ path: "buyerId", select: "userName avatar" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        const order = await Order.findById(review.orderId).select("products");

        const products = order?.products.map((p) => ({
          productId: p.productId,
          title: p.title,
        })) || [];

        return {
          _id: review._id,
          orderId: review.orderId,
          buyerId: review.buyerId,
          sellerId: review.sellerId,
          reviewText: review.reviewText,
          averageRating: review.averageRating,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
          products,
        };
      })
    );

    res.json({
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalReviews / limit),
      totalReviews,
      reviews: enrichedReviews,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ⭐ GET actual and modified rating for seller directly from User schema
router.get("/rating/seller/:sellerId", async (req, res) => {
  try {
    const seller = await User.findById(req.params.sellerId).select("sellerRating modifiedSellerRating");

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    res.json({
      actualRating: seller.sellerRating?.toFixed(2) || "0.00",
      modifiedRating: seller.modifiedSellerRating?.toFixed(2) || "0.00"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch seller rating" });
  }
});


module.exports = router;
