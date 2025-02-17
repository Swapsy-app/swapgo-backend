const express = require("express");
const axios = require("axios");
const router = express.Router();
const authenticateToken = require("../../Modules/authMiddleware");
const jwt = require('jsonwebtoken');
const Address = require("../../Models/ProductModels/address"); // Import User model 
const Product = require("../../Models/ProductModels/Product"); // Import Product model

const DELHIVERY_API_URL = "https://track.delhivery.com/c/api/pin-codes/json/";
const DELHIVERY_API_KEY = process.env.DELHIVERY_API_KEY; // Replace with your API key


// Utility function to normalize zone (D1, D2 → D, etc.)
const normalizeZone = (zone) => {
    if (zone && /^[A-F]\d*$/.test(zone)) {
        return zone.charAt(0); // Extract only the first letter
    }
    return "F"; // Default zone if invalid
};


// Route to check pincode serviceability (Authentication is OPTIONAL)
router.get("/check-serviceability-pincode", async (req, res) => {
    try {
        let { pincode } = req.query; // User-entered pincode (optional)

        // Check if the request has a valid user token (make auth optional)
        let userId = null;
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(" ")[1]; // Extract token
                const decoded = jwt.verify(token, process.env.JWT_TOKEN); // Verify token
                userId = decoded.id;
            } catch (error) {
                console.warn("Invalid or expired token, proceeding without user info.");
            }
        }

        // If no pincode provided and user is authenticated, fetch the default address
        if (!pincode && userId) {
            const defaultAddress = await Address.findOne({ userId, defaultAddress: true });
            if (defaultAddress && defaultAddress.pincode) {
                pincode = defaultAddress.pincode;
            }
        }

        // If still no pincode found, return an error
        if (!pincode) {
            return res.status(400).json({ message: "Pincode is required!" });
        }

        // Make request to Delhivery API
        const response = await axios.get(`${DELHIVERY_API_URL}?filter_codes=${pincode}`, {
            headers: {
                "Authorization": `Token ${process.env.DELHIVERY_API_KEY}`,
                "Accept": "application/json"
            }
        });

        // Extract serviceability details
        if (response.data.delivery_codes && response.data.delivery_codes.length > 0) {
            const serviceability = response.data.delivery_codes[0].postal_code;
            return res.json(serviceability);
        } else {
            return res.status(404).json({ message: "Pincode not serviceable" });
        }
    } catch (error) {
        console.error("Error fetching pincode serviceability:", error);
        return res.status(500).json({ message: "Server error, try again later." });
    }
});

router.get("/estimate-delivery", async (req, res) => {
    try {
        let { pincode, productId } = req.query;

        if (!productId) {
            return res.status(400).json({ message: "Product ID is required!" });
        }

        // Fetch product's pickup address (seller's pincode)
        const product = await Product.findById(productId).select("pickupAddress");
        if (!product || !product.pickupAddress) {
            return res.status(400).json({ message: "Pickup address not found for this product!" });
        }

        const pickupAddress = await Address.findById(product.pickupAddress).select("pincode");
        if (!pickupAddress || !pickupAddress.pincode) {
            return res.status(400).json({ message: "Seller's pincode not found!" });
        }
        const sellerPincode = pickupAddress.pincode;

        // Fetch buyer's pincode if not provided
        let buyerPincode = pincode;
        if (!buyerPincode && req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(" ")[1];
                const decoded = jwt.verify(token, process.env.JWT_TOKEN);
                const defaultAddress = await Address.findOne({ userId: decoded.id, defaultAddress: true });
                if (defaultAddress && defaultAddress.pincode) {
                    buyerPincode = defaultAddress.pincode;
                }
            } catch (error) {
                console.warn("Invalid or expired token, proceeding without user info.");
            }
        }

        if (!buyerPincode) {
            return res.status(400).json({ message: "Buyer's pincode is required!" });
        }

        // Call Delhivery API for zone estimation
        const zoneResponse = await axios.get("https://track.delhivery.com/api/kinko/v1/invoice/charges/.json", {
            params: {
                md: "S",
                o_pin: sellerPincode,
                d_pin: buyerPincode,
                cgm: 500, // Default chargeable weight
                ss: "DTO"
            },
            headers: {
                "Authorization": `Token ${process.env.DELHIVERY_API_KEY}`,
                "Accept": "application/json"
            }
        });

        console.log("Delhivery API Response:", JSON.stringify(zoneResponse.data, null, 2)); // Debugging

        // Extract and normalize zone
        let deliveryZone = "F"; // Default
        if (zoneResponse.data && Array.isArray(zoneResponse.data) && zoneResponse.data.length > 0) {
            const zoneData = zoneResponse.data[0]; // First object in response
            if (zoneData.zone) {
                deliveryZone = normalizeZone(zoneData.zone.trim());
            }
        }

        console.log("Extracted Zone:", deliveryZone); // Debugging

        // Determine estimated delivery days based on zone
        const zoneDaysMapping = {
            "A": 5,
            "B": 7,
            "C": 9,
            "D": 9,
            "E": 9,
            "F": 9
        };
        const estimatedDays = zoneDaysMapping[deliveryZone] || 9; // Default 9 days if unrecognized

        // Calculate estimated dates
        const currentDate = new Date();
        const sellerShipDate = new Date(currentDate);
        sellerShipDate.setDate(currentDate.getDate() + 3); // Seller takes 3 days to ship

        const estimatedDeliveryDate = new Date(currentDate);
        estimatedDeliveryDate.setDate(currentDate.getDate() + estimatedDays);

        return res.json({
            message: `Estimated delivery date: ${estimatedDeliveryDate.toDateString()}`,
            estimatedSellerShipDate: sellerShipDate.toDateString(),
            sellerPincode,
            buyerPincode,
            deliveryZone,
            estimatedDays
        });

    } catch (error) {
        console.error("Error estimating delivery date:", error.response?.data || error.message);
        return res.status(500).json({ message: "Server error, try again later." });
    }
});


module.exports = router;
