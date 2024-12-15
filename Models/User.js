const mongoose=require("mongoose");
// User schema
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    mobile: {type:String,unique:true},
    password: String,
    otp: String,
    otpExpires: Date
});

const User = mongoose.model('User', userSchema);

// Export the User model
module.exports = User;