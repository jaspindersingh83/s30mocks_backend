const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const priceController = require('../controllers/priceController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route   GET api/prices
// @desc    Get all interview prices
// @access  Public
router.get('/', priceController.getAllPrices);

// @route   GET api/prices/:interviewType
// @desc    Get price by interview type
// @access  Public
router.get('/:interviewType', priceController.getPriceByType);

// @route   PUT api/prices
// @desc    Update or create price for an interview type (admin only)
// @access  Private (Admin only)
router.put(
  '/',
  [
    auth,
    admin,
    [
      check('interviewType', 'Interview type is required').not().isEmpty(),
      check('price', 'Price is required and must be a positive number').isFloat({ min: 0 })
    ]
  ],
  priceController.updatePrice
);

module.exports = router;
