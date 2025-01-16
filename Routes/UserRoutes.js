// Importing required modules
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const userRouter = express.Router();
const User = require("../Models/User");
const { sendEmail } = require("../Modules/Email");

// AES encryption key and initialization vector (IV)
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex"); // 256-bit key
const iv = Buffer.from(process.env.ENCRYPTION_IV, "hex"); // 128-bit IV


// Function to encrypt data
function encrypt(data) {
    const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
}

// Function to decrypt data
function decrypt(data) {
    const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// Function to create a unique username
async function generateUsername(name) {
    let username;

    // Validate the input name
    if (typeof name !== 'string' || name.trim() === '') {
        // If name is missing or invalid, generate a random username directly
        username = await generateUniqueRandomUsername();
        return username;
    }

    // Normalize the name and remove non-alphanumeric characters
    username = name.toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 30);

    // Check if the username is unique
    let user = await User.findOne({ username });

    if (!user) {
        return username; // If the username is unique, return it
    }

    // If the username already exists, attempt to find a unique one by appending a counter
    let counter = 1;
    let maxRetries = 10; // Limit attempts to prevent infinite loops
    while (user && counter <= maxRetries) {
        username = name.toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 30 - counter) + counter;
        user = await User.findOne({ username });
        counter++;
    }

    // If a unique username is not found after maxRetries, fallback to a random unique username
    if (counter > maxRetries) {
        username = await generateUniqueRandomUsername();
    }

    return username;
}

// Helper function to generate a random 30-character username and ensure uniqueness
// Helper function to generate a unique random username starting with shorter lengths
async function generateUniqueRandomUsername() {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789_';
    let isUnique = false;
    let randomUsername = '';

    // Start with shorter usernames and progressively increase the length
    for (let length = 1; length <= 30; length++) {
        while (!isUnique) {
            // Generate a random username of the current length
            randomUsername = Array.from({ length }, () =>
                characters.charAt(Math.floor(Math.random() * characters.length))
            ).join('');

            // Check if the username is unique
            const user = await User.findOne({ username: randomUsername });
            if (!user) {
                isUnique = true; // The username is unique
                break; // Exit the loop as we've found a unique username
            }
        }

        // If a unique username is found, stop the process
        if (isUnique) {
            break;
        }
    }

    return randomUsername;
}



/** 
*@swagger
* /signup:
*  post:
*    summary: Create a new user/Signup
*    tags: [User SignUp Route]
*    description: This endpoint is used to create a new user
*    consumes:
*      - application/json
*    parameters:
*      - in: body
*        name: user
*        description: User object
*        schema:
*          type: object
*          required:
*            - name
*            - email
*            - password
*          properties:
*            name:
*              type: string
*              description: User name
*            mobile:
*              type: string
*              description: User mobile number
*            email:
*              type: string
*              format: email
*              description: User email
*            password:
*              type: string
*              description: User password
*    responses:
*      '201':
*        description: User created successfully
*/
// Handling signup request using router
userRouter.post("/signup", async (req, res) => {
    const { name, email, mobile, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });

        // If the user exists and their email is not verified, update the user data
        if (existingUser && !existingUser.isVerified) {
            // If OTP hasn't expired, expire the old OTP and generate a new one
            if (existingUser.otpExpires > Date.now()) {
                existingUser.otp = null;
                existingUser.otpExpires = null;
                await existingUser.save();
            }

            // Update user data (e.g., name, mobile, password)
            existingUser.name = name;
            existingUser.mobile = mobile;
            existingUser.password = password ? await bcrypt.hash(password, 10) : existingUser.password; // Update password if provided
            const otp = crypto.randomInt(100000, 999999).toString();
            const encryptedOtp = encrypt(otp);
            existingUser.otp = encryptedOtp;
            existingUser.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

            await existingUser.save();

            // Send the new OTP to the user's email
            await sendEmail(email, "Your OTP for Verification", `Your OTP is: ${otp}`);
            return res.status(200).send({ message: "User already exists but not verified. Your details have been updated. A new OTP has been sent." });
        }

        // If the user already exists and is verified, prompt to login
        if (existingUser && existingUser.isVerified) {
            return res.status(400).send({ message: "Email already registered. Please login." });
        }

        // Generate a unique username based on the name
        const username = await generateUsername(name);

        // If no user exists, create a new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(100000, 999999).toString();
        const encryptedOtp = encrypt(otp);

        const newUser = new User({
            name,
            email,
            mobile,
            password: hashedPassword,
            otp: encryptedOtp,
            otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
            username, // Add the generated username to the user object
        });

        await newUser.save();
        await sendEmail(email, "Your OTP for Verification", `Your OTP is: ${otp}`);
        res.status(201).send({ message: "Signup successful. Please verify your email." });
    } catch (err) {
        console.error("Error saving new user:", err);
        res.status(500).send({ message: "Error creating user. Please try again later." });
    }
});



// Verify OTP route for SignUp
userRouter.post("/signup/otp/verify", async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) return res.status(400).send({ message: "User not found" });

        const decryptedOtp = decrypt(user.otp);
        if (decryptedOtp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).send({ message: "Invalid or expired OTP" });
        }

        user.otp = null;
        user.otpExpires = null;
        user.isVerified = true; // Mark as verified
        await user.save();

        // Generate access token (1 hour expiry)
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_TOKEN, { expiresIn: "1h" });

        // Generate long-lived refresh token (e.g., 10 years or "forever")
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_TOKEN, { expiresIn: "180d" });

        // Save the refresh token to the database
        user.refreshToken = refreshToken;
        await user.save(); // Save the user document with the new refresh token

        // Send the tokens to the client
        res.send({
            message: "Email verified. You are now logged in.",
            accessToken,
            refreshToken,
        });
    } catch (err) {
        console.error("Error verifying OTP:", err);
        res.status(500).send("Error verifying OTP");
    }
});



// SignIn with password route
userRouter.post("/signin", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user || !user.isVerified) {
            return res.status(400).send("User not registered or email not verified. Please signup and verify your email.");
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).send("Invalid credentials");

        // Generate access token (1 hour expiry)
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_TOKEN, { expiresIn: "1h" });

        // Generate long-lived refresh token (e.g., 10 years or "forever")
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_TOKEN, { expiresIn: "180d" });

        // Save the refresh token to the database
        user.refreshToken = refreshToken;
        await user.save(); // Save the user document with the new refresh token

        // Send the tokens to the client
        res.send({ message: "Login successful", accessToken, refreshToken });
    } catch (err) {
        console.error("Error signing in:", err);
        res.status(500).send("Error signing in");
    }
});

userRouter.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).send("Refresh token is required");
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN);

        // Find the user based on the decoded user ID
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).send("Invalid or expired refresh token");
        }

        // Issue a new access token
        const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_TOKEN, { expiresIn: "1h" });

        res.send({ accessToken });
    } catch (err) {
        console.error("Error refreshing token:", err);
        res.status(403).send("Invalid refresh token or expired");
    }
});



// Generate OTP for Sign In
userRouter.post("/signin/otp", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("User not found");

        if (!user.isVerified) {
            return res.status(400).send("User not verified. Please complete the signup process.");
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const encryptedOtp = encrypt(otp);
        user.otp = encryptedOtp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        await sendEmail(email, "Verify Your Login", `Your OTP is ${otp}`);
        res.send("OTP sent to your email. Please verify to login.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating OTP");
    }
});


// Verify OTP for Sign In
userRouter.post("/signin/otp/verify", async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("Invalid OTP");

        const decryptedOtp = decrypt(user.otp);
        if (decryptedOtp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).send("OTP expired or invalid");
        }

        // Clear OTP fields after successful verification
        user.otp = null;
        user.otpExpires = null;

        // Generate access token (valid for 1 hour)
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_TOKEN, { expiresIn: "1h" });

        // Generate refresh token (longer validity, e.g., 6 months)
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_TOKEN, { expiresIn: "180d" });

        // Save the refresh token to the database
        user.refreshToken = refreshToken;
        await user.save();

        res.send({
            message: "Login successful",
            accessToken,
            refreshToken,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error verifying OTP");
    }
});


// Resend OTP route
userRouter.post("/resend-otp", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("User not found");

        const otp = crypto.randomInt(100000, 999999).toString();
        const encryptedOtp = encrypt(otp);
        user.otp = encryptedOtp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        await sendEmail(email, "Your OTP", `Your OTP is: ${otp}`);

        res.send("OTP resent to your email.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error resending OTP");
    }
});

// Logout route
userRouter.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).send("Refresh token is required");
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN);

        // Find the user based on the decoded user ID
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).send("Invalid or expired refresh token");
        }

        // Remove the refresh token from the user document to logout
        user.refreshToken = null;
        await user.save();

        // Respond to indicate the user has been logged out
        res.send("Logout successful");
    } catch (err) {
        console.error("Error logging out:", err);
        res.status(500).send("Error logging out");
    }
});


// Forgot Password route
userRouter.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("User not found");

        const otp = crypto.randomInt(100000, 999999).toString();
        const encryptedOtp = encrypt(otp);
        user.otp = encryptedOtp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        await sendEmail(email, "Your OTP for Password Reset", `Your OTP is: ${otp}`);
        res.send("OTP sent to your email.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error sending OTP");
    }
});

userRouter.post("/forget-pass/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send("User not found");

        const decryptedOtp = decrypt(user.otp);
        if (decryptedOtp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).send("Invalid or expired OTP");
        }

        // Clear OTP fields
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        // Generate a temporary token
        const resetToken = jwt.sign({ email }, process.env.JWT_TOKEN, { expiresIn: "10m" }); // Token valid for 15 minutes
        res.send({ message: "OTP verified. Use this token to reset your password.", resetToken });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error verifying OTP");
    }
});

// Reset Password using the temporary token
userRouter.post("/reset-password", async (req, res) => {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.status(400).send("Passwords do not match");
    }

    try {
        const decoded = jwt.verify(resetToken, process.env.JWT_TOKEN);
        const user = await User.findOne({ email: decoded.email });

        if (!user) return res.status(400).send("User not found");

        // Update the password
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.send("Password reset successful. You can now login.");
    } catch (err) {
        console.error(err);
        res.status(400).send("Invalid or expired token");
    }
});


// Exporting the router
module.exports = userRouter;
