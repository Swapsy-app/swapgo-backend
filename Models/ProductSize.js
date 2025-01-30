const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // Link to Product
    attributes: [{ 
      name: { type: String, required: true },  // Name of the size attribute (e.g., chest, waist)
      value: { type: String, required: true }  // Value for the attribute (e.g., 34, M)
    }],
    freeSize: { type: Boolean, default: false }, // Option to mark as free size
    sizeString: { type: String }  // Optional field to accept size as just a string (e.g., "M", "L")
  },
  { timestamps: true }
);

module.exports = mongoose.model("Size", sizeSchema);
