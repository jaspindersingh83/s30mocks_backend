const Payment = require('../models/Payment');
const Interview = require('../models/Interview');
const User = require('../models/User');
const InterviewPrice = require('../models/InterviewPrice');
const InterviewSlot = require('../models/InterviewSlot');
const path = require('path');
const multer = require('multer');
const { uploadToS3 } = require('../utils/s3');
const { 
  sendPaymentVerificationNotification,
  sendPaymentVerificationConfirmation 
} = require('../utils/email');

// Configure multer to store files in memory for S3 upload
const memoryStorage = multer.memoryStorage();

// Configure multer for QR code uploads using memory storage for S3
exports.uploadQrCode = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .png, .jpg and .jpeg formats are allowed!'), false);
    }
  }
}).single('qrCode');

// Configure multer for transaction screenshot uploads using memory storage for S3
exports.uploadTransactionScreenshot = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .png, .jpg and .jpeg formats are allowed!'), false);
    }
  }
}).single('transactionScreenshot');

// Get UPI setup details for payment
exports.getUpiSetup = async (req, res) => {
  try {
    // Find an admin user with UPI setup
    const adminWithUpi = await User.findOne({
      role: 'admin',
      upiId: { $exists: true, $ne: '' },
      qrCodeUrl: { $exists: true, $ne: '' }
    }).select('upiId qrCodeUrl');
    
    // If no admin has UPI setup, try to find an interviewer with UPI setup
    if (!adminWithUpi) {
      const interviewerWithUpi = await User.findOne({
        role: 'interviewer',
        upiId: { $exists: true, $ne: '' },
        qrCodeUrl: { $exists: true, $ne: '' }
      }).select('upiId qrCodeUrl');
      
      if (!interviewerWithUpi) {
        return res.status(404).json({ message: 'No UPI payment setup found' });
      }
      
      return res.json({
        upiId: interviewerWithUpi.upiId,
        qrCodeUrl: interviewerWithUpi.qrCodeUrl
      });
    }
    
    return res.json({
      upiId: adminWithUpi.upiId,
      qrCodeUrl: adminWithUpi.qrCodeUrl
    });
  } catch (error) {
    console.error('Error fetching UPI setup:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Create a payment request for UPI payment (for existing interviews)
exports.createPaymentRequest = async (req, res) => {
  try {
    console.log('Creating payment request for interview:', req.body);
    const { interviewId } = req.body;
    
    // Verify interview exists
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Verify the current user is the candidate
    if (interview.candidate.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if payment is already made
    if (interview.paymentId) {
      const payment = await Payment.findById(interview.paymentId);
      if (payment && payment.status === 'verified') {
        return res.status(400).json({ message: 'Payment already completed' });
      }
    }
    
    // Get interviewer to fetch their UPI details
    const interviewer = await User.findById(interview.interviewer);
    if (!interviewer || !interviewer.upiId || !interviewer.qrCodeUrl) {
      return res.status(400).json({ message: 'Interviewer has not set up UPI payment details yet' });
    }
    
    // Get the interview price
    const priceRecord = await InterviewPrice.findOne({ interviewType: interview.interviewType });
    if (!priceRecord) {
      return res.status(404).json({ message: `Price for ${interview.interviewType} interviews not found` });
    }
    
    // Use base price directly (no GST)
    const basePrice = priceRecord.price;
    
    // Use the base price directly
    const amount = basePrice;
    
    // Create payment record
    const payment = new Payment({
      interview: interviewId,
      paidBy: req.user.id, // Add the paidBy field with the current user's ID
      amount,
      upiId: interviewer.upiId,
      qrCodeUrl: interviewer.qrCodeUrl,
      status: 'pending' // Initial status until proof is submitted
    });
    
    await payment.save();
    
    // Update interview with payment ID
    interview.paymentId = payment._id;
    await interview.save();
    
    res.json({
      paymentId: payment._id,
      upiId: interviewer.upiId,
      qrCodeUrl: interviewer.qrCodeUrl,
      amount: amount, // Use amount directly
      currency: priceRecord.currency || 'INR'
    });
  } catch (err) {
    console.error('Payment request error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Create a pre-booking payment request (before slot is booked)
exports.createPreBookingPayment = async (req, res) => {
  try {
    const { slotId, interviewType } = req.body;
    
    // Verify slot exists and is not booked
    const slot = await InterviewSlot.findById(slotId).populate('interviewer');
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    if (slot.isBooked) {
      return res.status(400).json({ message: 'This slot is already booked' });
    }
    
    // Get the interviewer's UPI details
    const interviewer = slot.interviewer;
    if (!interviewer || !interviewer.upiId || !interviewer.qrCodeUrl) {
      return res.status(400).json({ message: 'Interviewer has not set up UPI payment details yet' });
    }
    
    // Get the price for this interview type
    const priceRecord = await InterviewPrice.findOne({ interviewType: slot.interviewType });
    if (!priceRecord) {
      return res.status(404).json({ message: `Price for ${slot.interviewType} interviews not found` });
    }
    
    // Use base price directly
    const amount = priceRecord.price;
    
    // Create a temporary payment record (not linked to an interview yet)
    const payment = new Payment({
      paidBy: req.user.id,
      amount,
      upiId: interviewer.upiId,
      qrCodeUrl: interviewer.qrCodeUrl,
      status: 'pending',
      isPreBooking: true, // Mark as pre-booking payment
      slotId: slotId // Store the slot ID for reference
    });
    
    await payment.save();
    
    res.json({
      paymentId: payment._id,
      upiId: interviewer.upiId,
      qrCodeUrl: interviewer.qrCodeUrl,
      amount: amount,
      currency: priceRecord.currency || 'INR'
    });
  } catch (err) {
    console.error('Pre-booking payment request error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Submit pre-booking payment proof and create interview
exports.submitPreBookingPayment = async (req, res) => {
  try {
    const { paymentId, transactionId, slotId } = req.body;
    
    // Find the payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Verify the current user is the payer
    if (payment.paidBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Find the slot
    const slot = await InterviewSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    if (slot.isBooked) {
      return res.status(400).json({ message: 'This slot has already been booked' });
    }
    
    // Upload screenshot to S3
    let screenshotUrl = null;
    if (req.file) {
      screenshotUrl = await uploadToS3(req.file, 'payment-screenshots');
    } else {
      return res.status(400).json({ message: 'Payment screenshot is required' });
    }
    
    // Update payment with transaction details
    // Store only the last 4 digits of the transaction ID for UPI payments
    const last4Digits = transactionId.length > 4 ? transactionId.slice(-4) : transactionId;
    payment.transactionId = last4Digits;
    payment.transactionScreenshotUrl = screenshotUrl;
    payment.status = 'submitted';
    payment.submittedAt = new Date();
    await payment.save();
    
    // Set duration based on interview type
    const duration = slot.interviewType === "DSA" ? 40 : 50;
    
    // Find interviewer
    const interviewer = await User.findById(slot.interviewer);
    
    // Create interview
    const interview = new Interview({
      candidate: req.user.id,
      interviewer: slot.interviewer,
      interviewType: slot.interviewType,
      scheduledDate: slot.startTime,
      duration: duration,
      price: payment.amount,
      currency: 'INR',
      status: 'scheduled',
      slot: slot._id,
      timeZone: slot.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      meetingLink: interviewer?.defaultMeetingLink || "ping support team in whatsapp for link",
      paymentId: payment._id // Reference to the payment
    });
    
    await interview.save();
    
    // Update payment with interview ID
    payment.interview = interview._id;
    payment.isPreBooking = false; // No longer a pre-booking payment
    await payment.save();
    
    // Update slot
    slot.isBooked = true;
    slot.interview = interview._id;
    await slot.save();
    
    // Schedule email reminders for 30 minutes before the interview
    const scheduleInterviewReminder = require('../utils/scheduler').scheduleInterviewReminder;
    await scheduleInterviewReminder(interview._id);
    
    // Send email notifications
    const { 
      sendInterviewBookingConfirmation, 
      sendCombinedBookingAndPaymentNotification 
    } = require('../utils/email');
    
    const candidate = await User.findById(req.user.id);
    const adminEmail = process.env.ADMIN_EMAIL || "jaspinder@thes30.com";
    
    try {
      // Send combined notification to interviewer (booking + payment verification)
      await sendCombinedBookingAndPaymentNotification(
        interview, 
        payment, 
        candidate, 
        interviewer, 
        adminEmail
      );
      
      // Send confirmation to candidate
      await sendInterviewBookingConfirmation(interview, candidate, interviewer, adminEmail);
    } catch (emailErr) {
      console.error('Error sending email notifications:', emailErr);
      // Continue even if email sending fails
    }
    
    res.json({
      message: 'Payment proof submitted and slot booked successfully',
      interviewId: interview._id
    });
  } catch (err) {
    console.error('Pre-booking payment submission error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Upload UPI QR code (for interviewers)
exports.uploadUpiQrCode = async (req, res) => {
  try {
    // Check if user is an interviewer
    if (req.user.role !== 'interviewer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only interviewers can upload QR codes' });
    }
    
    const { upiId } = req.body;
    if (!upiId) {
      return res.status(400).json({ message: 'UPI ID is required' });
    }
    
    // Upload QR code to S3 and update user with QR code URL and UPI ID
    let qrCodeUrl = null;
    if (req.file) {
      qrCodeUrl = await uploadToS3(req.file, 'qr-codes');
    }
    
    const user = await User.findById(req.user.id);
    user.upiId = upiId;
    
    // Only update QR code URL if a new file was uploaded
    if (qrCodeUrl) {
      user.qrCodeUrl = qrCodeUrl;
    }
    
    await user.save();
    
    res.json({
      message: 'UPI QR code uploaded successfully',
      upiId: user.upiId,
      qrCodeUrl: user.qrCodeUrl
    });
  } catch (err) {
    console.error('QR code upload error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Submit payment proof (for candidates)
exports.submitPaymentProof = async (req, res) => {
  try {
    const { paymentId, transactionId } = req.body;
    const isPreBooking = false; // This is for existing interviews
    
    // Verify payment exists
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Verify the interview belongs to the current user
    const interview = await Interview.findById(payment.interview);
    if (!interview || interview.candidate.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Upload transaction screenshot to S3 and update payment details
    const screenshotUrl = await uploadToS3(req.file, 'transaction-screenshots');
    
    // Update payment with transaction details
    // Store only the last 4 digits of the transaction ID for UPI payments
    const last4Digits = transactionId.length > 4 ? transactionId.slice(-4) : transactionId;
    payment.transactionId = last4Digits;
    payment.transactionScreenshotUrl = screenshotUrl;
    payment.status = 'pending'; // Change status to pending after proof is submitted
    await payment.save();
    
    // Get candidate, interviewer, and admin details for email notification
    const candidate = await User.findById(req.user.id);
    const interviewer = await User.findById(interview.interviewer);
    const admin = await User.findOne({ role: 'admin' });
    const adminEmail = admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com';
    
    // Send email notification to interviewer about payment verification
    try {
      await sendPaymentVerificationNotification(interview, payment, candidate, interviewer, adminEmail);
    } catch (emailError) {
      console.error('Error sending payment verification notification email:', emailError);
      // Continue with the response even if email fails
    }
    
    res.json({
      message: 'Payment proof submitted successfully',
      paymentId: payment._id,
      status: payment.status
    });
  } catch (err) {
    console.error('Payment proof submission error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get payment details by interview ID
exports.getPaymentByInterviewId = async (req, res) => {
  try {
    const interviewId = req.params.interviewId;
    
    // Verify interview exists
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Check if user is authorized to view this payment
    if (
      interview.candidate.toString() !== req.user.id && 
      interview.interviewer.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const payment = await Payment.findOne({ interview: interviewId });
    
    // If no payment exists, return an empty payment object with status 'pending'
    // instead of a 404 error to make client-side handling easier
    if (!payment) {
      console.log(`No payment found for interview ${interviewId}, returning pending status`);
      return res.json({ 
        status: 'pending',
        interview: interviewId,
        exists: false
      });
    }
    
    res.json(payment);
  } catch (err) {
    console.error(`Error fetching payment for interview ${req.params.interviewId}:`, err.message);
    // Return a 500 error but with a JSON response for consistent client handling
    res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Verify payment (for interviewers and admins)
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, verified } = req.body;
    
    // Verify payment exists
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Get the interview
    const interview = await Interview.findById(payment.interview);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Check if user is authorized to verify this payment
    if (
      interview.interviewer.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized to verify payments' });
    }
    
    // Update payment status based on verification
    if (verified) {
      payment.status = 'verified';
      payment.verifiedBy = req.user.id;
      payment.verifiedAt = Date.now();
      
      // No need to update interview payment status as we're now using the payment reference
    } else {
      payment.status = 'rejected';
      payment.verifiedBy = req.user.id;
      payment.verifiedAt = Date.now();
    }
    
    await payment.save();
    
    // If payment was verified, send confirmation email to candidate
    if (verified) {
      try {
        // Get candidate, interviewer, and admin details for email notification
        const candidate = await User.findById(interview.candidate);
        const interviewer = await User.findById(interview.interviewer);
        const admin = await User.findOne({ role: 'admin' });
        const adminEmail = admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com';
        
        // Import the helper function that ensures admin is CC'd
        const { sendPaymentVerificationConfirmationWithAdminCC } = require('../utils/emailHelper');
        
        // Send payment verification confirmation to candidate with admin CC'd
        await sendPaymentVerificationConfirmationWithAdminCC(interview, payment, candidate, interviewer, adminEmail);
      } catch (emailError) {
        console.error('Error sending payment verification confirmation email:', emailError);
        // Continue with the response even if email fails
      }
    }
    
    res.json({
      message: verified ? 'Payment verified successfully' : 'Payment rejected',
      payment
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get all pending payments for verification (for interviewers and admins)
exports.getPendingPayments = async (req, res) => {
  try {
    // Only interviewers and admins can view pending payments
    if (req.user.role !== 'interviewer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Include both 'pending' and 'submitted' status payments that need verification
    let query = { status: { $in: [ 'submitted'] } };
    
    // If interviewer, only show their interviews' payments
    if (req.user.role === 'interviewer') {
      // First find all interviews by this interviewer
      const interviews = await Interview.find({ interviewer: req.user.id });
      const interviewIds = interviews.map(interview => interview._id);
      
      // Add interview filter to query
      query.interview = { $in: interviewIds };
    }
    
    const payments = await Payment.find(query)
      .populate({
        path: 'interview',
        populate: {
          path: 'candidate',
          select: 'name email'
        }
      });
    
    res.json(payments);
  } catch (err) {
    console.error('Error fetching pending payments:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get payment statistics for dashboard
exports.getPaymentStats = async (req, res) => {
  try {
    // Only admins can view payment statistics
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const stats = {
      total: await Payment.countDocuments(),
      pending: await Payment.countDocuments({ status: 'pending' }),
      submitted: await Payment.countDocuments({ status: 'submitted' }),
      verified: await Payment.countDocuments({ status: 'verified' }),
      rejected: await Payment.countDocuments({ status: 'rejected' }),
      totalAmount: 0
    };
    
    // Calculate total amount from verified payments
    const verifiedPayments = await Payment.find({ status: 'verified' });
    stats.totalAmount = verifiedPayments.reduce((sum, payment) => sum + payment.amount, 0); // Convert to rupees
    
    res.json(stats);
  } catch (err) {
    console.error('Error fetching payment statistics:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get all payments (for admin)
exports.getAllPayments = async (req, res) => {
  try {
    // Only admins can view all payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Get all payments with populated references
    const payments = await Payment.find()
      .populate('paidBy', 'name email')
      .populate('interview', 'scheduledDate interviewType')
      .populate('slotId', 'startTime interviewType')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 }); // Sort by newest first
    
    res.json(payments);
  } catch (err) {
    console.error('Error fetching all payments:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Delete a payment by ID
exports.deletePayment = async (req, res) => {
  try {
    // Only admins can delete payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const paymentId = req.params.paymentId;
    
    // Find the payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // If the payment is associated with an interview, update the interview
    if (payment.interview) {
      const interview = await Interview.findById(payment.interview);
      if (interview) {
        // Remove payment reference from interview
        interview.paymentId = undefined;
        await interview.save();
      }
    }
    
    // Delete the payment
    await Payment.findByIdAndDelete(paymentId);
    
    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
