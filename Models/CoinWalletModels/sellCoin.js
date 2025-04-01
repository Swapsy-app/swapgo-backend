const mongoose = require("mongoose");

const SellOperationsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    totalBlockedCoins: { type: Number, default: 0 }, // Tracks all coins blocked by user
    totalApprovedCoins: { type: Number, default: 0 }, // Tracks how many coins are approved for sale
    totalAmountReleased: { type: Number, default: 0 }, // Total cash released for the user
},{ timestamps: true });

module.exports = mongoose.model("SellOperations", SellOperationsSchema);
