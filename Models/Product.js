const mongoose = require('mongoose');

// Product Schema
const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    photos: [{ type: String, required: true }],
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    condition: { type: String, required: true },
    weight: { type: Number },
    manufacturingCountry: { type: String },
    gstDetails: { type: String },
    location: { type: String },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    attributes: { type: Map, of: String }, // Store specific attributes dynamically
});

module.exports = mongoose.model('Product', productSchema);
