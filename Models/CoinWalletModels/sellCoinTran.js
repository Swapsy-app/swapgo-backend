const mongoose = require("mongoose");

const SellTransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amountApproved: { type: Number, required: true },
    cashRate: { type: Number, required: true },
    serviceFee: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    approvedAt: { type: Date, default: Date.now }
},{ timestamps: true });

module.exports = mongoose.model("SellTransaction", SellTransactionSchema);
