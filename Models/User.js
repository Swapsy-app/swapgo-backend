const mongoose = require("mongoose");

// User schema
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    mobile: { type: String, unique: true },
    password: String,
    username: { type: String, unique: true, match: /^[a-z0-9_]+$/ },
    avatar: { type: String, enum: ['user.png', 'bear.png', 'boy.png', 'bussiness-man_(1)', 'cat.png', 'gamer_(1).png', 'gamer.png', 'girl.png', 'man_(1).png', 'man_(2).png', 'man_(3).png', 'man_(4).png', 'man_(5).png', 'man_(6).png', 'man.png', 'meerkat.png', 'moslem-woman.png', 'panda.png', 'pensioner.png', 'profile_(1).png', 'profile.png', 'target.png', 'user_(1).png', 'woman.png', 'woman_(1).png', 'woman_(2).png', 'woman_(3).png', 'woman_(4).png', 'woman_(7).png', 'woman_(8).png'], default: 'user.png' },
    aboutMe: { type: String },
    gender: { type: String },
    occupation: { type: String},
    gst: {
        type: String,
        unique: true,
        sparse: true,
        validate: {
            validator: function (value) {
                if (!value) return true; // Allow blank values
                const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
                return gstRegex.test(value);
            },
            message: props => `${props.value} is not a valid GST number!`
        }
    },
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    otp: String,
    otpExpires: Date,
    isVerified: { type: Boolean, default: false }, // New field for verification status
    refreshToken: { type: String } // Store refresh token here
},
{ timestamps: true } // Enable timestamps
);

const User = mongoose.model('User', userSchema);

// Export the User model
module.exports = User;
