const mongoose = require('mongoose');

// Seller Schema
const sellerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String },
    gstNumber: { type: String },
});

const Seller = mongoose.model('Seller', sellerSchema);