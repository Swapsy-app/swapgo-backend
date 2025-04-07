const jwt = require("jsonwebtoken");
const BlacklistedToken = require("../Models/blacklistedAccessToken");
const Admin = require("../Models/Admin/AdminAuthModel"); // Adjust path if needed

const adminAuth = (requiredRole) => async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        // Check if token is blacklisted
        const isBlacklisted = await BlacklistedToken.findOne({ token });
        if (isBlacklisted) {
            return res.status(401).json({ message: "Token is blacklisted" });
        }

        // Decode token
        const decoded = jwt.verify(token, process.env.JWT_TOKEN);
        if (!decoded._id) {
            return res.status(400).json({ message: "Token does not contain admin ID" });
        }
        console.log("Decoded Admin:", decoded);

        // Find admin by ID
        const admin = await Admin.findById(decoded._id);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        // Check if admin is verified
        if (admin.role === "not_verified") {
            return res.status(403).json({ message: "Forbidden: Admin not verified" });
        }

        // Check role if required
        if (requiredRole && admin.role !== requiredRole) {
            return res.status(403).json({ message: "Forbidden: Insufficient role" });
        }

        // Attach admin info to request
        req.admin = admin;
        next();

    } catch (error) {
        console.error("Admin Auth Error:", error.message);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = adminAuth;
