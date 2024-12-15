// Importing express module
const express=require("express");
const userRouter=express.Router();

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