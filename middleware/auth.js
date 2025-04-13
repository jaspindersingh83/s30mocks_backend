const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Get token from various sources
  const token = 
    req.cookies.token || 
    req.header('x-auth-token') || 
    req.header('Authorization')?.replace('Bearer ', '');

  // Check if no token
  if (!token) {
    console.log('Auth middleware: No token provided');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Auth middleware: Invalid token', err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};
