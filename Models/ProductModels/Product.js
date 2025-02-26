const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    category: {
      primaryCategory: { type: String, required: true },
      secondaryCategory: { type: String },
      tertiaryCategory: { type: String },
    },
    images: [{ type: String, required: true }],
    video: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    pickupAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },
    condition: { type: String, required: true },
    manufacturingCountry: { type: String, required: true },
    weight: { type: Number, required: true },
    brand: { type: String },
    occasion: { type: String },
    color: { type: String },
    shape: { type: String },
    fabric: { type: String },
    quantity: { type: Number, required: true, default: 1 },
    shippingMethod: { type: String, required: true },
    gstNumber: { type: String },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    size: {
      attributes: [{ name: { type: String }, value: { type: String } }],
      freeSize: { type: Boolean, default: false },
      sizeString: { type: String },
    },
    price: {
      mrp: { type: Number, required: true },
      cash: {
        enteredAmount: { type: Number },
        sellerReceivesCash: { type: Number },
      },
      coin: {
        enteredAmount: { type: Number },
        sellerReceivesCoin: { type: Number },
      },
      mix: {
        enteredCash: { type: Number },
        enteredCoin: { type: Number },
        sellerReceivesCash: { type: Number },
        sellerReceivesCoin: { type: Number },
      },
    },
    status: {
      type: String,
      enum: [
        "available",
        "sold",
        "unavailable",
        "orderReceived",
        "shipped",
        "issues",
        "cancelled",
        "draft",
        "underReview",
      ],
      required: true,
      default: "available",
      index: true,
    },
    wasAvailableBeforeHoliday: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 🔹 Compound Text Index for Full-Text Search
productSchema.index({
  title: "text",
  brand: "text",
  "category.primaryCategory": "text",
  "category.secondaryCategory": "text",
  "category.tertiaryCategory": "text",
});

// 🔹 Single Pre-Save Hook for All Validations
productSchema.pre("save", function (next) {
  // Ensure size fields validation
  if (!this.size) this.size = {};
  const { attributes = [], freeSize = false, sizeString = "" } = this.size;
  const selectedFields = [attributes.length, freeSize, sizeString].filter(Boolean);
  if (selectedFields.length > 1) {
    return next(new Error("Only one of the size fields (attributes, freeSize, or sizeString) can be selected."));
  }

  // Ensure at least secondary or tertiary category is provided
  if (!this.category.secondaryCategory && !this.category.tertiaryCategory) {
    return next(new Error("Either secondary or tertiary category must be provided."));
  }

  // Ensure at least one pricing mode is provided
  const { cash, coin, mix } = this.price || {};
  const hasCash = cash?.enteredAmount !== undefined;
  const hasCoin = coin?.enteredAmount !== undefined;
  const hasMix = mix?.enteredCash !== undefined && mix?.enteredCoin !== undefined;

  if (!hasCash && !hasCoin && !hasMix) {
    return next(new Error("At least one pricing mode (cash, coin, or mix) must be provided."));
  }

  next();
});

module.exports = mongoose.model("Product", productSchema);
