const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const interviewController = require('../controllers/interviewController');
const auth = require('../middleware/auth');

// @route   POST api/mocks
// @desc    Create a new interview
// @access  Private (Candidate only)
router.post(
  '/',
  [
    auth,
    check('interviewerId', 'Interviewer ID is required').not().isEmpty(),
    check('scheduledDate', 'Scheduled date is required').isISO8601(),
    check('duration', 'Duration must be a number').optional().isNumeric()
  ],
  interviewController.createInterview
);

// @route   GET api/mocks
// @desc    Get all interviews for the current user
// @access  Private
router.get('/', auth, interviewController.getInterviews);

// @route   GET api/mocks/:id
// @desc    Get interview by ID
// @access  Private
router.get('/:id', auth, interviewController.getInterviewById);

// @route   PUT api/mocks/:id/status
// @desc    Update interview status
// @access  Private (Interviewer only)
router.put(
  '/:id/status',
  [
    auth,
    check('status', 'Status is required').isIn(['scheduled', 'completed', 'cancelled'])
  ],
  interviewController.updateInterviewStatus
);

// @route   GET api/mocks/slots
// @desc    Get available time slots for an interviewer
// @access  Private
router.get(
  '/slots',
  auth,
  interviewController.getAvailableTimeSlots
);

module.exports = router;
