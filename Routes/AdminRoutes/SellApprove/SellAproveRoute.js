const express = require("express");
const router = express.Router();
const SellOperations = require("../../../Models/CoinWalletModels/sellCoin");
const CoinWallet = require("../../../Models/CoinWalletModels/Coin");
const SellTransaction = require("../../../Models/CoinWalletModels/sellCoinTran");
const CashWallet = require("../../../Models/WalletModels/Cash"); // Renamed for clarity
const CoinTransaction = require("../../../Models/CoinWalletModels/CoinTrans");
const CashTransaction = require("../../../Models/WalletModels/cashTrans");
const User = require("../../../Models/User"); // Import the User model

function getCashRate(totalBlockedCoins) {
    if (totalBlockedCoins >= 3000) return 0.15;
    if (totalBlockedCoins >= 2000) return 0.17;
    if (totalBlockedCoins >= 1000) return 0.19;
    return 0.22;
}

router.post("/approve-sell", async (req, res) => {
    try {
        const { userId, amountApproved } = req.body;

        // Convert amountApproved to a number
        const numericAmountApproved = Number(amountApproved); 

        let sellOperations = await SellOperations.findOne({ userId });
        if (!sellOperations || sellOperations.totalBlockedCoins < numericAmountApproved) {
            return res.status(400).json({ error: "Invalid approval amount." });
        }

        let cashWallet = await CashWallet.findOne({ userId });

        // If cash wallet doesn't exist, create one
        if (!cashWallet) {
            cashWallet = new CashWallet({ userId, balance: 0 });
            await cashWallet.save();
        }

        let coinWallet = await CoinWallet.findOne({ userId });
        if (!coinWallet) {
            return res.status(400).json({ error: "Coin wallet not found." });
        }

        // Get rate based on total blocked coins
        const cashRate = getCashRate(sellOperations.totalBlockedCoins);
        const serviceFee = numericAmountApproved * cashRate * 0.02;
        const totalAmount = parseFloat(((numericAmountApproved * cashRate) - serviceFee).toFixed(2));

        // Deduct approved coins
        coinWallet.blockedCoins -= numericAmountApproved;
        cashWallet.balance += totalAmount;
        sellOperations.totalBlockedCoins -= numericAmountApproved;
        sellOperations.totalApprovedCoins += numericAmountApproved;
        sellOperations.totalAmountReleased += totalAmount;

        // Create a sell transaction record
        const sellTransaction = new SellTransaction({
            userId,
            amountApproved: numericAmountApproved,
            cashRate,
            serviceFee,
            totalAmount
        });

                // ✅ Log coin transaction (sold coins)
                const coinTransaction = new CoinTransaction({
                    userId,
                    coinAmount: numericAmountApproved,
                    type: "debit",
                    description: `Sold ${numericAmountApproved} blocked coins.`,
                });
        
                // ✅ Log cash transaction (credited cash)
                const cashTransaction = new CashTransaction({
                    userId,
                    amount: totalAmount,
                    type: "credit",
                    description: `₹${totalAmount} added to cash wallet for selling ${numericAmountApproved} coins.`,
                });
        
        await coinTransaction.save();
        await cashTransaction.save();
        await sellTransaction.save();
        await sellOperations.save();
        await coinWallet.save();
        await cashWallet.save();

        res.status(200).json({ message: `Approved ${numericAmountApproved} coins. Credited ₹${totalAmount} to cash wallet.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/sell-users", async (req, res) => {
    try {
        // Get page number from query, default to 1
        const page = parseInt(req.query.page) || 1;
        const limit = 20; // Items per page
        const skip = (page - 1) * limit;

        // Fetch paginated SellOperations data
        const users = await SellOperations.find({})
            .sort({ totalBlockedCoins: -1 }) // Sort by highest blocked coins
            .select("userId totalBlockedCoins totalApprovedCoins totalAmountReleased")
            .skip(skip)
            .limit(limit);

        // Fetch total count of documents for pagination info
        const totalUsers = await SellOperations.countDocuments();

        // Fetch user details for each user in SellOperations
        const userIds = users.map(user => user.userId);
        const userDetails = await User.find({ _id: { $in: userIds } })
            .select("username email mobile");

        // Merge user details into SellOperations data
        const userList = users.map(user => {
            const userInfo = userDetails.find(u => u._id.toString() === user.userId.toString());
            return {
                userId: user.userId,
                username: userInfo?.username || "N/A",
                email: userInfo?.email || "N/A",
                mobile: userInfo?.mobile || "N/A",
                totalBlockedCoins: user.totalBlockedCoins,
                totalApprovedCoins: user.totalApprovedCoins,
                totalAmountReleased: user.totalAmountReleased
            };
        });

        res.status(200).json({
            totalUsers,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            users: userList
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/sell-history/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 20; // Default limit to 20 per page
        const skip = (page - 1) * limit;

        // Fetch total count of transactions for pagination info
        const totalTransactions = await SellTransaction.countDocuments({ userId });

        // Fetch paginated transaction history
        const sellTransactions = await SellTransaction.find({ userId })
            .sort({ approvedAt: -1 }) // Latest transactions first
            .skip(skip)
            .limit(limit);

        // Fetch user sell operations summary
        const sellOperations = await SellOperations.findOne({ userId });

        res.status(200).json({
            totalBlockedCoins: sellOperations ? sellOperations.totalBlockedCoins : 0,
            totalApprovedCoins: sellOperations ? sellOperations.totalApprovedCoins : 0,
            totalAmountReleased: sellOperations ? sellOperations.totalAmountReleased : 0,
            totalTransactions,
            currentPage: page,
            totalPages: Math.ceil(totalTransactions / limit),
            transactionHistory: sellTransactions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});


module.exports = router;
