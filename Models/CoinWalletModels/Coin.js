const mongoose = require("mongoose");

const coinWalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  rewardCoinBalance: { type: Number, default: 0 }, // Coins earned as rewards
  earnedCoinBalance: { type: Number, default: 0 }, // Coins earned through activities
  boughtCoinBalance: { type: Number, default: 0 }, // Coins purchased using INR
  borrowedCoinBalance: { type: Number, default: 0 }, // ✅ Coins borrowed
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Virtual field to calculate total coin balance
coinWalletSchema.virtual("totalCoinBalance").get(function () {
  return this.rewardCoinBalance + this.earnedCoinBalance + this.boughtCoinBalance;
});

module.exports = mongoose.model("CoinWallet", coinWalletSchema);
