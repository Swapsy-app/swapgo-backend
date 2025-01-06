const mongoose = require('mongoose');
// Order Schema
const orderSchema = new mongoose.Schema({
    buyer: { type: String, required: true },
    products: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            quantity: { type: Number, required: true },
        },
    ],
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'Pending' },
    orderDate: { type: Date, default: Date.now },
    shippingAddress: { type: String, required: true },
});

module.exports = mongoose.model('Order', orderSchema);