const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const User = require("../models/User");
const crypto = require("crypto");
const {
  sendVerificationEmail,
  sendVerificationSuccessEmail,
} = require("../utils/email");

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  "/register",
  [
    check("name", "Name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    try {
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
          res.json({ token });
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

module.exports = router;
