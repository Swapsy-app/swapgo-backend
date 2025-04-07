const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    mobile: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // Hashed password
    loginPasskey: { type: String, required: true },
    role: { 
        type: String, 
        enum: ["not_verified", "admin", "superadmin"], 
        default: "not_verified" 
    }, 
    otp: String, 
    otpExpires: Date,
    refreshToken: String, 
}, { timestamps: true });

// Hash password before saving
adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;
