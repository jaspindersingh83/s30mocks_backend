const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const feedbackController = require('../controllers/feedbackController');
const auth = require('../middleware/auth');

// @route   POST api/feedback
// @desc    Create feedback for an interview
// @access  Private (Interviewer only)
router.post(
  '/',
  [
    auth,
    check('interviewId', 'Interview ID is required').not().isEmpty(),
    check('codingAndDebugging', 'Coding and debugging score is required').isInt({ min: 1, max: 10 }),
    check('communicationScore', 'Communication score is required').isInt({ min: 1, max: 10 }),
    check('problemSolvingScore', 'Problem solving score is required').isInt({ min: 1, max: 10 }),
    check('strengths', 'Strengths are required').not().isEmpty(),
    check('areasOfImprovement', 'Areas of improvement are required').not().isEmpty()
  ],
  feedbackController.createFeedback
);

// @route   GET api/feedback/interview/:interviewId
// @desc    Get feedback for a specific interview
// @access  Private
router.get(
  '/interview/:interviewId',
  auth,
  feedbackController.getFeedbackByInterviewId
);

// @route   GET api/feedback/candidate/:candidateId
// @desc    Get all feedback for a candidate
// @access  Private (Candidate or Admin only)
router.get(
  '/candidate/:candidateId',
  auth,
  feedbackController.getCandidateFeedback
);

// @route   PUT api/feedback/:feedbackId
// @desc    Update existing feedback
// @access  Private (Interviewer only)
router.put(
  '/:feedbackId',
  [
    auth,
    check('codingAndDebugging', 'Coding and debugging score is required').isInt({ min: 1, max: 10 }),
    check('communicationScore', 'Communication score is required').isInt({ min: 1, max: 10 }),
    check('problemSolvingScore', 'Problem solving score is required').isInt({ min: 1, max: 10 }),
    check('strengths', 'Strengths are required').not().isEmpty(),
    check('areasOfImprovement', 'Areas of improvement are required').not().isEmpty()
  ],
  feedbackController.updateFeedback
);

// @route   PUT api/feedback/:id
// @desc    Update feedback
// @access  Private (Original interviewer only)
router.put(
  '/:id',
  [
    auth,
    check('technicalScore', 'Technical score must be between 1-5').optional().isInt({ min: 1, max: 5 }),
    check('communicationScore', 'Communication score must be between 1-5').optional().isInt({ min: 1, max: 5 }),
    check('problemSolvingScore', 'Problem solving score must be between 1-5').optional().isInt({ min: 1, max: 5 })
  ],
  feedbackController.updateFeedback
);

module.exports = router;
