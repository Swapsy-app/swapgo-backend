const express = require("express");
const crypto = require("crypto");
const CoinWallet = require("../../Models/CoinWalletModels/Coin");
const CoinTransaction = require("../../Models/CoinWalletModels/CoinTrans");
const PaymentOrder = require("../../Models/PaymentGatewayModels/PaymentGateway");
require("dotenv").config();

const router = express.Router();

// Function to verify Cashfree signature
const verifySignature = (timestamp, rawBody, signature, secretKey) => {
    const signedPayload = timestamp + rawBody;
    const computedSignature = crypto
        .createHmac("sha256", secretKey)
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

        const { order_id, order_amount } = order;
        const { cf_payment_id, bank_reference, payment_status, payment_amount } = payment;

        const paymentOrder = await PaymentOrder.findOne({ orderId: order_id });
        if (!paymentOrder) {
            return res.status(404).json({ message: "Order not found" });
        }

         // ✅ Prevent duplicate processing
         if (paymentOrder.status === "success") {
            return res.status(400).json({ message: "Payment already processed" });
        }

               // ✅ Handle failed or user dropped transactions
               if (payment_status === "FAILED") {
                paymentOrder.status = "failed";
                await paymentOrder.save();
                return res.status(200).json({ message: "Payment failed, order updated" });
            }

            //payment cancelled by user before otp or any reason
            if (payment_status === "USER_DROPPED") {
                paymentOrder.status = "cancelled";
                await paymentOrder.save();
                return res.status(200).json({ message: "User dropped the payment, order updated" });
            }

            // ✅ Convert unexpected statuses to "unknown" (to match enum restriction)
if (!["SUCCESS", "FAILED", "USER_DROPPED"].includes(payment_status)) {
    console.warn(`⚠️ Unrecognized payment status received: ${payment_status}`);
    
    paymentOrder.status = "unknown";  // Assign "unknown" since it's the only enum allowed
    paymentOrder.unknownStatusReceived = payment_status;  // Store actual received status for reference

    await paymentOrder.save();
    return res.status(200).json({ message: `Unknown payment status received: ${payment_status}, order marked as unknown` });
}

// Validate order amount (expected) vs. stored order amount
if (parseFloat(order_amount) !== parseFloat(paymentOrder.amount)) {
    return res.status(400).json({ message: "Order amount mismatch. Possible tampering detected." });
}

// Validate payment amount (actual received) vs. expected order amount
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

        // Calculate coins correctly
        const coinsToAdd = calculateCoinsFromAmount(order_amount);
        coinWallet.boughtCoinBalance += coinsToAdd;
        coinWallet.updatedAt = new Date();
        await coinWallet.save();

        const coinTransaction = new CoinTransaction({
            userId,
            coinAmount: coinsToAdd,
            type: "credit",
            description: `Coins purchased via payment (Order ID: ${order_id})`,
            orderId: order_id  // ✅ Linking transaction to payment order
        });
        await coinTransaction.save();

        res.status(200).json({ message: "Payment verified and coins added successfully" });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


module.exports = router;