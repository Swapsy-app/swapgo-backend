const mongoose = require('mongoose');
// Product Schema
const productSchema = new mongoose.Schema({
    category: { type: String, required: true }, // e.g., Women > Ethnic > Saree
    photos: [{ type: String, required: true }], // Array of photo URLs
    title: { type: String, required: true },
    description: { type: String, required: true },
    condition: { type: String, required: true },
    manufacturingCountry: { type: String, required: true },
    weight: { type: Number, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 }, // Default is 1
    attributes: { // Custom attributes per category
        brand: { type: String, default: 'Unknown' },
        fabric: { type: String, default: 'Unknown' },
        color: { type: String, default: 'Unknown' },
        occasion: { type: String, default: 'Unknown' },
        size: { type: String, default: 'Unknown' },
        shape: { type: String, default: 'Unknown' }
    },
    customAttributes: { type: Map, of: String }, // Seller-defined custom data
    location: { type: String, required: true },
    gstDetails: { type: String, required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Reference to the User model
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
