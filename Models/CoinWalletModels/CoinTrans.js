const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const coinTransactionSchema = new mongoose.Schema({
  transactionId: { type: String, default: uuidv4, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coinAmount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);