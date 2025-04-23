const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {  
  // Extract token from Authorization header (Bearer scheme)
  let token;
  const authHeader = req.header('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (authHeader) {
    // Some clients might not prefix with 'Bearer '
    token = authHeader;
  }
  
  // Fallback to x-auth-token header (for backward compatibility)
  if (!token) {
    token = req.header('x-auth-token');
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
