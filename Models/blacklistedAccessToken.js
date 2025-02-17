const mongoose = require("mongoose");

const BlacklistedTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: "2h" } // Automatically delete after 2 hour
});

module.exports = mongoose.model("BlacklistedToken", BlacklistedTokenSchema);
