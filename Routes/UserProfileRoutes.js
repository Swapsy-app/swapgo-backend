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
    const { name, username, gender, occupation, aboutMe, createdAt } = req.user;
    const createdAtIST = createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    res.json({ name, username, gender, occupation, aboutMe, createdAt: createdAtIST });
});

// Update user profile by ID
router.put('/profile', authenticateToken, async (req, res) => {
    const { name, username, gender, occupation, aboutMe } = req.body;
    try {
        if (name) req.user.name = name;
        if (username) req.user.username = username;
        if (gender) req.user.gender = gender;
        if (occupation) req.user.occupation = occupation;
        if (aboutMe) req.user.aboutMe = aboutMe;

        await req.user.save();
        res.json({ message: 'Profile updated successfully', user: req.user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;