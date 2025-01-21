const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const User = require('../Models/User'); // Adjust the path as needed

const onlineUsers = new Map();

const setupWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        const token = req.url.split('token=')[1];
        if (!token) {
            console.log('No token provided, closing connection');
            ws.close();
            return;
        }

        jwt.verify(token, process.env.JWT_TOKEN, async (err, user) => {
            if (err) {
                console.log('Invalid token, closing connection');
                ws.close();
                return;
            }

            try {
                const foundUser = await User.findById(user.id);
                if (!foundUser) {
                    console.log('User not found, closing connection');
                    ws.close();
                    return;
                }

                // Update the user's isOnline status to true and set lastActive to current date and time
                foundUser.isOnline = true;
                foundUser.lastActive = new Date();
                await foundUser.save();
                console.log(`User ${foundUser.username} is now online`);

                onlineUsers.set(foundUser.id, ws);

                ws.on('close', async () => {
                    onlineUsers.delete(foundUser.id);

                    // Update the user's isOnline status to false and set lastActive to current date and time
                    foundUser.isOnline = false;
                    foundUser.lastActive = new Date();
                    await foundUser.save();
                    console.log(`User ${foundUser.username} is now offline`);
                });
            } catch (error) {
                console.error('Error updating user status:', error);
                ws.close();
            }
        });
    });
};

const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
};

module.exports = { setupWebSocket, isUserOnline };