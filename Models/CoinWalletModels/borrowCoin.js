const mongoose = require("mongoose");

const BorrowedCoinsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    coinAmount: { type: Number, required: true }, // Number of coins borrowed
    borrowCost: { type: Number, required: true }, // 45% of coin value in INR
    serviceFee: { type: Number, required: true }, // 4% of coin value in INR
    totalPaid: { type: Number, required: true }, // borrowCost + serviceFee (49% of coin value)
    returnStatus: { type: String, enum: ["pending", "returned", "locked"], default: "pending" }
}, { timestamps: true }); // ✅ Auto-generates createdAt & updatedAt

module.exports = mongoose.model("BorrowedCoins", BorrowedCoinsSchema);
