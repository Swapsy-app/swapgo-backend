const mongoose = require("mongoose");

const priceSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // Link to Product
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
      sellerReceivesCoin: {type: Number}
    }
  },
  { timestamps: true }
);

// Custom validation: At least one of cash, coin, or mix must be present
priceSchema.pre("save", function (next) {
  const { cash, coin, mix } = this;

  const hasCash = cash && cash.enteredAmount !== undefined;
  const hasCoin = coin && coin.enteredAmount !== undefined;
  const hasMix = mix && mix.enteredCash !== undefined && mix.enteredCoin !== undefined;

  if (!hasCash && !hasCoin && !hasMix) {
    return next(new Error("At least one pricing mode (cash, coin, or mix) must be provided."));
  }

  next();
});

module.exports = mongoose.model("Price", priceSchema);
