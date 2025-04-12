// Middleware to check if user is a candidate
module.exports = function(req, res, next) {
  if (req.user.role !== 'candidate' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Only candidates can perform this action.' });
  }
  next();
};
