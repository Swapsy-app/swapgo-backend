// Import mongoose
const mongoose = require('mongoose');

// Category Schema
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    attributes: [{ name: String, values: [String] }], // Dynamic attributes for categories
});

module.exports = mongoose.model('Category', categorySchema);