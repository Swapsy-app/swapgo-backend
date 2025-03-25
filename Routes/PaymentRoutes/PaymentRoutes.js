const express = require("express");
const router = express.Router();
const axios = require("axios");
const PaymentOrder = require("../../Models/PaymentGatewayModels/PaymentGateway");
const authenticateToken = require("../../Modules/authMiddleware");
const User = require("../../Models/User");

router.post("/create-payment", authenticateToken, async (req, res) => {
    try {
        const { amount, type } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

        const userId = req.user._id;
        const orderId = `order_${Date.now()}_${userId}`;

       // Set order expiry time to 72 hours (3 days) from now
        const orderExpiryTime = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours = 3 days


        const cashfreeResponse = await axios.post(
            "https://sandbox.cashfree.com/pg/orders",
            {
                order_id: orderId,
                order_amount: amount,
                order_currency: "INR",
                customer_details: {
                    customer_id: userId.toString(),
                    customer_name: req.user.name,
                    customer_email: req.user.email,
                    customer_phone: req.user.mobile
                },
                order_meta: {
                    return_url: `https://localhost:3000/payment-status?order_id=${orderId}`,
                    notify_url: 'https://localhost:3000/api/paymentwebhook/cashfree-webhook'
                },
                order_note: `Payment for ${type}`,
                order_expiry_time: orderExpiryTime  // Add expiry time here
            },
            {
                headers: {
                    "x-client-id": process.env.CASHFREE_CLIENT_ID,
                    "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
                    "Content-Type": "application/json",
                    "x-api-version": "2025-01-01"
                }
            }
        );

        // Save payment order in DB
        const newOrder = new PaymentOrder({
            userId,
            orderId,
            type, // "coin_purchase", "product_payment", "wallet_topup"
            amount,
            status: "pending",
            expiryTime: orderExpiryTime // Store expiry time in DB
        });

        await newOrder.save();

        res.json({ paymentLink: cashfreeResponse.data, orderId });
    } catch (error) {
        console.error("Cashfree Error:", error.response?.data || error.message);
        res.status(500).json({ message: "Payment initiation failed" });
    }
});

module.exports = router;
