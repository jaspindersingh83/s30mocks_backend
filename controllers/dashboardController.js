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
      // Get all completed interviews for this interviewer
      const completedInterviews = await Interview.find(completedQuery);
      const interviewIds = completedInterviews.map(interview => interview._id);
      
      // Count pending payments
      const pendingPaymentsCount = await Payment.countDocuments({
        interview: { $in: interviewIds },
        status: 'pending'
      });
      stats.pendingPayments = pendingPaymentsCount;
      
      // Calculate total earnings from verified payments
      const verifiedPayments = await Payment.find({
        interview: { $in: interviewIds },
        status: 'verified'
      });
      
      stats.totalEarnings = verifiedPayments.reduce((total, payment) => total + payment.amount, 0);
    }
    
    // For candidates: count pending payments only for completed interviews
    if (userRole === 'candidate') {
      // First get all completed interviews for this candidate
      const completedInterviews = await Interview.find({
        candidate: userId,
        status: 'completed'
      });
      const completedInterviewIds = completedInterviews.map(interview => interview._id);
      
      // Count pending payments only for completed interviews
      const pendingPaymentsCount = await Payment.countDocuments({
        paidBy: userId,
        interview: { $in: completedInterviewIds },
        status: 'pending'
      });
      stats.pendingPayments = pendingPaymentsCount;
    }
    
    res.json(stats);
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).send('Server error');
  }
};
