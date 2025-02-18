const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User model
    houseNumber: { type: String, required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    landmark: { type: String },
    pincode: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    phoneNumber: { type: String, required: true },
      // New Fields from Delhivery API
      pickupAvailable: { type: Boolean, default: false },
      deliveryAvailable: { type: Boolean, default: false },
      codAvailable: { type: Boolean, default: false },
    defaultAddress: { type: Boolean, default: false } // Mark as default address
  },
  { timestamps: true }
);

module.exports = mongoose.model("Address", addressSchema);
