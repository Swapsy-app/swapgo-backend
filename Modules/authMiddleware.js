const jwt = require("jsonwebtoken");
const User = require("../Models/User"); // Adjust path as per your directory structure
const BlacklistedToken = require("../Models/blacklistedAccessToken"); // Model for storing blacklisted tokens

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access token required" });
    }

    try {
        // Check if the token is blacklisted
        const isBlacklisted = await BlacklistedToken.findOne({ token });
        if (isBlacklisted) {
            return res.status(403).json({ message: "Token has been blacklisted. Please log in again." });
        }

        // Verify JWT token
        jwt.verify(token, process.env.JWT_TOKEN, async (err, decodedUser) => {
            if (err) return res.status(401).json({ message: "Invalid token" });

            const foundUser = await User.findById(decodedUser.id);
            if (!foundUser) {
                return res.status(404).json({ message: "User not found" });
            }

            // Check if the logged-in user is verified
            if (!foundUser.isVerified) {
                return res.status(403).json({ message: "Account not verified" });
            }

            req.user = foundUser;
            next();
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = authenticateToken;
