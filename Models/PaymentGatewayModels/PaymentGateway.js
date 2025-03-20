const mongoose = require("mongoose");

const paymentOrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: String, unique: true, required: true },
    type: { type: String, enum: ["coin_purchase", "product_payment"], required: true },
    amount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ["pending", "success", "failed", "cancelled", "unknown"],  // 👈 Explicitly define possible statuses
        default: "pending" 
    },
    referenceId: { type: String }, // Stores cf_payment_id
    bankReferenceId: { type: String }, // Stores bank reference
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PaymentOrder", paymentOrderSchema);
