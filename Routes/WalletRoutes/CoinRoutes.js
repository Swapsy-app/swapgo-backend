const express = require('express');
const router = express.Router();
const CoinWallet = require('../../Models/CoinWalletModels/Coin'); // Adjust the path as needed
const CoinTransaction = require('../../Models/CoinWalletModels/CoinTrans'); // Adjust the path as needed
const authenticateToken = require('../../Modules/authMiddleware'); // Adjust the path as needed

// Get Coin Wallet Balance
router.get('/coin-wallet', authenticateToken, async (req, res) => {
    try {
      const userId = req.user._id;
      const coinWallet = await CoinWallet.findOne({ userId }).populate('userId', 'username');
      
      if (!coinWallet) return res.status(404).json({ message: 'Coin wallet not found' });
  
      res.json({
        rewardCoinBalance: coinWallet.rewardCoinBalance,
        earnedCoinBalance: coinWallet.earnedCoinBalance,
        boughtCoinBalance: coinWallet.boughtCoinBalance, // Include bought coins
        totalBalance: coinWallet.totalCoinBalance // Using the virtual field
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  

// Get Coin Transaction History
router.get('/coin-transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const transactions = await CoinTransaction.find({ userId }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;