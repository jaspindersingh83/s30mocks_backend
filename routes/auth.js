const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { check, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const User = require("../models/User");
const { OAuth2Client } = require("google-auth-library");
const { 
  sendVerificationEmail, 
  sendVerificationSuccessEmail,
  sendPasswordResetEmail 
} = require("../utils/email");
const { verifyRecaptcha } = require("../utils/recaptcha");
const {
  registerLimiter,
  loginLimiter,
  speedLimiter,
  passwordResetLimiter,
  resendVerificationLimiter
} = require("../middleware/rateLimiter");

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  "/register",
  registerLimiter, // Apply rate limiting
  [
    check("name", "Name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    check("recaptchaToken", "reCAPTCHA verification is required").not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, recaptchaToken } = req.body;

    try {
      // reCAPTCHA verification temporarily bypassed
      // Only check if token is not the special bypass value
      if (recaptchaToken !== 'bypass') {
        const recaptchaResult = await verifyRecaptcha(recaptchaToken);
        if (!recaptchaResult.success) {
          return res.status(400).json({ 
            message: "reCAPTCHA verification failed", 
            errors: recaptchaResult['error-codes'] 
          });
        }
      }
      // If token is 'bypass', skip verification
      
      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationTokenExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ); // 24 hours

      // Create new user
      user = new User({
        name,
        email,
        password,
        role: role || "candidate",
        isEmailVerified: false,
        verificationToken,
        verificationTokenExpires,
      });

      // Save user
      await user.save();

      // Send verification email
      await sendVerificationEmail(user, verificationToken);

      res.json({
        message:
          "Registration successful. Please check your email to verify your account.",
        userId: user._id,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  "/login",
  loginLimiter, // Apply rate limiting
  speedLimiter, // Apply speed limiting
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        return res.status(403).json({
          message: "Please verify your email before logging in",
          isEmailVerified: false,
          userId: user._id,
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Create and return JWT token
      const payload = {
        user: {
          id: user.id,
          role: user.role,
        },
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
        (err, token) => {
          if (err) throw err;
          
          // Set cookie for cross-domain auth with Safari compatibility
          res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" || req.headers['user-agent'].includes('Safari'),
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 24 * 60 * 60 * 1000,
            path: "/"
          });
          
          // Return token and user info (same format as Google OAuth)
          res.json({
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              isEmailVerified: user.isEmailVerified,
              linkedInUrl: user.linkedInUrl,
              defaultMeetingLink: user.defaultMeetingLink,
              workExperiences: user.workExperiences || [],
              education: user.education || [],
            }
          });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET api/auth/verify-email/:token
// @desc    Verify user's email
// @access  Public
router.get("/verify-email/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification token",
      });
    }

    // Update user
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Send success email
    await sendVerificationSuccessEmail(user);

    res.json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST api/auth/resend-verification
// @desc    Resend verification email
// @access  Public
router.post(
  "/resend-verification",
  resendVerificationLimiter, // Apply rate limiting
  [check("email", "Please include a valid email").isEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const user = await User.findOne({ email: req.body.email });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Create new verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      user.verificationToken = verificationToken;
      user.verificationTokenExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );
      await user.save();

      // Send new verification email
      await sendVerificationEmail(user, verificationToken);

      res.json({
        message: "Verification email sent successfully",
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET api/auth
// @desc    Get logged in user
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET api/auth/me
// @desc    Get current user with token
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Return user data in the format expected by the client
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        picture: user.picture,
        linkedInUrl: user.linkedInUrl,
        defaultMeetingLink: user.defaultMeetingLink,
        workExperiences: user.workExperiences || [],
        education: user.education || [],
      }
    });
  } catch (err) {
    console.error("Error in /api/auth/me:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST api/auth/logout
// @desc    Logout user by clearing cookies
// @access  Private
router.post("/logout", auth, async (req, res) => {
  try {
    // Clear the token cookie
    res.cookie("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      expires: new Date(0) // Set expiration to the past
    });
    
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Error in /api/auth/logout:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post(
  "/forgot-password",
  passwordResetLimiter, // Apply rate limiting
  [
    check("email", "Please include a valid email").isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        // For security, don't reveal that the email doesn't exist
        return res.json({ message: "If your email is registered, you will receive a password reset link" });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      // Save token to user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpires;
      await user.save();

      // Send reset email
      await sendPasswordResetEmail(user.email, resetToken);

      res.json({ message: "If your email is registered, you will receive a password reset link" });
    } catch (err) {
      console.error("Error in forgot-password:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   POST api/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
router.post(
  "/reset-password/:token",
  [
    check("password", "Please enter a password with 6 or more characters").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { password } = req.body;
      const { token } = req.params;

      // Find user with valid reset token
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Update password
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
    } catch (err) {
      console.error("Error in reset-password:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   POST api/auth/google
// @desc    Authenticate with Google
// @access  Public
router.post("/google", async (req, res) => {
  try {
    // Get token from request (could be in different formats based on Google OAuth library)
    const { credential, token, tokenId } = req.body;
    const idToken = credential || token || tokenId;
    
    if (!idToken) {
      return res.status(400).json({ message: "No Google token provided" });
    }

    // Initialize Google OAuth client
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user if not exists
      user = new User({
        name,
        email,
        googleId,
        picture,
        role: "candidate",
        isEmailVerified: true // Google emails are already verified
      });
      
      await user.save();
    } else {
      // Update existing user with Google info if needed
      if (!user.googleId) {
        user.googleId = googleId;
        user.picture = picture || user.picture;
        user.isEmailVerified = true;
        await user.save();
      }
    }
    
    // Generate JWT
    const jwtPayload = {
      user: {
        id: user.id,
        role: user.role
      }
    };
    
    jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
      (err, token) => {
        if (err) throw err;
        
        // Set cookie for cross-domain auth with Safari compatibility
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" || req.headers['user-agent'].includes('Safari'),
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          maxAge: 24 * 60 * 60 * 1000,
          path: "/"
        });
        
        // Return token and user info
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            picture: user.picture,
            isEmailVerified: user.isEmailVerified,
            linkedInUrl: user.linkedInUrl,
            defaultMeetingLink: user.defaultMeetingLink,
            workExperiences: user.workExperiences || [],
            education: user.education || [],
          }
        });
      }
    );
  } catch (err) {
    console.error("Google auth error:", err.message);
    res.status(500).json({ message: "Server error during Google authentication" });
  }
});

module.exports = router;
