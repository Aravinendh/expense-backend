const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {

            token = req.headers.authorization.split(' ')[1];
            console.log('Token received:', token);


            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Decoded token:', decoded);

            const user = await User.findById(decoded.id).select('-password');
            console.log('Found user:', user);

            if (!user) {
                console.error('No user found with decoded ID');
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            res.status(401).json({ message: 'Not authorized', error: error.message });
        }
    } else {
        console.error('No token provided in authorization header');
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

module.exports = { protect };
