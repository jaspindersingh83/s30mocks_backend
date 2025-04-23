const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const slotController = require('../controllers/slotController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const isInterviewer = require('../middleware/isInterviewer');

// @route   POST api/slots/upload
// @desc    Create slots from Google Sheet data
// @access  Private (Admin only)


// @route   GET api/slots/available
// @desc    Get all available slots
// @access  Private
router.get('/available', auth, slotController.getAvailableSlots);

// @route   GET api/slots/interviewer
// @desc    Get interviewer's slots
// @access  Private (Interviewer only)
router.get('/interviewer', [auth, isInterviewer], slotController.getInterviewerSlots);

// @route   GET api/slots/:slotId
// @desc    Get slot details by ID
// @access  Private
router.get('/:slotId', auth, slotController.getSlotById);

// @route   POST api/slots/book/:slotId
// @desc    Book a slot
// @access  Private (Candidate only)
router.post('/book/:slotId', auth, slotController.bookSlot);

// @route   GET api/slots
// @desc    Get all slots (admin only)
// @access  Private (Admin only)
router.get('/', [auth, admin], slotController.getAllSlots);

// @route   DELETE api/slots/:slotId
// @desc    Delete a slot (admin only)
// @access  Private (Admin only)
router.delete('/:slotId', [auth, admin], slotController.deleteSlot);

// @route   POST api/slots/interviewer
// @desc    Create a slot (interviewer only)
// @access  Private (Interviewer only)
router.post(
  '/interviewer',
  [
    auth,
    isInterviewer,
    [
      check('startTime', 'Start time is required').not().isEmpty(),
      check('endTime', 'End time is required').not().isEmpty()
    ]
  ],
  slotController.createInterviewerSlot
);

// @route   POST api/slots/batch
// @desc    Create multiple slots at once (for recurring slots)
// @access  Private (Interviewer only)
router.post(
  '/batch',
  [
    auth,
    isInterviewer,
    [
      check('interviewType', 'Interview type is required').not().isEmpty(),
      check('slots', 'Slots array is required').isArray()
    ]
  ],
  slotController.createBatchSlots
);

// This route has been moved above the /:slotId route

// @route   DELETE api/slots/interviewer/:slotId
// @desc    Delete interviewer's slot
// @access  Private (Interviewer only)
router.delete('/interviewer/:slotId', [auth, isInterviewer], slotController.deleteInterviewerSlot);

module.exports = router;
