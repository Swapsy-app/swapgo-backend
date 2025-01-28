const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../Models/User'); // Adjust the path as needed
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

// Get user profile by ID
router.get('/profile', authenticateToken, (req, res) => {
    const { name, username, gender, occupation, aboutMe, createdAt, avatar, email, mobile, gst, lastActive } = req.user;
    const createdAtIST = createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const avatarUrl = `http://localhost:3000/public/avatars/${avatar}`;
    const isOnline = isUserOnline(req.user.id);
    const timeDifferenceActive = getTimeDifference(lastActive);
    const timeDifferenceOnline = getTimeDifference(createdAt);
    res.json({ name, username, gender, occupation, aboutMe, email, mobile, gst, createdAt: createdAtIST, avatar: avatarUrl, isOnline, lastActive: lastActive.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), timeDifferenceActive, timeDifferenceOnline  });
});
// Get all avatar image URLs
router.get('/avatars', (req, res) => {
    const allowedAvatars = ['user.png', 'bear.png', 'boy.png', 'bussiness-man_(1)', 'cat.png', 'gamer_(1).png', 'gamer.png', 'girl.png', 'man_(1).png', 'man_(2).png', 'man_(3).png', 'man_(4).png', 'man_(5).png', 'man_(6).png', 'man.png', 'meerkat.png', 'moslem-woman.png', 'panda.png', 'pensioner.png', 'profile_(1).png', 'profile.png', 'target.png', 'user_(1).png', 'woman.png', 'woman_(1).png', 'woman_(2).png', 'woman_(3).png', 'woman_(4).png', 'woman_(7).png', 'woman_(8).png'];

    // Generate the URLs for each avatar image
    const avatarUrls = allowedAvatars.map(avatar => `http://localhost:3000/public/avatars/${avatar}`);

    res.json({ avatars: avatarUrls });
});

// Combined update profile and avatar route
router.put('/profile', authenticateToken, async (req, res) => {
    const { name, username, gender, occupation, aboutMe, avatar, email, mobile, gst } = req.body;

    // Validate if the avatar is in the predefined list
    const allowedAvatars = ['user.png', 'bear.png', 'boy.png', 'bussiness-man_(1)', 'cat.png', 'gamer_(1).png', 'gamer.png', 'girl.png', 'man_(1).png', 'man_(2).png', 'man_(3).png', 'man_(4).png', 'man_(5).png', 'man_(6).png', 'man.png', 'meerkat.png', 'moslem-woman.png', 'panda.png', 'pensioner.png', 'profile_(1).png', 'profile.png', 'target.png', 'user_(1).png', 'woman.png', 'woman_(1).png', 'woman_(2).png', 'woman_(3).png', 'woman_(4).png', 'woman_(7).png', 'woman_(8).png'];
    if (avatar && !allowedAvatars.includes(avatar)) {
        return res.status(400).json({ message: 'Invalid avatar selection' });
    }

    try {
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
        res.status(500).json({ message: 'Server error' });
    }
});



module.exports = router;