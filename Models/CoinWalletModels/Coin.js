const mongoose = require('mongoose');

const coinWalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  rewardCoinBalance: { type: Number, default: 0 },
  earnedCoinBalance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Virtual field to calculate total coin balance
coinWalletSchema.virtual('totalCoinBalance').get(function() {
  return this.rewardCoinBalance + this.earnedCoinBalance;
});

module.exports = mongoose.model('CoinWallet', coinWalletSchema);