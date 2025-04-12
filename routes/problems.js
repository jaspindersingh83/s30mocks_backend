const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const problemController = require('../controllers/problemController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route   POST api/problems
// @desc    Create a new problem
// @access  Private (Admin only)
router.post(
  '/',
  [
    auth,
    admin,
    check('title', 'Title is required').not().isEmpty(),
    check('leetcodeUrl', 'LeetCode URL is required').not().isEmpty(),
    check('solutionVideoUrl', 'Solution Video URL is required').not().isEmpty(),
    check('difficulty', 'Difficulty must be easy, medium, or hard').isIn(['easy', 'medium', 'hard']),
    check('solutions', 'At least one solution is required').isArray({ min: 1 })
  ],
  problemController.createProblem
);

// @route   GET api/problems
// @desc    Get all problems
// @access  Private (Admin only)
router.get('/', [auth, admin], problemController.getAllProblems);

// @route   GET api/problems/random
// @desc    Get a random problem
// @access  Private (Interviewer only)
router.get('/random', auth, problemController.getRandomProblem);

// @route   GET api/problems/:id
// @desc    Get problem by ID
// @access  Private
router.get('/:id', auth, problemController.getProblemById);

// @route   PUT api/problems/:id
// @desc    Update a problem
// @access  Private (Admin only)
router.put(
  '/:id',
  [
    auth,
    admin,
    check('title', 'Title is required').not().isEmpty(),
    check('leetcodeUrl', 'LeetCode URL is required').not().isEmpty(),
    check('solutionVideoUrl', 'Solution Video URL is required').not().isEmpty(),
    check('difficulty', 'Difficulty must be easy, medium, or hard').isIn(['easy', 'medium', 'hard']),
    check('solutions', 'At least one solution is required').isArray({ min: 1 })
  ],
  problemController.updateProblem
);

// @route   DELETE api/problems/:id
// @desc    Delete a problem
// @access  Private (Admin only)
router.delete('/:id', [auth, admin], problemController.deleteProblem);

// @route   POST api/problems/assign/:interviewId
// @desc    Assign a random problem to an interview
// @access  Private (Interviewer only)
router.post('/assign/:interviewId', auth, problemController.assignRandomProblem);

// @route   PUT api/problems/recording/:interviewId
// @desc    Update interview with recording URL
// @access  Private (Interviewer only)
router.put(
  '/recording/:interviewId',
  [
    auth,
    check('recordingUrl', 'Recording URL is required').not().isEmpty()
  ],
  problemController.updateRecordingUrl
);

// @route   GET api/problems/interview/:interviewId
// @desc    Get problem and solution for a completed interview
// @access  Private
router.get('/interview/:interviewId', auth, problemController.getInterviewProblemAndSolution);

module.exports = router;
