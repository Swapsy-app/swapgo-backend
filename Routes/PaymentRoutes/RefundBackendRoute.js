const axios = require("axios");

const processRefund = async (orderId, refundAmount, refundId, refundNote) => {
    try {
        const response = await axios.post(`https://sandbox.cashfree.com/pg/orders/${orderId}/refunds`, {
            refund_amount: refundAmount,
            refund_id: refundId,
            refund_note: refundNote,
            refund_speed: "STANDARD", // or "INSTANT"
        }, {
            headers: {
                "x-client-id": process.env.CASHFREE_CLIENT_ID,
                "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
                "Content-Type": "application/json",
                "x-api-version": "2025-01-01"
            }
        });

        return response.data;
    } catch (error) {
        console.error("Cashfree refund error:", error?.response?.data || error.message);
        return { error: "Refund request failed" };
    }
};

module.exports = { processRefund };
