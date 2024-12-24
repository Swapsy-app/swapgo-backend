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
userRouter.post("/signup",async (req,res,next)=>{
    const { name, email, mobile, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = crypto.randomInt(100000, 999999).toString();

        const newUser = new User({
            name,
            email,
            mobile,
            password: hashedPassword,
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
        });
        await newUser.save();

        await sendEmail(email, 'Your OTP for Verification', `Your OTP is : ${otp}`);

        res.status(201).send({'message':'Signup successful. Please verify your email.'});
    } catch (err) {
        console.error(err);
        res.status(500).send({'messsage':err.errmsg});
    }

    
});


// Verify OTP route for SignUp
// Write documentation of swagger here👇

userRouter.post('/signup/otp/verify', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email, otp });
        if (!user || user.otpExpires < Date.now()) {
            return res.status(400).send('Invalid or expired OTP');
        }

        user.otp = null;
        user.otpExpires = null;
        await user.save();

        res.send('Email verified. You can now login.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error verifying OTP');
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
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send('User not found');

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
        await sendEmail(email, 'Reset Your Password', `Click the link to reset your password: ${resetUrl}`);

        res.send('Password reset email sent.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error sending reset email');
    }
});

// Reset Password route
userRouter.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).send('Invalid or expired reset token');

        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.send('Password reset successful. You can now login.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error resetting password');
    }
});


// Exporting the router
module.exports=userRouter;