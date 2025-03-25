const express = require("express");
const crypto = require("crypto");
const CoinWallet = require("../../Models/CoinWalletModels/Coin");
const CoinTransaction = require("../../Models/CoinWalletModels/CoinTrans");
const PaymentOrder = require("../../Models/PaymentGatewayModels/PaymentGateway");
const BorrowedCoins = require("../../Models/CoinWalletModels/borrowCoin"); // Import BorrowedCoins Model
require("dotenv").config();

const router = express.Router();

const verifySignature = (timestamp, rawBody, signature, secretKey) => {
    const signedPayload = timestamp + rawBody;
    const computedSignature = crypto.createHmac("sha256", secretKey)
        .update(signedPayload)
        .digest("base64");
    return computedSignature === signature;
};

const calculateCoinsFromAmount = (amount) => {
    if (amount / 0.15 > 3000) return Math.floor(amount / 0.15);
    if (amount / 0.17 >= 2000) return Math.floor(amount / 0.17);
    if (amount / 0.19 >= 1000) return Math.floor(amount / 0.19);
    return Math.floor(amount / 0.22);
};

router.post("/cashfree-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const signature = req.headers["x-webhook-signature"];
        const timestamp = req.headers["x-webhook-timestamp"];
        const secretKey = process.env.CASHFREE_CLIENT_SECRET;
        const rawBody = req.body instanceof Buffer ? req.body.toString("utf-8") : JSON.stringify(req.body);

        if (!verifySignature(timestamp, rawBody, signature, secretKey)) {
            return res.status(400).json({ message: "Invalid signature" });
        }

        const payload = JSON.parse(rawBody);
        const { order } = payload.data;
        const { payment } = payload.data;

        if (!order || !payment) {
            return res.status(400).json({ message: "Invalid webhook payload" });
        }

        const { order_id, order_amount } = order; // ✅ Get order_type
        const { cf_payment_id, bank_reference, payment_status, payment_amount } = payment;

        const paymentOrder = await PaymentOrder.findOne({ orderId: order_id });
        if (!paymentOrder) {
            return res.status(404).json({ message: "Order not found" });
        }

        // ✅ Get order type from database
const order_type = paymentOrder.type; // Use correct database field

        if (paymentOrder.status === "success") {
            return res.status(400).json({ message: "Payment already processed" });
        }

        if (payment_status === "FAILED") {
            paymentOrder.status = "failed";
            await paymentOrder.save();
            return res.status(200).json({ message: "Payment failed, order updated" });
        }

        if (payment_status === "USER_DROPPED") {
            paymentOrder.status = "cancelled";
            await paymentOrder.save();
            return res.status(200).json({ message: "User dropped the payment, order updated" });
        }

        if (!["SUCCESS", "FAILED", "USER_DROPPED"].includes(payment_status)) {
            console.warn(`⚠️ Unrecognized payment status received: ${payment_status}`);
            paymentOrder.status = "unknown";
            paymentOrder.unknownStatusReceived = payment_status;
            await paymentOrder.save();
            return res.status(200).json({ message: `Unknown payment status received: ${payment_status}, order marked as unknown` });
        }

        if (parseFloat(order_amount) !== parseFloat(paymentOrder.amount)) {
            return res.status(400).json({ message: "Order amount mismatch. Possible tampering detected." });
        }

        if (parseFloat(payment_amount) !== parseFloat(order_amount)) {
            return res.status(400).json({ message: "Payment amount does not match the expected order amount." });
        }

        const userId = paymentOrder.userId;

        paymentOrder.status = "success";
        paymentOrder.referenceId = cf_payment_id;
        paymentOrder.bankReferenceId = bank_reference;
        await paymentOrder.save();

        let coinWallet = await CoinWallet.findOne({ userId });
        if (!coinWallet) {
            coinWallet = new CoinWallet({ userId });
        }

        if (order_type === "borrow_coin") {
            // ✅ Borrow coins logic
             // ✅ Calculate borrow cost (96% of paid amount)
    const borrowCost = Math.floor(order_amount * 0.96);

    // ✅ Calculate service fee (4% of paid amount)
    const serviceFee = Math.floor(order_amount * 0.04);

    // ✅ Calculate coins received (100% of borrow cost value)
    const coinsBorrowed = Math.floor(borrowCost * (100 / 45));

            const totalPaid = order_amount;

            coinWallet.borrowedCoinBalance += coinsBorrowed;
            coinWallet.updatedAt = new Date();
            await coinWallet.save();

            const borrowedCoins = new BorrowedCoins({
                userId,
                orderId: order_id,
                coinAmount: coinsBorrowed,
                borrowCost,
                serviceFee,
                totalPaid,
                returnStatus: "pending",
            });

            await borrowedCoins.save();

            const coinTransaction = new CoinTransaction({
                userId,
                coinAmount: coinsBorrowed,
                type: "credit",
                description: `Borrowed coins via payment (Order ID: ${order_id})`,
                orderId: order_id
            });
            await coinTransaction.save();

            res.status(200).json({ message: "Borrowed coins added successfully" });
        } else if (order_type === "coin_purchase") {
            // ✅ Regular coin purchase logic
            const coinsToAdd = calculateCoinsFromAmount(order_amount);
            coinWallet.boughtCoinBalance += coinsToAdd;
            coinWallet.updatedAt = new Date();
            await coinWallet.save();

            const coinTransaction = new CoinTransaction({
                userId,
                coinAmount: coinsToAdd,
                type: "credit",
                description: `Coins purchased via payment (Order ID: ${order_id})`,
                orderId: order_id
            });
            await coinTransaction.save();

            res.status(200).json({ message: "Payment verified and coins added successfully" });
        }
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
