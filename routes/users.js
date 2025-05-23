const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');

// @route   GET api/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/', [auth, admin], async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Removed interviewers endpoint as it's no longer needed
// Candidates now only interact with available slots directly

// @route   GET api/users/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Error fetching user profile:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/users/candidates
// @desc    Get all candidates
// @access  Private (Interviewer or Admin only)
router.get('/candidates', auth, async (req, res) => {
  try {
    // Check if user is an interviewer or admin
    if (req.user.role !== 'interviewer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const candidates = await User.find({ role: 'candidate' })
      .select('-password')
      .sort({ name: 1 });
    res.json(candidates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   PUT api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  '/profile',
  [
    auth,
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail()
  ],
  async (req, res) => {
    try {
      const { name, email, phone, linkedInUrl, workExperiences, education, defaultMeetingLink, currentPassword, newPassword } = req.body;
      
      // Check if email already exists for another user
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      // Validate LinkedIn URL if provided
      if (linkedInUrl && !linkedInUrl.match(/^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/in\/[\w-]+\/?$/)) {
        return res.status(400).json({ message: 'Please provide a valid LinkedIn profile URL' });
      }
      
      // Get the current user with password for verification
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Handle password change if requested
      if (currentPassword && newPassword) {
        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
        
        // We'll update the password separately using findOneAndUpdate to avoid validation issues
        // This approach bypasses the validation for required fields while still hashing the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update just the password field
        await User.findByIdAndUpdate(req.user.id, { password: hashedPassword });
      }
      
      // Prepare update data
      const updateData = { name, email, phone, linkedInUrl };
      
      // Add work experiences if provided
      if (workExperiences) {
        updateData.workExperiences = workExperiences;
      }
      
      // Add education if provided
      if (education) {
        updateData.education = education;
      }
      
      // Add default meeting link if provided
      if (defaultMeetingLink) {
        updateData.defaultMeetingLink = defaultMeetingLink;
      }
      
      // Update user profile data (we're handling password separately above)
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updateData },
        { new: true }
      ).select('-password');
      
      res.json(updatedUser);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
