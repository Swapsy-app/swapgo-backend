const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reviewText: { type: String, required: true },

  productQuality: { type: Number, min: 1, max: 5, required: true },
  communication: { type: Number, min: 1, max: 5, required: true },
  packaging: { type: Number, min: 1, max: 5, required: true },
  overallExperience: { type: Number, min: 1, max: 5, required: true },

  averageRating: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Review", reviewSchema);
