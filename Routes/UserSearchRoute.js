const express = require('express');
const mongoose = require('mongoose');
const User = require('../Models/User'); 
const { isUserOnline } = require('../Modules/websocket');
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

// Search users by username
router.get('/search', async (req, res) => {
    const { username } = req.query;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = parseInt(req.query.limit) || 20; // Default to 20 users per page if not specified

    if (!username) {
        return res.status(400).json({ message: 'Username query parameter is required' });
    }

    try {
        // Calculate the starting index for pagination
        const skip = (page - 1) * limit;

        // Find users whose username contains the search term (case-insensitive) and are verified
        const users = await User.find(
            { username: { $regex: username, $options: 'i' }, isVerified: true }, // Add isVerified: true
            'username avatar name' // Include 'name' in the projection
        )
            .skip(skip) // Skip the previous pages' results
            .limit(limit); // Limit the number of results per page

        if (users.length === 0) {
            return res.status(404).json({ message: 'No users found' });
        }

        // Map usernames, avatar URLs, and names for response
        const userResults = users.map(user => ({
            username: user.username,
            name: user.name,
            avatarUrl: `http://localhost:3000/public/avatars/${user.avatar}`
        }));

        // Get the total number of users matching the search query
        const totalUsers = await User.countDocuments({ username: { $regex: username, $options: 'i' }, isVerified: true }); // Add isVerified: true

        // Calculate total pages
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            users: userResults,
            currentPage: page,
            totalPages,
            totalUsers
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


// Get user details by username
router.get('/profile/:username', async (req, res) => {
    const { username } = req.params;

    try {
        // Find user by username and ensure isVerified is true
        const user = await User.findOne(
            { username, isVerified: true }, // Add isVerified: true
            '-email -mobile -gender -gst' // Exclude email and mobile fields
        ).populate('followers following', 'username');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Format the user data for response
        const userData = {
            userId: user._id, // Include user ID
            name: user.name,
            username: user.username,
            occupation: user.occupation,
            aboutMe: user.aboutMe,
            isOnline: user.isOnline,
            lastActive: getTimeDifference(user.lastActive), // Use getTimeDifference
            createdAt: getTimeDifference(user.createdAt),  // Use getTimeDifference
            avatarUrl: `http://localhost:3000/public/avatars/${user.avatar}`,
            followersCount: user.followers.length, // Count followers
            followingCount: user.following.length, // Count following
        };

        res.json(userData);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
