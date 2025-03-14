const express = require('express');
const router = express.Router();
const Wallet = require('../../Models/WalletModels/Cash'); // Adjust the path as needed
const Transaction = require('../../Models/WalletModels/cashTrans'); // Adjust the path as needed
const authenticateToken = require('../../Modules/authMiddleware'); // Adjust the path as needed

// Get Wallet and Transaction History
router.get('/wallet', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const wallet = await Wallet.findOne({ userId }).populate('userId', 'username');
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

    res.json({ wallet, transactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;