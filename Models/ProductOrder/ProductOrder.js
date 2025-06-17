const mongoose = require("mongoose");
const crypto = require("crypto");

const orderSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paymentOrderMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentOrder" },

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
        convenienceCharge: { type: Number, required: true, default: 0 },
        weight: { type: String, required: true },
        // 📌 Snapshot from Product
        fullPrice: {
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
        title: { type: String, required: true },
        gstNumber: { type: String },
        condition: { type: String, required: true },
      },
    ],

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "refunded", "cancelled", "failed"],
      required: true,
      default: "pending"
    },
    
//unlocked enum mean product is ordered successfully
    orderStatus: {
      type: String,
      enum: ["pending", "unlocked", "pickup_confirmed", "shipped", "delivered", "cancelled", "failed", "delivery_not_accepted", "returned"],
      required: true,
      default: "pending"
    },

    issueStatus: {
      type: String,
      enum: ["none", "raised", "permanently_closed", "ongoing"],
      default: "none"
    },

issueId: { 
  type: mongoose.Schema.Types.ObjectId, 
  ref: "Issue", 
  index: true 
},


    paymentMode: {
      type: String,
      enum: ["prepaid", "COD"],
      required: true,
    },

    paymentPrepaidType: {
      type: String
    },

deliveryInfo: {
  awb: { type: String },
  shipmentType: {
    type: String,
    enum: ['forward', 'reverse', 'custom'], // 'custom' = user enters AWB manually
  },
  deliveryPartner: {
    type: String,
    default: 'delhivery',
    enum: ['delhivery', 'shiprocket', 'ekart', 'custom'] // you can expand this list in future
  },
  shippingLabelUrl: { type: String },
  pickupScheduled: { type: Boolean, default: false },
  pickupDate: { type: String },
  pickupTime: { type: String }
},

    transactionId: {
      type: String,
      unique: true,
      index: true,
    },

    pickupAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },
    deliveryAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },

    totalShippingDiscount: { type: Number}, // in case of cart orders only, this will be the sum of all shipping discounts for each product
    totalShippingCharge: { type: Number, required: true },
    totalconvenienceCharge: { type: Number, required: true },
    codCharge: { type: Number, default: 0 },

    // total cash amount to be paid by buyer only for products not coins or other things like shipping, conv etc.
    productCashPaid: { type: Number, required: true, default: 0 },

    // 🔹 If user bought coins on the order page
    coinPurchase: {
      coinsBought: { type: Number, default: 0 },
      cashSpentForCoins: { type: Number, default: 0 },
    },

    // 🔹 Final overall payment
    totalCashPaid: { type: Number, required: true, default: 0 }, //including shipping and convinience and coin purchased
    totalCoinPaid: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);


// 🧠 Middleware: Set transactionId and codCharge
orderSchema.pre("save", async function (next) {
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

  if (this.paymentMode === "COD" && this.codCharge === 0) {
    this.codCharge = 50;
    this.totalCashPaid += 50;
  }

  next();
});

module.exports = mongoose.model("Order", orderSchema);
