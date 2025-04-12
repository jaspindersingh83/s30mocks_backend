const User = require('../models/User');

// Get all users with pagination, search, and filtering
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role;

    // Build query
    const query = {};
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add role filter
    if (role) {
      query.role = role;
    }
    
    // Execute query with pagination
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    // Validate role
    if (!['admin', 'interviewer', 'candidate'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    // Find user and update role
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent changing role of the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot change role of the last admin' });
      }
    }
    
    // Update user role
    user.role = role;
    await user.save();
    
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get user details
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const Interview = require('../models/Interview');
const Payment = require('../models/Payment');

// Get all interviews with filters for admin
exports.getAllInterviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Extract filters from query params
    const { status, paymentStatus, search } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by interview status
    if (status) {
      if (status === 'scheduled') {
        query.status = 'scheduled';
        // Only include future scheduled interviews
        query.scheduledDate = { $gt: new Date() };
      } else if (['in-progress', 'completed', 'cancelled'].includes(status)) {
        query.status = status;
      }
    }
    
    // Filter by payment status
    if (paymentStatus && ['pending', 'submitted', 'verified', 'rejected', 'refunded'].includes(paymentStatus)) {
      query.paymentStatus = paymentStatus;
    }
    
    // Add search functionality
    if (search) {
      // We need to find users that match the search and then filter interviews
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      
      query.$or = [
        { candidate: { $in: userIds } },
        { interviewer: { $in: userIds } }
      ];
    }
    
    // Execute query with pagination
    const interviews = await Interview.find(query)
      .populate('candidate', 'name email')
      .populate('interviewer', 'name email')
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Interview.countDocuments(query);
    
    res.json({
      interviews,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching interviews for admin:', err.message);
    res.status(500).send('Server error');
  }
};
