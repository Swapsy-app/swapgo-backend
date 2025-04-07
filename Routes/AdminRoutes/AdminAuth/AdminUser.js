const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Admin = require("../../../Models/Admin/AdminAuthModel");
const { sendEmail } = require("../../../Modules/Email");
const BlacklistedToken = require("../../../Models/blacklistedAccessToken");
const adminAuth = require("../../../Modules/adminAuthMiddleware");

// AES encryption config
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const iv = Buffer.from(process.env.ENCRYPTION_IV, "hex");

function encrypt(data) {
    const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
}

function decrypt(data) {
    const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// 1️⃣ Create Admin (Only Superadmin + Super Password)
router.post("/create-admin", adminAuth("superadmin"), async (req, res) => {
    try {
        const { name, email, mobile, password, superPass } = req.body;
        if (!name || !email || !mobile || !password || !superPass) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        if (superPass !== process.env.SUPER_ADMIN_PASSKEY) {
            return res.status(403).json({ message: "Invalid Super Password" });
        }

        // Check if email/mobile already exist
        const existing = await Admin.findOne({ $or: [{ email }, { mobile }] });
        if (existing) {
            return res.status(409).json({ message: "Admin with given email or mobile already exists" });
        }

        // Generate unique username
        let baseUsername = name.toLowerCase().replace(/\s+/g, '');
        let uniqueUsername = '';
        let isUnique = false;
        while (!isUnique) {
            const randomChars = crypto.randomBytes(3).toString("hex");
            uniqueUsername = (baseUsername + randomChars).slice(0, 20);
            const userExists = await Admin.findOne({ username: uniqueUsername });
            if (!userExists) isUnique = true;
        }

        // Generate unique login passkey and ensure it's unique
        let loginPasskey = '';
        let uniquePasskey = false;
        while (!uniquePasskey) {
            loginPasskey = crypto.randomBytes(4).toString("hex"); // 8 char
            const passkeyExists = await Admin.findOne({ loginPasskey: encrypt(loginPasskey) });
            if (!passkeyExists) uniquePasskey = true;
        }

        const encryptedLoginPasskey = encrypt(loginPasskey);

        // Save new admin
        const newAdmin = new Admin({
            name,
            email,
            mobile,
            username: uniqueUsername,
            password,
            loginPasskey: encryptedLoginPasskey,
        });

        await newAdmin.save();

        res.status(201).json({
            message: "Admin created successfully. Share the login passkey securely.",
            loginPasskey,
            username: uniqueUsername,
        });

    } catch (error) {
        console.error("Create admin error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// 2️⃣ Login Admin (Only if role ≠ "not_verified")
router.post("/login-admin", async (req, res) => {
    try {
        const { email, password, loginPasskey } = req.body;
        if (!email || !password || !loginPasskey)
            return res.status(400).json({ message: "Missing credentials" });

        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(404).json({ message: "Admin not found" });
        if (admin.role === "not_verified")
            return res.status(403).json({ message: "Admin not verified yet" });

        const validPass = await bcrypt.compare(password, admin.password);
        if (!validPass) return res.status(401).json({ message: "Invalid password" });

        const decryptedLoginPasskey = decrypt(admin.loginPasskey);
        if (loginPasskey !== decryptedLoginPasskey)
            return res.status(401).json({ message: "Invalid login passkey" });

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpEncrypted = encrypt(otp);
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        admin.otp = otpEncrypted;
        admin.otpExpires = otpExpires;
        await admin.save();

        await sendEmail(admin.email, "Your Admin OTP", `Your OTP is: ${otp}`);

        res.status(200).json({ message: "OTP sent to email" });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// 3️⃣ Verify OTP & Generate Tokens
// 3️⃣ Verify OTP & Generate Tokens
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(404).json({ message: "Admin not found" });

        const decryptedOTP = decrypt(admin.otp);
        if (decryptedOTP !== otp)
            return res.status(400).json({ message: "Invalid OTP" });

        if (admin.otpExpires < Date.now())
            return res.status(400).json({ message: "OTP expired" });

        // ✅ Use _id (not id)
        const accessToken = jwt.sign(
            { _id: admin._id.toString(), role: admin.role },
            process.env.JWT_TOKEN,
            { expiresIn: "30m" }
        );

        const refreshToken = jwt.sign(
            { _id: admin._id.toString() },
            process.env.JWT_REFRESH_TOKEN,
            { expiresIn: "7d" }
        );

        admin.refreshToken = refreshToken;
        admin.otp = null;
        admin.otpExpires = null;
        await admin.save();

        res.status(200).json({ accessToken, refreshToken });

    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ message: "Server error" });
    }
});


// 4️⃣ Refresh Token to Get New Access Token
// 4️⃣ Refresh Token to Get New Access Token
router.post("/refresh-token", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ message: "Token missing" });

        const admin = await Admin.findOne({ refreshToken });
        if (!admin) return res.status(403).json({ message: "Invalid refresh token" });

        jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN, (err, decoded) => {
            if (err) return res.status(403).json({ message: "Token expired" });

            // ✅ Use _id in new token
            const accessToken = jwt.sign(
                { _id: admin._id.toString(), role: admin.role },
                process.env.JWT_TOKEN,
                { expiresIn: "30m" }
            );

            res.status(200).json({ accessToken });
        });

    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(500).json({ message: "Server error" });
    }
});


// 5️⃣ Logout (Blacklist Access Token + Clear Refresh)
router.post("/logout", adminAuth(), async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (token) {
            // Add token to the blacklist DB
            await BlacklistedToken.create({ token });

            // Clear refresh token from DB
            await Admin.findByIdAndUpdate(req.admin.id, { $unset: { refreshToken: 1 } });
        }

        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Logout failed" });
    }
});


module.exports = router;
