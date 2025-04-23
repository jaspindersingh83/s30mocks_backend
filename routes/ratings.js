const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const isCandidate = require('../middleware/isCandidate');
const ratingController = require('../controllers/ratingController');

// @route   POST api/ratings
// @desc    Create a new rating
// @access  Private (candidates only)
router.post(
  '/',
  [
    auth,
    isCandidate,
    [
      check('interviewId', 'Interview ID is required').not().isEmpty(),
      check('rating', 'Rating is required and must be between 1 and 5').isInt({ min: 1, max: 5 }),
      check('feedback', 'Feedback cannot exceed 500 characters').optional().isLength({ max: 500 })
    ]
  ],
  ratingController.createRating
);

// @route   GET api/ratings/interviewer/:interviewerId
// @desc    Get ratings for an interviewer
// @access  Public
router.get('/interviewer/:interviewerId', ratingController.getInterviewerRatings);

// @route   GET api/ratings/interviewer/:interviewerId/average
// @desc    Get average rating for an interviewer
// @access  Public
router.get('/interviewer/:interviewerId/average', ratingController.getInterviewerAverageRating);

// @route   GET api/ratings/all
// @desc    Get all ratings (admin only)
// @access  Private/Admin
router.get('/all', auth, ratingController.getAllRatings);

module.exports = router;
