// authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../Models/User'); // Adjust the path as per your directory structure

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
module.exports = authenticateToken;
