const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }, // Reference to Price Model
    images: [{ type: String, required: true }], // Array of image URLs
    video: { type: String }, // Video URL
    title: { type: String, required: true },
    description: { type: String, required: true },
    pickupAddress: { type: String, required: true }, //need a model
    condition: { type: String, required: true },
    manufacturingCountry: { type: String, required: true },
    weight: { type: Number, required: true },
    brand: { type: String },
    size: { type: mongoose.Schema.Types.ObjectId, ref: "Size", required: true },
    occasion: { type: String },
    color: { type: String },
    shape: { type: String },
    fabric: { type: String },
    priceId: { type: mongoose.Schema.Types.ObjectId, ref: "Price", required: true }, // Reference to Price Model
    quantity: { type: Number, required: true, default: 1 },
    shippingMethod: { type: String, required: true },
    gstNumber: { type: String},
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User model
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
