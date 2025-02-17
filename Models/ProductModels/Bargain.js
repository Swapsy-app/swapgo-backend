const mongoose = require("mongoose");

const bargainSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    offeredPrice: { type: Number, required: true },
    offeredIn: { type: String, enum: ["cash", "coin"], required: true }, // Cannot be "mix"
    sellerReceives: { type: Number, required: true }, // After commission deduction
    message: { type: String }, // Buyer’s reason/kind words
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bargain", bargainSchema);
