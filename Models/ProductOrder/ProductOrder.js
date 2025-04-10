const mongoose = require("mongoose");
const crypto = require("crypto");

const orderSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        quantity: { type: Number, required: true, default: 1 },
        priceMode: {
          type: String,
          enum: ["cash", "coin", "mix"],
          required: true,
        },
        shippingCharge: { type: Number, required: true, default: 0 },
        weight: { type: String, required: true },
      },
    ],

paymentStatus: {
  type: String,
  enum: ["pending", "completed", "refunded", "cancelled"],
  required: true,
  default: "pending"
},

orderStatus: {
  type: String,
  enum: ["pending", "pickup_confirmed", "shipped", "delivered", "returned", "cancelled"],
  required: true,
  default: "pending"
},

issueStatus: {
  type: String,
  enum: ["none", "requested", "approved", "rejected"],
  default: "none"
},

    paymentMode: {
      type: String,
      enum: ["prepaid", "COD"],
      required: true,
    },

    codCharge: { type: Number, default: 0 }, // 💰 Extra charge if COD is selected

    transactionId: {
      type: String,
      unique: true,
      index: true,
    },

    pickupAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },
    deliveryAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },

    totalShippingCharge: { type: Number, required: true },

    // 🔹 Payment breakdown before coin purchase
    productCashPaid: { type: Number, required: true, default: 0 },
    productCoinPaid: { type: Number, required: true, default: 0 },

    // 🔹 If user bought coins on the order page
    coinPurchase: {
      coinsBought: { type: Number, default: 0 },
      cashSpentForCoins: { type: Number, default: 0 },
    },

    // 🔹 Final overall payment
    totalCashPaid: { type: Number, required: true, default: 0 }, // productCashPaid + cashSpentForCoins + cod charge
    totalCoinPaid: { type: Number, required: true, default: 0 }, // productCoinPaid
  },
  { timestamps: true }
);


// 🧠 Middleware: Set transactionId and codCharge
orderSchema.pre("save", async function (next) {
    // Generate unique TXN ID if not already present
    if (!this.transactionId) {
      let isUnique = false;
      while (!isUnique) {
        const date = new Date();
        const yyyyMMdd = date.toISOString().slice(0, 10).replace(/-/g, "");
        const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
        const txnId = `TXN-${yyyyMMdd}-${randomHex}`;
  
        const existing = await mongoose.models.Order.findOne({ transactionId: txnId });
        if (!existing) {
          this.transactionId = txnId;
          isUnique = true;
        }
      }
    }
  
    // Add COD charge if paymentMode is COD
    if (this.paymentMode === "COD" && this.codCharge === 0) {
      this.codCharge = 50;
      this.totalCashPaid += 50;
    }
  
    next();
  });
  

module.exports = mongoose.model("Order", orderSchema);
