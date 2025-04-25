/**
 * Middleware to check if the user is an interviewer
 */
module.exports = function(req, res, next) {
  // Check if user exists and has the role of interviewer
  if (req.user && (req.user.role === 'interviewer' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Only interviewers can perform this action.' });
  }
};
