const express = require("express");
const router = express.Router();
const CoinWallet = require("../../Models/CoinWalletModels/Coin");
const SellOperations = require("../../Models/CoinWalletModels/sellCoin");
const authenticateToken = require("../../Modules/authMiddleware");
const CoinTransaction = require("../../Models/CoinWalletModels/CoinTrans");

// route to block coins
router.post("/block-coins", authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const amountToBlock = Number(req.body.amountToBlock); // Ensure numeric value

        let coinWallet = await CoinWallet.findOne({ userId });
        if (!coinWallet || coinWallet.earnedCoinBalance < amountToBlock) {
            return res.status(400).json({ error: "Insufficient earned coins." });
        }

        // Ensure numeric values before arithmetic operations
        coinWallet.earnedCoinBalance = Number(coinWallet.earnedCoinBalance) - amountToBlock;
        coinWallet.blockedCoins = Number(coinWallet.blockedCoins) + amountToBlock;

        let sellOperations = await SellOperations.findOne({ userId });
        if (!sellOperations) {
            sellOperations = new SellOperations({
                userId,
                totalBlockedCoins: amountToBlock
            });
        } else {
            sellOperations.totalBlockedCoins = Number(sellOperations.totalBlockedCoins) + amountToBlock;
        }

              // ✅ Log transaction
              const transaction = new CoinTransaction({
                userId,
                coinAmount: amountToBlock,
                type: "debit",
                description: `Blocked ${amountToBlock} coins for sell.`,
                orderId: "", // ✅ Left empty
            });

        await transaction.save();
        await coinWallet.save();
        await sellOperations.save();

        res.status(200).json({ message: `Blocked ${amountToBlock} coins. Total blocked: ${sellOperations.totalBlockedCoins}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 🔄 Route to unblock all coins
router.post("/unblock-coins", authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;

        let coinWallet = await CoinWallet.findOne({ userId });
        let sellOperations = await SellOperations.findOne({ userId });

        if (!coinWallet || !sellOperations || sellOperations.totalBlockedCoins <= 0) {
            return res.status(400).json({ error: "No blocked coins to unblock." });
        }

        // Transfer all blocked coins back to earned balance
        const coinsToUnblock = Number(sellOperations.totalBlockedCoins);
        coinWallet.earnedCoinBalance = Number(coinWallet.earnedCoinBalance) + coinsToUnblock;
        coinWallet.blockedCoins = 0;
        sellOperations.totalBlockedCoins = 0;

                // ✅ Log transaction
                const transaction = new CoinTransaction({
                    userId,
                    coinAmount: coinsToUnblock,
                    type: "credit",
                    description: `Unblocked ${coinsToUnblock} coins and added back to Coin Balance.`,
                    orderId: "", // ✅ Left empty
                });
        
        await transaction.save();
        await coinWallet.save();
        await sellOperations.save();

        res.status(200).json({ message: `Unblocked ${coinsToUnblock} coins. All coins are now available in earned balance.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});


module.exports = router;
