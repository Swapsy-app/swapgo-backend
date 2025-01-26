const express = require('express');
const router = express.Router();
const User = require('../Models/User'); // Adjust the path as needed
const jwt = require('jsonwebtoken');

// Middleware to authenticate token and check if the user is verified
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

            // Check if the logged-in user is verified
            if (!foundUser.isVerified) {
                return res.status(403).json({ message: 'Account not verified' });
            }

            req.user = foundUser;
            next();
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });
};

// Follow a user
router.post('/follow/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; // ID of the user to follow
    const currentUser = req.user; // The logged-in user

    if (currentUser._id.toString() === id) {
        return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    try {
        const userToFollow = await User.findById(id);

        if (!userToFollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the target user is verified
        if (!userToFollow.isVerified) {
            return res.status(403).json({ message: 'Cannot follow an unverified user' });
        }

        if (!currentUser.following.includes(id)) {
            currentUser.following.push(id);
            userToFollow.followers.push(currentUser._id);

            await currentUser.save();
            await userToFollow.save();

            res.json({ message: 'Followed successfully' });
        } else {
            res.status(400).json({ message: 'You are already following this user' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Unfollow a user
router.post('/unfollow/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;

    try {
        const userToUnfollow = await User.findById(id);

        if (!userToUnfollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the target user is verified
        if (!userToUnfollow.isVerified) {
            return res.status(403).json({ message: 'Cannot unfollow an unverified user' });
        }

        if (currentUser.following.includes(id)) {
            currentUser.following = currentUser.following.filter(userId => userId.toString() !== id);
            userToUnfollow.followers = userToUnfollow.followers.filter(userId => userId.toString() !== currentUser._id.toString());

            await currentUser.save();
            await userToUnfollow.save();

            res.json({ message: 'Unfollowed successfully' });
        } else {
            res.status(400).json({ message: 'You are not following this user' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get followers of a specific user with pagination (public route)
router.get('/followers/:id', async (req, res) => {
    const { id } = req.params; // ID of the user whose followers you want to retrieve
    const page = parseInt(req.query.page) || 1; // Default page is 1
    const limit = parseInt(req.query.limit) || 20; // Default limit is 20

    try {
        const user = await User.findById(id).populate('followers', 'name aboutMe username avatar isVerified');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Include only verified followers in the response
        const verifiedFollowers = user.followers.filter(follower => follower.isVerified);

        // Calculate start and end index for pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedFollowers = verifiedFollowers.slice(startIndex, endIndex);

        res.json({
            followers: paginatedFollowers,
            currentPage: page,
            totalPages: Math.ceil(verifiedFollowers.length / limit),
            totalFollowers: verifiedFollowers.length,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get following of a specific user with pagination (public route)
router.get('/following/:id', async (req, res) => {
    const { id } = req.params; // ID of the user whose following list you want to retrieve
    const page = parseInt(req.query.page) || 1; // Default page is 1
    const limit = parseInt(req.query.limit) || 20; // Default limit is 20

    try {
        const user = await User.findById(id).populate('following', 'name aboutMe username avatar isVerified');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Include only verified following in the response
        const verifiedFollowing = user.following.filter(following => following.isVerified);

        // Calculate start and end index for pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedFollowing = verifiedFollowing.slice(startIndex, endIndex);

        res.json({
            following: paginatedFollowing,
            currentPage: page,
            totalPages: Math.ceil(verifiedFollowing.length / limit),
            totalFollowing: verifiedFollowing.length,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
