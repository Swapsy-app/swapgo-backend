const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // Link to Product
    primaryCategory: { type: String, required: true }, // Must always be selected
    secondaryCategory: { type: String }, // Optional
    tertiaryCategory: { type: String }, // Optional
  },
  { timestamps: true }
);

// Ensure at least secondary or tertiary is provided
categorySchema.pre("save", function (next) {
  if (!this.secondaryCategory && !this.tertiaryCategory) {
    return next(new Error("Either secondary or tertiary category must be provided"));
  }
  next();
});

module.exports = mongoose.model("Category", categorySchema);
