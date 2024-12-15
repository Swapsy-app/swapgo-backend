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

        res.status(201).send('Signup successful. Please verify your email.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error signing up');
    }

    
});

// Exporting the router
module.exports=userRouter