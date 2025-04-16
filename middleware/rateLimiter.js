const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Rate limiter for registration endpoint
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 registration attempts per hour
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { 
    status: 429, 
    message: 'Too many registration attempts from this IP, please try again after an hour' 
  }
});

// Speed limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 429, 
    message: 'Too many login attempts from this IP, please try again after 15 minutes' 
  }
});

// Speed limiter to make brute force attacks harder by slowing down responses
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // allow 5 requests per 15 minutes, then...
  delayMs: 500 // begin adding 500ms of delay per request
});

// Rate limiter for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3, // limit each IP to 3 password reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 429, 
    message: 'Too many password reset attempts from this IP, please try again after an hour' 
  }
});

// Rate limiter for email verification resend
const resendVerificationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // limit each IP to 3 resend attempts per day
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 429, 
    message: 'Too many verification email requests, please try again tomorrow' 
  }
});

module.exports = {
  registerLimiter,
  loginLimiter,
  speedLimiter,
  passwordResetLimiter,
  resendVerificationLimiter
};
