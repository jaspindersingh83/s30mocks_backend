const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Check for Safari browser
  const isSafari = req.headers['user-agent'] && req.headers['user-agent'].includes('Safari') && !req.headers['user-agent'].includes('Chrome');
  
  // Get token from various sources with improved extraction
  let token = req.cookies.token;
  
  // If no cookie token, try header tokens
  if (!token) {
    // Try x-auth-token header
    token = req.header('x-auth-token');
  }
  
  // Try Authorization header if still no token
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (authHeader) {
      // Some clients might not prefix with 'Bearer '
      token = authHeader;
    }
  }

  // Check if no token
  if (!token) {
    console.log(`Auth middleware: No token provided. UA: ${req.headers['user-agent']?.substring(0, 50)}...`);
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    
    // For debugging Safari issues
    if (isSafari) {
      console.log(`Safari auth successful for user ID: ${req.user.id}`);
    }
    
    next();
  } catch (err) {
    console.error(`Auth middleware: Invalid token. UA: ${req.headers['user-agent']?.substring(0, 50)}...`, err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};
