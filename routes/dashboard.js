const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

// @route   GET api/dashboard
// @desc    Get dashboard statistics for the logged-in user
// @access  Private
router.get('/', auth, dashboardController.getDashboardStats);

module.exports = router;
