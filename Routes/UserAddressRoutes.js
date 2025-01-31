const express = require("express");
const mongoose = require("mongoose");
const Address = require("../Models/ProductModels/address");
const authenticateToken = require("../Modules/authMiddleware");
const router = express.Router();

// Add a new address
router.post("/add-address", authenticateToken, async (req, res) => {
    try {
        const { houseNumber, name, address, landmark, pincode, state, city, phoneNumber } = req.body;
        const userId = req.user._id; // Get userId from JWT token

        const existingAddresses = await Address.find({ userId });
        const isFirstAddress = existingAddresses.length === 0;
        
        const newAddress = new Address({
            userId,
            houseNumber,
            name,
            address,
            landmark,
            pincode,
            state,
            city,
            phoneNumber,
            defaultAddress: isFirstAddress // Set first address as default
        });

        await newAddress.save();
        return res.status(201).json({ message: "Address added successfully", address: newAddress });
    } catch (error) {
        return res.status(500).json({ message: "Error adding address", error: error.message });
    }
});

// Get all addresses for a user with pagination
router.get("/user-address", authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id; // Get userId from JWT token
        const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10

        const skip = (page - 1) * limit; // Calculate the number of records to skip
        const addresses = await Address.find({ userId })
            .skip(skip)  // Skip the records based on the page number
            .limit(limit); // Limit the number of records per page

        const totalAddresses = await Address.countDocuments({ userId }); // Get the total number of addresses
        const totalPages = Math.ceil(totalAddresses / limit); // Calculate total pages

        return res.status(200).json({
            addresses,
            pagination: {
                currentPage: page,
                totalPages,
                totalAddresses,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching addresses", error: error.message });
    }
});


// Update an existing address
router.put("/update-address/:addressId", authenticateToken, async (req, res) => {
    try {
        const updatedAddress = await Address.findByIdAndUpdate(req.params.addressId, req.body, { new: true });
        if (!updatedAddress) return res.status(404).json({ message: "Address not found" });
        return res.status(200).json({ message: "Address updated successfully", address: updatedAddress });
    } catch (error) {
        return res.status(500).json({ message: "Error updating address", error: error.message });
    }
});

// Change default address
router.put("/set-default-address/:addressId", authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id; // Get userId from JWT token
        await Address.updateMany({ userId }, { defaultAddress: false }); // Reset all to false
        const updatedAddress = await Address.findByIdAndUpdate(req.params.addressId, { defaultAddress: true }, { new: true });
        if (!updatedAddress) return res.status(404).json({ message: "Address not found" });
        return res.status(200).json({ message: "Default address updated", address: updatedAddress });
    } catch (error) {
        return res.status(500).json({ message: "Error updating default address", error: error.message });
    }
});

// Delete an address
router.delete("/delete-address/:addressId", authenticateToken, async (req, res) => {
    try {
        const address = await Address.findById(req.params.addressId);
        if (!address) return res.status(404).json({ message: "Address not found" });

        // Check if the address is the default address
        if (address.defaultAddress) {
            return res.status(400).json({ message: "Cannot delete the default address. Please change the default address before deleting." });
        }

        // Proceed to delete if not the default address
        await Address.findByIdAndDelete(req.params.addressId);
        return res.status(200).json({ message: "Address deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting address", error: error.message });
    }
});

module.exports = router;