const jwt = require('jsonwebtoken');
require('dotenv').config();
const key = process.env.JWT_SECRET_KEY;

module.exports = function(req, res, next) {
  // Get token from header
  const token = req.header('Authorization');

  // Check if token is not present
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, key);
    console.log('Decoded token:', decoded);
    
    // Set user from payload
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Error verifying token:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
