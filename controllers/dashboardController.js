const Interview = require('../models/Interview');
const Payment = require('../models/Payment');

// Get dashboard stats for the logged-in user
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const now = new Date();
    
    let stats = {
      upcomingInterviews: 0,
      completedInterviews: 0,
      pendingPayments: 0,
      totalEarnings: 0
    };

    // Query parameters based on user role
    const userField = userRole === 'interviewer' ? 'interviewer' : 'candidate';
    const query = { [userField]: userId };

    // Count upcoming interviews (scheduled and in the future)
    const upcomingQuery = {
      ...query,
      status: 'scheduled',
      scheduledDate: { $gt: now },
    };
    stats.upcomingInterviews = await Interview.countDocuments(upcomingQuery);

    // Count completed interviews
    const completedQuery = {
      ...query,
      status: 'completed'
    };
    stats.completedInterviews = await Interview.countDocuments(completedQuery);

    // For interviewers: count pending payments and total earnings
    if (userRole === 'interviewer') {
      // Get all interviews for this interviewer (for calculating total earnings)
      const completedInterviews = await Interview.find(completedQuery);
      
      // Count pending payments (both 'pending' and 'submitted' status need verification)
      // Note: We're now counting all payments for this interviewer, not just those for completed interviews
      // This is because in the new pre-booking flow, payments are submitted before interviews are completed
      
      // First, get all interviews for this interviewer
      const allInterviews = await Interview.find({ interviewer: userId });
      const allInterviewIds = allInterviews.map(interview => interview._id);
     
      // Count payments that need verification
      const pendingPaymentsCount = await Payment.countDocuments({
        $or: [
          // Include payments linked to any interview by this interviewer
          { interview: { $in: allInterviewIds }, status: { $in: ['submitted'] } }
        ]
      });
      stats.pendingPayments = pendingPaymentsCount;
      
      // Calculate total earnings from verified payments
      const verifiedPayments = await Payment.find({
        interview: { $in: allInterviewIds },
        status: 'verified'
      });
      
      stats.totalEarnings = verifiedPayments.reduce((total, payment) => total + payment.amount, 0);
    }
    
    // For candidates: count pending payments
    if (userRole === 'candidate') {
      // Count all payments that need attention from this candidate
      // This includes both regular payments and pre-booking payments
      // Only count payments with 'pending' or 'rejected' status, not 'submitted'
      const pendingPaymentsCount = await Payment.countDocuments({
        paidBy: userId,
        status: { $in: ['pending', 'rejected'] }
      });
      stats.pendingPayments = pendingPaymentsCount;
    }
    
    res.json(stats);
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).send('Server error');
  }
};
