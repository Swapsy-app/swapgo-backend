// Importing express module
const express=require("express");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRouter=express.Router();
const User=require("../Models/User");
const {sendEmail}=require("../Modules/Email");

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
const tempUsers = new Map(); // Use Map to store temporary users by email

userRouter.post("/signup", async (req, res, next) => {
    const { name, email, mobile, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(100000, 999999).toString();

        tempUsers.set(email, {
            name,
            email,
            mobile,
            password: hashedPassword,
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
        });

        await sendEmail(email, 'Your OTP for Verification', `Your OTP is: ${otp}`);
        res.status(201).send({ message: 'Signup initiated. Please verify your email.' });
    } catch (err) {
        console.error('Error during signup:', err);
        res.status(500).send({ message: 'Error during signup. Please try again.' });
    }
});


// Verify OTP route for SignUp
// Write documentation of swagger here👇

userRouter.post('/signup/otp/verify', async (req, res) => {
    const { email, otp } = req.body;

    const tempUser = tempUsers.get(email);
    if (!tempUser || tempUser.otp !== otp || tempUser.otpExpires < Date.now()) {
        return res.status(400).send({ message: 'Invalid or expired OTP' });
    }

    try {
        const newUser = new User({
            name: tempUser.name,
            email: tempUser.email,
            mobile: tempUser.mobile,
            password: tempUser.password,
        });

        await newUser.save();
        tempUsers.delete(email); // Remove the temporary user after saving

        res.send({ message: 'Email verified and user created successfully. You can now login.' });
    } catch (err) {
        console.error('Error saving verified user:', err);
        res.status(500).send({ message: 'Error saving user. Please try again.' });
    }
});

// SignIn with password route
userRouter.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send('User not found');

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).send('Invalid credentials');

        const token = jwt.sign({ id: user._id }, 'your-secret-key', { expiresIn: '1h' });

        res.send({ message: 'Login successful', token });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error signing in');
    }
});
// Generate OTP for Sign In
userRouter.post('/signin/otp', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send('User not found');

        const otp = crypto.randomInt(100000, 999999).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        await sendEmail(email, 'Verify Your Login', `Your OTP is ${otp}`);
        res.send('OTP sent to your email. Please verify to login.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating OTP');
    }
});

// Verify OTP for Sign In
userRouter.post('/signin/otp/verify', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email, otp });
        if (!user) return res.status(400).send('Invalid OTP');

        if (user.otpExpires < Date.now()) {
            return res.status(400).send('OTP expired');
        }

        user.otp = null;
        user.otpExpires = null;
        await user.save();

        // Generate a token or session after successful login
        res.send('Login successful');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error verifying OTP');
    }
});

// Resend OTP route
userRouter.post('/resend-otp', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send('User not found');

        const otp = crypto.randomInt(100000, 999999).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        await sendEmail(email, 'Your OTP', `Your OTP is: ${otp}`);

        res.send('OTP resent to your email.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error resending OTP');
    }
});


// Forgot Password route
userRouter.post('/forgot-password', async (req, res) => {
    const { email, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.status(400).send({ message: 'Passwords do not match' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send({ message: 'User not found' });

        const otp = crypto.randomInt(100000, 999999).toString();
        user.resetPasswordToken = otp;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        user.newPassword = await bcrypt.hash(newPassword, 10); // Store the hashed new password temporarily
        await user.save();

        await sendEmail(email, 'OTP for Password Reset', `Your OTP is: ${otp}`);
        res.send({ message: 'OTP sent to your email' });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Error sending OTP' });
    }
});

// Verify OTP and Reset Password - Step 2: Verify OTP and update password
userRouter.post('/reset-password/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email, resetPasswordToken: otp, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).send({ message: 'Invalid or expired OTP' });

        // Update password and clear OTP fields
        user.password = user.newPassword; // Use the hashed password stored temporarily
        user.newPassword = null; // Clear the temporary password
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.send({ message: 'Password reset successful. You can now login.' });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Error resetting password' });
    }
});


// Exporting the router
module.exports=userRouter;