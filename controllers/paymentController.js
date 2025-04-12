const Payment = require('../models/Payment');
const Interview = require('../models/Interview');
const User = require('../models/User');
const InterviewPrice = require('../models/InterviewPrice');
const path = require('path');
const multer = require('multer');
const { uploadToS3 } = require('../utils/s3');

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

// Create a payment request for UPI payment
exports.createPaymentRequest = async (req, res) => {
  try {
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
    if (interview.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Payment already completed' });
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
    
    // Calculate amount with 18% GST
    const basePrice = priceRecord.price;
    const gstAmount = parseFloat((basePrice * 0.18).toFixed(2));
    const totalPrice = parseFloat((basePrice + gstAmount).toFixed(2));
    
    // Convert to paise (multiply by 100)
    const amount = Math.round(totalPrice * 100);
    
    // Create payment record with GST details
    const payment = new Payment({
      interview: interviewId,
      paidBy: req.user.id, // Add the paidBy field with the current user's ID
      amount,
      upiId: interviewer.upiId,
      qrCodeUrl: interviewer.qrCodeUrl,
      status: 'unpaid' // Initial status is unpaid until proof is submitted
    });
    
    await payment.save();
    
    // Update interview with payment ID
    interview.paymentId = payment._id;
    await interview.save();
    
    res.json({
      paymentId: payment._id,
      upiId: interviewer.upiId,
      qrCodeUrl: interviewer.qrCodeUrl,
      basePrice: basePrice,
      gstAmount: gstAmount,
      amount: amount / 100, // Convert to rupees for display
      gstPercentage: 18
    });
  } catch (err) {
    console.error('Payment request error:', err);
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
    const qrCodeUrl = await uploadToS3(req.file, 'qr-codes');
    
    const user = await User.findById(req.user.id);
    user.upiId = upiId;
    user.qrCodeUrl = qrCodeUrl;
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
    payment.transactionId = transactionId;
    payment.transactionScreenshot = screenshotUrl;
    payment.status = 'pending'; // Change status to pending after proof is submitted
    await payment.save();
    
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
    
    // If no payment exists, return an empty payment object with status 'unpaid'
    // instead of a 404 error to make client-side handling easier
    if (!payment) {
      console.log(`No payment found for interview ${interviewId}, returning unpaid status`);
      return res.json({ 
        status: 'unpaid',
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
      
      // Update interview payment status
      interview.paymentStatus = 'paid';
      await interview.save();
    } else {
      payment.status = 'rejected';
      payment.verifiedBy = req.user.id;
      payment.verifiedAt = Date.now();
    }
    
    await payment.save();
    
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
    
    let query = { status: 'pending' };
    
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
    stats.totalAmount = verifiedPayments.reduce((sum, payment) => sum + payment.amount, 0) / 100; // Convert to rupees
    
    res.json(stats);
  } catch (err) {
    console.error('Error fetching payment statistics:', err);
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
