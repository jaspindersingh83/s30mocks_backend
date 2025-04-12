const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const interviewController = require('../controllers/interviewController');

// @route   GET api/interviews
// @desc    Get all interviews for the logged-in user
// @access  Private
router.get('/', auth, interviewController.getInterviews);

// @route   GET api/interviews/:id
// @desc    Get interview by ID
// @access  Private
router.get('/:id', auth, interviewController.getInterviewById);

// @route   POST api/interviews
// @desc    Create a new interview
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('interviewerId', 'Interviewer ID is required').not().isEmpty(),
      check('scheduledDate', 'Scheduled date is required').not().isEmpty(),
    ]
  ],
  interviewController.createInterview
);

// @route   PUT api/interviews/:id/status
// @desc    Update interview status
// @access  Private
router.put('/:id/status', auth, interviewController.updateInterviewStatus);

// @route   PUT api/interviews/:id/cancel
// @desc    Cancel an interview (for candidates)
// @access  Private
router.put('/:id/cancel', auth, interviewController.cancelInterview);

// @route   PUT api/interviews/:id/meeting
// @desc    Update meeting details (link and password)
// @access  Private (interviewer only)
router.put('/:id/meeting', auth, interviewController.updateMeetingDetails);

module.exports = router;
