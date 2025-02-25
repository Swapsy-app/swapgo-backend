const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }] // Only store productId
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
