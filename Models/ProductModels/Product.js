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
    pickupAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true }, //get from address model
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
    gstNumber: { type: String }, //get from user profile
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // get from user profile jwt token
    size: {
      attributes: [{ 
        name: { type: String }, 
        value: { type: String}
      }],
      freeSize: { type: Boolean, default: false },
      sizeString: { type: String }
    },
    price: {
      mrp: { type: Number, required: true }, // Maximum Retail Price
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
      }
    }
  },
  { timestamps: true }
);

// Custom validation to ensure only one size field is selected
productSchema.pre("save", function (next) {
  // Ensure size exists before accessing its properties
  if (!this.size) {
    this.size = {};  // ✅ Prevents undefined errors
  }

  const { attributes = [], freeSize = false, sizeString = "" } = this.size; // ✅ Safe defaults

  const selectedFields = [attributes.length, freeSize, sizeString].filter(field => field);
  if (selectedFields.length > 1) {
    return next(new Error("Only one of the size fields (attributes, freeSize, or sizeString) can be selected."));
  }

  next();
});


// Ensure at least secondary or tertiary category is provided
productSchema.pre("save", function (next) {
  if (!this.category.secondaryCategory && !this.category.tertiaryCategory) {
    return next(new Error("Either secondary or tertiary category must be provided"));
  }
  next();
});

// Custom validation to ensure at least one pricing mode is provided
productSchema.pre("save", function (next) {
  const { cash, coin, mix } = this.price;

  const hasCash = cash && cash.enteredAmount !== undefined;
  const hasCoin = coin && coin.enteredAmount !== undefined;
  const hasMix = mix && mix.enteredCash !== undefined && mix.enteredCoin !== undefined;

  if (!hasCash && !hasCoin && !hasMix) {
    return next(new Error("At least one pricing mode (cash, coin, or mix) must be provided."));
  }

  next();
});

module.exports = mongoose.model("Product", productSchema);
