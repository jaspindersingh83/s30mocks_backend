const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// @route   POST api/payments/create-payment-request
// @desc    Create a payment request for UPI payment
// @access  Private (Candidate only)
router.post(
  '/create-payment-request',
  [
    auth,
    check('interviewId', 'Interview ID is required').not().isEmpty()
  ],
  paymentController.createPaymentRequest
);

// @route   POST api/payments/create-prebooking-payment
// @desc    Create a payment request before booking a slot
// @access  Private (Candidate only)
router.post(
  '/create-prebooking-payment',
  [
    auth,
    check('slotId', 'Slot ID is required').not().isEmpty()
  ],
  paymentController.createPreBookingPayment
);

// @route   POST api/payments/upload-qr-code
// @desc    Upload UPI QR code (for interviewers)
// @access  Private (Interviewer only)
router.post(
  '/upload-qr-code',
  auth,
  paymentController.uploadQrCode,
  [
    check('upiId', 'UPI ID is required').not().isEmpty()
  ],
  paymentController.uploadUpiQrCode
);

// @route   POST api/payments/submit-payment-proof
// @desc    Submit payment proof (for candidates)
// @access  Private (Candidate only)
router.post(
  '/submit-payment-proof',
  auth,
  paymentController.uploadTransactionScreenshot,
  [
    check('paymentId', 'Payment ID is required').not().isEmpty(),
    check('transactionId', 'Transaction ID is required').not().isEmpty()
  ],
  paymentController.submitPaymentProof
);

// @route   POST api/payments/submit-prebooking-payment
// @desc    Submit payment proof for pre-booking and create interview
// @access  Private (Candidate only)
router.post(
  '/submit-prebooking-payment',
  auth,
  paymentController.uploadTransactionScreenshot,
  [
    check('paymentId', 'Payment ID is required').not().isEmpty(),
    check('transactionId', 'Transaction ID is required').not().isEmpty(),
    check('slotId', 'Slot ID is required').not().isEmpty()
  ],
  paymentController.submitPreBookingPayment
);

// @route   GET api/payments/upi-setup
// @desc    Get UPI setup details for payment
// @access  Private (All authenticated users)
router.get(
  '/upi-setup',
  auth,
  paymentController.getUpiSetup
);

// @route   POST api/payments/verify
// @desc    Verify payment (for interviewers and admins)
// @access  Private (Interviewer and Admin only)
router.post(
  '/verify',
  [
    auth,
    check('paymentId', 'Payment ID is required').not().isEmpty(),
    check('verified', 'Verification status is required').isBoolean()
  ],
  paymentController.verifyPayment
);

// @route   GET api/payments/pending
// @desc    Get all pending payments for verification
// @access  Private (Interviewer and Admin only)
router.get(
  '/pending',
  auth,
  paymentController.getPendingPayments
);

// @route   GET api/payments/stats
// @desc    Get payment statistics for dashboard
// @access  Private (Admin only)
router.get(
  '/stats',
  auth,
  paymentController.getPaymentStats
);

// @route   GET api/payments/interview/:interviewId
// @desc    Get payment details by interview ID
// @access  Private
router.get(
  '/interview/:interviewId',
  auth,
  paymentController.getPaymentByInterviewId
);

// @route   DELETE api/payments/:paymentId
// @desc    Delete a payment by ID
// @access  Private (Admin only)
router.delete(
  '/:paymentId',
  auth,
  paymentController.deletePayment
);

module.exports = router;
