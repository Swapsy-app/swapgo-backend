// Routes/follow.js
const express = require('express');
const router = express.Router();
const Follow = require('../Models/community');
const User = require('../Models/User');
const authenticateToken = require('../Modules/authMiddleware');

// Follow a user
router.post('/follow/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === id) {
        return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    try {
        const userToFollow = await User.findById(id);

        if (!userToFollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!userToFollow.isVerified) {
            return res.status(403).json({ message: 'Cannot follow an unverified user' });
        }

        const existingFollow = await Follow.findOne({ follower: currentUserId, following: id });

        if (existingFollow) {
            return res.status(400).json({ message: 'You are already following this user' });
        }

        const follow = new Follow({ follower: currentUserId, following: id });
        await follow.save();

        res.json({ message: 'Followed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Unfollow a user
router.post('/unfollow/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user._id;

    try {
        const userToUnfollow = await User.findById(id);

        if (!userToUnfollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!userToUnfollow.isVerified) {
            return res.status(403).json({ message: 'Cannot unfollow an unverified user' });
        }

        const follow = await Follow.findOneAndDelete({ follower: currentUserId, following: id });

        if (!follow) {
            return res.status(400).json({ message: 'You are not following this user' });
        }

        res.json({ message: 'Unfollowed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get followers of a specific user with pagination (public route)
router.get('/followers/:id', async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const followers = await Follow.find({ following: id })
            .populate('follower', 'name aboutMe username avatar isVerified')
            .skip((page - 1) * limit)
            .limit(limit);

        const totalFollowers = await Follow.countDocuments({ following: id });

        res.json({
            followers,
            currentPage: page,
            totalPages: Math.ceil(totalFollowers / limit),
            totalFollowers,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get following of a specific user with pagination (public route)
router.get('/following/:id', async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const following = await Follow.find({ follower: id })
            .populate('following', 'name aboutMe username avatar isVerified')
            .skip((page - 1) * limit)
            .limit(limit);

        const totalFollowing = await Follow.countDocuments({ follower: id });

        res.json({
            following,
            currentPage: page,
            totalPages: Math.ceil(totalFollowing / limit),
            totalFollowing,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
