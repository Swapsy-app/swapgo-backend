const express = require('express');
const mongoose = require('mongoose');
const User = require('../Models/User'); // Adjust the path as needed
const router = express.Router();

// Middleware to fetch user by email
const fetchUserByEmail = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get user profile by email
router.get('/profile/:email', fetchUserByEmail, (req, res) => {
    const { name, username, gender, occupation, aboutMe } = req.user;
    res.json({ name, username, gender, occupation, aboutMe });
});

// Update user profile by email
router.put('/profile/:email', fetchUserByEmail, async (req, res) => {
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