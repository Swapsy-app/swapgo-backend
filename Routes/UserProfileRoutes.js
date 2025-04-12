const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../Models/User'); // Adjust the path as needed
const CoinWallet = require('../Models/CoinWalletModels/Coin'); // Adjust the path as needed
const CoinTransaction = require('../Models/CoinWalletModels/CoinTrans'); // Adjust the path as needed
const { isUserOnline } = require('../Modules/websocket'); // Adjust the path as needed
const authenticateToken = require('../Modules/authMiddleware'); // Middleware to authenticate token and check if the user is verified
const router = express.Router();


// function to calculate time difference
const getTimeDifference = (lastActive) => {
    const now = new Date();
    const diffMs = now - lastActive;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffMonths / 12);
 
    if (diffSecs < 60) {
        return `${diffSecs} seconds ago`;
    } else if (diffMins < 60) {
        return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
    } else if (diffDays < 30) {
        return `${diffDays} days ago`;
    } else if (diffMonths < 12) {
        return `${diffMonths} months ago`;
    } else {
        return `${diffYears} years ago`;
    }
};

// // Get user profile by ID
// router.get('/profile', authenticateToken, (req, res) => {
//     const { name, username, gender, occupation, aboutMe, createdAt, avatar, email, mobile, gst, lastActive } = req.user;
//     const createdAtIST = createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
//     const avatarUrl = `http://localhost:3000/public/avatars/${avatar}`;
//     const isOnline = isUserOnline(req.user.id);
//     const timeDifferenceActive = getTimeDifference(lastActive);
//     const timeDifferenceOnline = getTimeDifference(createdAt);
//     res.json({ name, username, gender, occupation, aboutMe, email, mobile, gst, createdAt: createdAtIST, avatar: avatarUrl, isOnline, lastActive: lastActive.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), timeDifferenceActive, timeDifferenceOnline  });
// });

// Get user profile by ID
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const { id, name, username, gender, occupation, aboutMe, createdAt, avatar, email, mobile, gst, lastActive } = req.user;
        const createdAtIST = createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const avatarUrl = `http://10.0.2.2:3000/public/avatars/${avatar}`;
        const isOnline = isUserOnline(id);
        const timeDifferenceActive = getTimeDifference(lastActive);
        const timeDifferenceOnline = getTimeDifference(createdAt);
        
        // Get follower count
        const followers = await Follow.countDocuments({ following: id });
        
        // Get following count
        const following = await Follow.countDocuments({ follower: id });
        
        res.json({ 
            name, 
            username, 
            gender, 
            occupation, 
            aboutMe, 
            email, 
            mobile, 
            gst, 
            createdAt: createdAtIST, 
            avatar: avatarUrl, 
            isOnline, 
            lastActive: lastActive.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), 
            timeDifferenceActive, 
            timeDifferenceOnline,
            followers,
            following
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all avatar image URLs
router.get('/avatars', (req, res) => {
    const allowedAvatars = ['user.png', 'bear.png', 'boy.png', 'bussiness-man_(1)', 'cat.png', 'gamer_(1).png', 'gamer.png', 'girl.png', 'man_(1).png', 'man_(2).png', 'man_(3).png', 'man_(4).png', 'man_(5).png', 'man_(6).png', 'man.png', 'meerkat.png', 'moslem-woman.png', 'panda.png', 'pensioner.png', 'profile_(1).png', 'profile.png', 'target.png', 'user_(1).png', 'woman.png', 'woman_(1).png', 'woman_(2).png', 'woman_(3).png', 'woman_(4).png', 'woman_(7).png', 'woman_(8).png'];

    // Generate the URLs for each avatar image
    // const avatarUrls = allowedAvatars.map(avatar => `http://localhost:3000/public/avatars/${avatar}`);
    const avatarUrls = allowedAvatars.map(avatar => `http://10.0.2.2:3000/public/avatars/${avatar}`);

    res.json({ avatars: avatarUrls });
});

// // Combined update profile and avatar route
// router.put('/profile', authenticateToken, async (req, res) => {
//     const { name, username, gender, occupation, aboutMe, avatar, email, mobile, gst } = req.body;

//     // Validate if the avatar is in the predefined list
//     const allowedAvatars = ['user.png', 'bear.png', 'boy.png', 'bussiness-man_(1)', 'cat.png', 'gamer_(1).png', 'gamer.png', 'girl.png', 'man_(1).png', 'man_(2).png', 'man_(3).png', 'man_(4).png', 'man_(5).png', 'man_(6).png', 'man.png', 'meerkat.png', 'moslem-woman.png', 'panda.png', 'pensioner.png', 'profile_(1).png', 'profile.png', 'target.png', 'user_(1).png', 'woman.png', 'woman_(1).png', 'woman_(2).png', 'woman_(3).png', 'woman_(4).png', 'woman_(7).png', 'woman_(8).png'];
//     if (avatar && !allowedAvatars.includes(avatar)) {
//         return res.status(400).json({ message: 'Invalid avatar selection' });
//     }

//     try {
//         if (name) req.user.name = name;
//         if (username) req.user.username = username;
//         if (gender) req.user.gender = gender;
//         if (occupation) req.user.occupation = occupation;
//         if (aboutMe) req.user.aboutMe = aboutMe;
//         if (avatar) req.user.avatar = avatar;
//         if (email) req.user.email = email;
//         if (mobile) req.user.mobile = mobile;
//         if (gst) req.user.gst = gst;

//   // Check if all required fields are present and if the reward has not been given yet
//   const requiredFields = [name, username, gender, occupation, aboutMe, email, mobile];
//   const allFieldsPresent = requiredFields.every(field => field);
//   const coinWallet = await CoinWallet.findOne({ userId: req.user._id });

//   if (allFieldsPresent && !req.user.profileCompleteRewardGiven) {
//       // Reward 150 coins if profile is complete and reward has not been given
//       coinWallet.rewardCoinBalance += 150;
//       await coinWallet.save();

//       const transaction = new CoinTransaction({
//           userId: req.user._id,
//           coinAmount: 150,
//           type: 'credit',
//           description: 'Profile Completion Reward'
//       });
//       await transaction.save();

//       req.user.profileCompleteRewardGiven = true; // Mark the reward as given
//   } else if (!allFieldsPresent && req.user.profileCompleteRewardGiven) {
//       // Deduct 150 coins if profile is incomplete and reward has been given
//       coinWallet.rewardCoinBalance -= 150;
//       await coinWallet.save();

//       const transaction = new CoinTransaction({
//           userId: req.user._id,
//           coinAmount: 150,
//           type: 'debit',
//           description: 'Profile Incompletion Penalty'
//       });
//       await transaction.save();

//       req.user.profileCompleteRewardGiven = false; // Mark the reward as not given
//   }

//   await req.user.save();
//   res.json({ message: 'Profile updated successfully', user: req.user });
// } catch (error) {
//   res.status(500).json({ message: 'Server error' });
// }
// });

// Combined update profile and avatar route
router.put('/profile', authenticateToken, async (req, res) => {
    const { name, username, gender, occupation, aboutMe, avatar, email, mobile, gst } = req.body;

    // Validate if the avatar is in the predefined list
    const allowedAvatars = ['user.png', 'bear.png', 'boy.png', 'bussiness-man_(1).png', 'cat.png', 'gamer_(1).png', 'gamer.png', 'girl.png', 'man_(1).png', 'man_(2).png', 'man_(3).png', 'man_(4).png', 'man_(5).png', 'man_(6).png', 'man.png', 'meerkat.png', 'moslem-woman.png', 'panda.png', 'pensioner.png', 'profile_(1).png', 'profile.png', 'target.png', 'user_(1).png', 'woman.png', 'woman_(1).png', 'woman_(2).png', 'woman_(3).png', 'woman_(4).png', 'woman_(7).png', 'woman_(8).png'];
    if (avatar && !allowedAvatars.includes(avatar)) {
        return res.status(400).json({ message: 'Invalid avatar selection' });
    }

    try {
        // Check for uniqueness before updating
        if (username && username !== req.user.username) {
            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                return res.status(400).json({ message: 'Username already taken' });
            }
        }
        
        if (email && email !== req.user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }
        
        if (mobile && mobile !== req.user.mobile) {
            const existingMobile = await User.findOne({ mobile });
            if (existingMobile) {
                return res.status(400).json({ message: 'Mobile number already in use' });
            }
        }
        
        if (gst && gst !== req.user.gst) {
            const existingGST = await User.findOne({ gst });
            if (existingGST) {
                return res.status(400).json({ message: 'GST number already in use' });
            }
        }

        // Update fields if provided
        if (name) req.user.name = name;
        if (username) req.user.username = username;
        if (gender) req.user.gender = gender;
        if (occupation) req.user.occupation = occupation;
        if (aboutMe) req.user.aboutMe = aboutMe;
        if (avatar) req.user.avatar = avatar;
        if (email) req.user.email = email;
        if (mobile) req.user.mobile = mobile;
        if (gst) req.user.gst = gst;

        await req.user.save();
        res.json({ message: 'Profile updated successfully', user: req.user });
    } catch (error) {
        console.error('Profile update error:', error);
        // More specific error handling
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error', details: error.message });
        }
        if (error.name === 'MongoError' || error.name === 'MongoServerError' && error.code === 11000) {
            return res.status(400).json({ message: 'Duplicate value not allowed' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /profile/gst
 * Fetches only the GST field for the authenticated user.
 */
router.get('/profile/gst', authenticateToken, async (req, res) => {
    try {
        const { gst } = req.user;
        res.json({ gst });
    } catch (error) {
        console.error('Error fetching GST:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * PUT /profile/gst
 * Updates the GST field for the authenticated user.
 * The request must include the 'gst' field (it can be an empty string).
 */
router.put('/profile/gst', authenticateToken, async (req, res) => {
    try {
        // Check if the gst field exists in the request body
        if (!req.body.hasOwnProperty('gst')) {
            return res.status(400).json({ message: 'GST field is required' });
        }
        
        const { gst } = req.body; // gst may be an empty string
        
        const userId = req.user.id;

        // Update the user's GST field
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { gst },
            { new: true, runValidators: true } // return the updated document
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'GST updated successfully', gst: updatedUser.gst });
    } catch (error) {
        console.error('Error updating GST:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;