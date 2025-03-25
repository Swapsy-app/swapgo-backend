const mongoose = require("mongoose");
const express = require("express");
const { processRefund } = require("../PaymentRoutes/RefundBackendRoute"); // Import refund function
const BorrowedCoins = require("../../Models/CoinWalletModels/borrowCoin"); // Import model
const CoinWallet = require("../../Models/CoinWalletModels/Coin"); // Import model
const CoinTransaction = require("../../Models/CoinWalletModels/CoinTrans"); // Import model
const authenticateToken = require("../../Modules/authMiddleware");

const router = express.Router();

router.post("/return-borrowed-coins", authenticateToken, async (req, res) => {
    const session = await mongoose.startSession(); // Start transaction session
    session.startTransaction();

    try {
        const userId = req.user._id;
        const { borrowId } = req.body;

        // ✅ Find the borrowed coin entry
        const borrowedCoin = await BorrowedCoins.findOne({ _id: borrowId, userId }).session(session);
        if (!borrowedCoin) {
            await session.abortTransaction();
            return res.status(404).json({ error: "Borrowed coins record not found" });
        }

        // ✅ Check return deadline
        const returnDeadline = new Date(borrowedCoin.createdAt);
        returnDeadline.setDate(returnDeadline.getDate() + 30);
        if (new Date() > returnDeadline) {
            borrowedCoin.returnStatus = "locked";
            await borrowedCoin.save({ session });
            await session.commitTransaction();
            return res.status(403).json({ error: "Return window has expired. Coins are now non-refundable." });
        }

        // ✅ Fetch user's coin wallet
        const coinWallet = await CoinWallet.findOne({ userId }).session(session);
        if (!coinWallet) {
            await session.abortTransaction();
            return res.status(400).json({ error: "Coin wallet not found." });
        }

        // ✅ Calculate total available balance
        let totalAvailableBalance =
            coinWallet.rewardCoinBalance +
            coinWallet.earnedCoinBalance +
            coinWallet.boughtCoinBalance +
            coinWallet.borrowedCoinBalance;

        if (totalAvailableBalance < borrowedCoin.coinAmount) {
            await session.abortTransaction();
            return res.status(400).json({ error: "Insufficient total coin balance to return." });
        }

        // ✅ Deduct coins (Prioritizing reward → earned → bought → borrowed)
        let remainingToDeduct = borrowedCoin.coinAmount;
        let originalBalances = { ...coinWallet.toObject() }; // Save original balances for rollback

        if (coinWallet.rewardCoinBalance >= remainingToDeduct) {
            coinWallet.rewardCoinBalance -= remainingToDeduct;
            remainingToDeduct = 0;
        } else {
            remainingToDeduct -= coinWallet.rewardCoinBalance;
            coinWallet.rewardCoinBalance = 0;
        }

        if (remainingToDeduct > 0) {
            if (coinWallet.earnedCoinBalance >= remainingToDeduct) {
                coinWallet.earnedCoinBalance -= remainingToDeduct;
                remainingToDeduct = 0;
            } else {
                remainingToDeduct -= coinWallet.earnedCoinBalance;
                coinWallet.earnedCoinBalance = 0;
            }
        }

        if (remainingToDeduct > 0) {
            if (coinWallet.boughtCoinBalance >= remainingToDeduct) {
                coinWallet.boughtCoinBalance -= remainingToDeduct;
                remainingToDeduct = 0;
            } else {
                remainingToDeduct -= coinWallet.boughtCoinBalance;
                coinWallet.boughtCoinBalance = 0;
            }
        }

        if (remainingToDeduct > 0) {
            if (coinWallet.borrowedCoinBalance >= remainingToDeduct) {
                coinWallet.borrowedCoinBalance -= remainingToDeduct;
                remainingToDeduct = 0;
            } else {
                await session.abortTransaction();
                return res.status(400).json({ error: "Unexpected balance mismatch while deducting coins." });
            }
        }

        // ✅ Save the updated wallet with deducted coins
        await coinWallet.save({ session });

        // ✅ Process refund **AFTER** deduction but before committing transaction
        const refundAmount = borrowedCoin.totalPaid - borrowedCoin.serviceFee;
        const refundId = `refund_${Date.now()}`;
        const refundNote = "Refund for returning borrowed coins";

        const refundResponse = await processRefund(borrowedCoin.orderId, refundAmount, refundId, refundNote);

        if (!refundResponse || refundResponse.status !== "SUCCESS") {
            // ❌ Refund failed, so restore coin balances
            coinWallet.rewardCoinBalance = originalBalances.rewardCoinBalance;
            coinWallet.earnedCoinBalance = originalBalances.earnedCoinBalance;
            coinWallet.boughtCoinBalance = originalBalances.boughtCoinBalance;
            coinWallet.borrowedCoinBalance = originalBalances.borrowedCoinBalance;

            await coinWallet.save({ session }); // Restore original balances
            await session.abortTransaction(); // Rollback transaction
            return res.status(500).json({ error: "Refund processing failed. Coins have been restored." });
        }

        // ✅ Update borrowed coins entry
        borrowedCoin.returnStatus = "returned";
        borrowedCoin.returnedAt = new Date();
        borrowedCoin.refundAmount = refundAmount;
        await borrowedCoin.save({ session });

        // ✅ Log transaction
        const coinTransaction = new CoinTransaction({
            userId,
            coinAmount: -borrowedCoin.coinAmount,
            type: "debit",
            description: `Returned borrowed coins (Order ID: ${borrowedCoin.orderId})`,
            orderId: borrowedCoin.orderId,
        });
        await coinTransaction.save({ session });

        await session.commitTransaction(); // ✅ Commit the transaction if everything succeeds
        res.status(200).json({ message: "Coins returned successfully, refund initiated.", refundAmount });

    } catch (error) {
        console.error("Return borrowed coins error:", error);
        await session.abortTransaction(); // ❌ Rollback transaction if error occurs
        res.status(500).json({ error: "Something went wrong." });
    } finally {
        session.endSession(); // Close session
    }
});


router.get("/borrow-status", authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id; // Get user ID from token

        // ✅ Fetch all borrow records for the user
        const borrowedCoins = await BorrowedCoins.find({ userId });

        if (!borrowedCoins || borrowedCoins.length === 0) {
            return res.status(404).json({ error: "No borrowed coin records found." });
        }

        // ✅ Iterate over borrowed entries to check if they need to be locked
        const updatedRecords = await Promise.all(
            borrowedCoins.map(async (borrow) => {
                if (borrow.returnStatus === "pending") { // Only check active loans
                    const returnDeadline = new Date(borrow.createdAt);
                    returnDeadline.setDate(returnDeadline.getDate() + 30); // 30-day return limit

                    if (new Date() > returnDeadline) {
                        borrow.returnStatus = "locked"; // Mark as locked
                        await borrow.save(); // Save changes
                    }
                }
                return borrow;
            })
        );

        res.status(200).json(updatedRecords);
    } catch (error) {
        console.error("Error fetching borrow status:", error);
        res.status(500).json({ error: "Something went wrong." });
    }
});


module.exports = router;
