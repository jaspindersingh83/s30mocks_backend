const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// All routes here require authentication and admin role
router.use(auth);
router.use(isAdmin);

// @route   GET /api/admin/users
// @desc    Get all users with pagination, search, and filtering
// @access  Admin only
router.get('/users', adminController.getUsers);

// @route   GET /api/admin/users/:id
// @desc    Get user details
// @access  Admin only
router.get('/users/:id', adminController.getUserDetails);

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Admin only
router.put('/users/:id/role', adminController.updateUserRole);

// @route   GET /api/admin/interviews
// @desc    Get all interviews with filtering options
// @access  Admin only
router.get('/interviews', adminController.getAllInterviews);

module.exports = router;
