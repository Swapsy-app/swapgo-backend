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

//calculate shipping charge route
router.get("/calculate-shipping-charge", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // from access token
        const { productId, addressId } = req.query;

        if (!productId) return res.status(400).json({ message: "Product ID is required" });

        // Fetch product and pickup pincode and weight
        const product = await Product.findById(productId).select("pickupAddress weight");
        if (!product || !product.pickupAddress || !product.weight) {
            return res.status(400).json({ message: "Incomplete product information" });
        }

        const pickup = await Address.findById(product.pickupAddress).select("pincode");
        if (!pickup) return res.status(400).json({ message: "Pickup address not found" });
        const sellerPincode = pickup.pincode;

        // Fetch buyer address
        let buyerPincode;
        if (addressId) {
            const buyerAddress = await Address.findById(addressId).select("pincode");
            if (!buyerAddress) return res.status(400).json({ message: "Invalid address ID" });
            buyerPincode = buyerAddress.pincode;
        } else {
            const defaultAddress = await Address.findOne({ userId, defaultAddress: true }).select("pincode");
            if (!defaultAddress) return res.status(400).json({ message: "No default address found. Please provide addressId." });
            buyerPincode = defaultAddress.pincode;
        }

        // Fetch delivery zone using Delhivery API
        const zoneResponse = await axios.get("https://track.delhivery.com/api/kinko/v1/invoice/charges/.json", {
            params: {
                md: "S",
                o_pin: sellerPincode,
                d_pin: buyerPincode,
                cgm: 500, // Initial dummy weight
                ss: "DTO"
            },
            headers: {
                "Authorization": `Token ${DELHIVERY_API_KEY}`,
                "Accept": "application/json"
            }
        });

        let deliveryZone = "F"; // Default
        if (zoneResponse.data?.[0]?.zone) {
            deliveryZone = normalizeZone(zoneResponse.data[0].zone.trim());
        }

        // Determine charge slab based on weight
        let weightSlab = "";
        let weight; // ✅ define here
        const validSlabs = ["0-500g", "500g-1kg", "1kg-2kg", "2kg-5kg", "5kg-10kg"];
        
        if (typeof product.weight === "string") {
          const normalized = product.weight.toLowerCase().replace(/\s+/g, '');
          if (validSlabs.includes(normalized)) {
            weightSlab = normalized;
          } else {
            console.log("⚠️ Invalid weight string format:", product.weight);
          }
        } else if (typeof product.weight === "number") {
          weight = product.weight; // ✅ assign to outer variable
          console.log("Weight is a number:", weight);
        
          if (weight <= 500) weightSlab = "0-500g";
          else if (weight <= 1000) weightSlab = "500g-1kg";
          else if (weight <= 2000) weightSlab = "1kg-2kg";
          else if (weight <= 5000) weightSlab = "2kg-5kg";
          else if (weight <= 10000) weightSlab = "5kg-10kg";
          else weightSlab = "above 10kg";
        }
        

        // Pricing Table (from image)
        const pricingTable = {
            "A": {
                "0-500g": [50, 5],
                "500g-1kg": [90, 9],
                "1kg-2kg": [150, 20],
                "2kg-5kg": [250, 40],
                "5kg-10kg": [340, 60],
            },
            "B": {
                "0-500g": [80, 15],
                "500g-1kg": [150, 35],
                "1kg-2kg": [230, 45],
                "2kg-5kg": [310, 55],
                "5kg-10kg": [540, 97],
            },
            "C": {
                "0-500g": [80, 15],
                "500g-1kg": [150, 35],
                "1kg-2kg": [230, 45],
                "2kg-5kg": [310, 55],
                "5kg-10kg": [540, 97],
            },
            "D": {
                "0-500g": [80, 15],
                "500g-1kg": [150, 35],
                "1kg-2kg": [230, 45],
                "2kg-5kg": [310, 55],
                "5kg-10kg": [540, 97],
            },
            "E": {
                "0-500g": [80, 15],
                "500g-1kg": [150, 35],
                "1kg-2kg": [230, 45],
                "2kg-5kg": [310, 55],
                "5kg-10kg": [540, 97],
            },
            "F": {
                "0-500g": [110, 25],
                "500g-1kg": [200, 45],
                "1kg-2kg": [340, 65],
                "2kg-5kg": [400, 85],
                "5kg-10kg": [640, 97],
            }
        };

        const zoneData = pricingTable[deliveryZone] || pricingTable["F"];
        const [shippingCharge, convenienceCharge] = zoneData[weightSlab];

        return res.json({
            sellerPincode,
            buyerPincode,
            deliveryZone,
            weight: `${weight}g`,
            weightSlab,
            shippingCharge,
            convenienceCharge,
            totalCharge: shippingCharge + convenienceCharge
        });

    } catch (err) {
        console.error("Error in calculate-shipping-charge:", err.response?.data || err.message);
        res.status(500).json({ message: "Something went wrong while calculating shipping charge." });
    }
});


module.exports = router;
