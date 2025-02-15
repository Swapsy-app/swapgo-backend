const mongoose = require("mongoose");

const wishlistItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
}, { timestamps: true });

wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true }); // Prevent duplicates

module.exports = mongoose.model("WishlistItem", wishlistItemSchema);
