const express = require('express');
const mongoose = require('mongoose');
const User = require('../Models/User'); 
const Follow = require('../Models/community');
const { isUserOnline } = require('../Modules/websocket');
const router = express.Router();

// Function to calculate time difference
const getTimeDifference = (lastActive) => {
    const now = new Date();
    const diffMs = now - lastActive;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffMonths / 12);

    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffMonths < 12) return `${diffMonths} months ago`;
    return `${diffYears} years ago`;
};

// Search users by username
router.get('/search', async (req, res) => {
    const { username } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!username) {
        return res.status(400).json({ message: 'Username query parameter is required' });
    }

    try {
        const skip = (page - 1) * limit;
        const users = await User.find(
            { username: { $regex: username, $options: 'i' }, isVerified: true },
            'username avatar name'
        )
            .skip(skip)
            .limit(limit);

        if (!users.length) {
            return res.status(404).json({ message: 'No users found' });
        }

        const userResults = users.map(user => ({
            username: user.username,
            name: user.name,
            avatarUrl: `http://localhost:3000/public/avatars/${user.avatar}`
        }));

        const totalUsers = await User.countDocuments({ username: { $regex: username, $options: 'i' }, isVerified: true });
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({ users: userResults, currentPage: page, totalPages, totalUsers });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user details by username
router.get('/profile/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const user = await User.findOne(
            { username, isVerified: true },
            '-email -mobile -gender -gst'
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch follower and following counts from the Follow schema
        const followersCount = await Follow.countDocuments({ following: user._id });
        const followingCount = await Follow.countDocuments({ follower: user._id });

        const userData = {
            userId: user._id,
            name: user.name,
            username: user.username,
            occupation: user.occupation,
            aboutMe: user.aboutMe,
            isOnline: user.isOnline,
            lastActive: getTimeDifference(user.lastActive),
            createdAt: getTimeDifference(user.createdAt),
            avatarUrl: `http://localhost:3000/public/avatars/${user.avatar}`,
            followersCount,
            followingCount
        };

        res.json(userData);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
