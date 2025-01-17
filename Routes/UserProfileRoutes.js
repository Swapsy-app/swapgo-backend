const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../Models/User'); // Adjust the path as needed
const router = express.Router();

// Middleware to verify JWT token and fetch user by ID
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access token required' });

    jwt.verify(token, process.env.JWT_TOKEN, async (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });

        try {
            const foundUser = await User.findById(user.id);
            if (!foundUser) {
                return res.status(404).json({ message: 'User not found' });
            }
            req.user = foundUser;
            next();
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });
};

// Get user profile by ID
router.get('/profile', authenticateToken, (req, res) => {
    const { name, username, gender, occupation, aboutMe, createdAt, avatar } = req.user;
    const createdAtIST = createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const avatarUrl = `http://localhost:3000/public/avatars/${avatar}`;
    res.json({ name, username, gender, occupation, aboutMe, createdAt: createdAtIST, avatar: avatarUrl });
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
    const { name, username, gender, occupation, aboutMe, avatar } = req.body;

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

        await req.user.save();
        res.json({ message: 'Profile updated successfully', user: req.user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;