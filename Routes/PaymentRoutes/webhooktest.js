const crypto = require("crypto");
require("dotenv").config();

const secretKey = process.env.CASHFREE_CLIENT_SECRET; // Use your actual secret key
const timestamp = Math.floor(Date.now() / 1000).toString(); // Current UNIX timestamp
const rawBody = JSON.stringify({
    data: {
        order: {
            order_id: "order_1742230481873_678778c26ade644a89fecbd0",
            order_amount: 1000,
            order_currency: "INR",
            order_tags: null
        },
        payment: {
            cf_payment_id: "1453002796",
            payment_status: "SUCCESS",
            payment_amount: 1000,
            payment_currency: "INR",
            payment_message: "00::Transaction success",
            payment_time: "2025-03-16T12:00:00+05:30",
            bank_reference: "234928698582",
            auth_id: null,
            payment_method: {
                upi: {
                    channel: null,
                    upi_id: "customer@upi"
                }
            },
            payment_group: "upi"
        }
    },
    event_time: "2025-03-16T12:01:00+05:30",
    type: "PAYMENT_SUCCESS_WEBHOOK"
});

const signedPayload = timestamp + rawBody;
const computedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(signedPayload)
    .digest("base64");

console.log("x-webhook-timestamp:", timestamp);
console.log("x-webhook-signature:", computedSignature);
