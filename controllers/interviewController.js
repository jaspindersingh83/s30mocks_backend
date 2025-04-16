const Interview = require('../models/Interview');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { 
  sendEmail,
  sendInterviewBookingNotification,
  sendInterviewCancellationNotification,
  sendInterviewBookingConfirmation,
  sendInterviewCancellationConfirmation
} = require('../utils/email');

// Create a new interview
exports.createInterview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { interviewerId, scheduledDate, duration } = req.body;
    
    // Verify interviewer exists and has the role 'interviewer'
    const interviewer = await User.findOne({ _id: interviewerId, role: 'interviewer' });
    if (!interviewer) {
      return res.status(404).json({ message: 'Interviewer not found' });
    }
    
    // Check if the candidate has any pending payments for previous interviews
    const pendingInterviews = await Interview.find({
      candidate: req.user.id,
      status: { $ne: 'cancelled' },
      paymentStatus: 'pending'
    });
    
    if (pendingInterviews.length > 0) {
      return res.status(400).json({ 
        message: 'You have pending payments for previous interviews. Please complete those payments before scheduling a new interview.',
        pendingInterviews: pendingInterviews
      });
    }
    
    // Create new interview
    const interview = new Interview({
      candidate: req.user.id,
      interviewer: interviewerId,
      scheduledDate,
      duration: duration || 60,
      meetingLink: interviewer?.defaultMeetingLink || 'ping support team in whatsapp for link'
    });

    await interview.save();
    
    // Get candidate, interviewer, and admin details for email notification
    const candidate = await User.findById(req.user.id);
    const interviewerDetails = await User.findById(interviewerId);
    const admin = await User.findOne({ role: 'admin' });
    const adminEmail = admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com';
    
    // Send email notification to interviewer
    try {
      await sendInterviewBookingNotification(interview, candidate, interviewerDetails, adminEmail);
      // Send email confirmation to candidate
      await sendInterviewBookingConfirmation(interview, candidate, interviewerDetails, adminEmail);
    } catch (emailError) {
      console.error('Error sending booking notification emails:', emailError);
      // Continue with the response even if email fails
    }
    
    res.status(201).json(interview);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all interviews for a user (based on their role)
exports.getInterviews = async (req, res) => {
  try {
    // Build the query based on user role
    let query = {};
    
    // Filter by user role (interviewer or candidate)
    if (req.user.role === 'interviewer') {
      query.interviewer = req.user.id;
    } else {
      query.candidate = req.user.id;
    }
    
    // Filter by status if provided in query params
    if (req.query.status) {
      // Handle special case for 'scheduled' status - also include future dates
      if (req.query.status === 'scheduled') {
        query.status = 'scheduled';
        // Only include future scheduled interviews
        query.scheduledDate = { $gt: new Date() };
        console.log(`Filtering interviews by status: scheduled (future only)`);
      } 
      // Handle other standard statuses
      else if (['in-progress', 'completed', 'cancelled'].includes(req.query.status)) {
        query.status = req.query.status;
        console.log(`Filtering interviews by status: ${req.query.status}`);
      }
    }
    
    // Execute the query with filters
    const interviews = await Interview.find(query)
      .populate(req.user.role === 'interviewer' ? 'candidate' : 'interviewer', 'name email linkedInUrl')
      .sort({ scheduledDate: 1 });
    res.json(interviews);
  } catch (err) {
    console.error('Error fetching interviews:', err.message);
    res.status(500).send('Server error');
  }
};

// Get a specific interview by ID
exports.getInterviewById = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('candidate', 'name email linkedInUrl')
      .populate('interviewer', 'name email linkedInUrl')
      .populate('problem');
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Check if user is authorized to view this interview
    if (
      interview.candidate._id.toString() !== req.user.id && 
      interview.interviewer._id.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // If user is a candidate and interview is not completed,
    // don't send problem solution and video URL
    if (
      req.user.role === 'candidate' &&
      interview.status !== 'completed' &&
      interview.problem
    ) {
      const { solutionUrl, videoUrl, ...problemWithoutSolution } = interview.problem.toObject();
      interview.problem = problemWithoutSolution;
    }
    
    res.json(interview);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Cancel an interview (for candidates)
exports.cancelInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Check if user is authorized to cancel this interview
    if (interview.candidate.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to cancel this interview' });
    }
    
    // Check if interview can be cancelled (only scheduled interviews can be cancelled)
    if (interview.status !== 'scheduled') {
      return res.status(400).json({ message: 'Only scheduled interviews can be cancelled' });
    }
    
    // Update interview status to cancelled
    interview.status = 'cancelled';
    await interview.save();
    
    // If the interview was booked from a slot, make the slot available again
    if (interview.slot) {
      const InterviewSlot = require('../models/InterviewSlot');
      const slot = await InterviewSlot.findById(interview.slot);
      
      if (slot) {
        slot.isBooked = false;
        await slot.save();
      }
    }
    
    // Get candidate, interviewer, and admin details for email notification
    const candidate = await User.findById(req.user.id);
    const interviewer = await User.findById(interview.interviewer);
    const admin = await User.findOne({ role: 'admin' });
    const adminEmail = admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com';
    
    // Send email notifications
    try {
      // Send to interviewer
      await sendInterviewCancellationNotification(interview, candidate, interviewer, adminEmail);
      
      // Send confirmation to candidate
      await sendInterviewCancellationConfirmation(interview, candidate, interviewer, adminEmail);
      
      // Send notification to admin (if admin is not the interviewer)
      if (adminEmail && adminEmail !== interviewer.email) {
        await sendEmail(
          adminEmail,
          `[ADMIN] Interview Cancellation: ${candidate.name} with ${interviewer.name}`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Interview Cancellation (Admin Notification)</h2>
            <p>Hello Admin,</p>
            <p>An interview has been cancelled. Here are the details:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Candidate:</strong> ${candidate.name} (${candidate.email})</p>
              <p><strong>Interviewer:</strong> ${interviewer.name} (${interviewer.email})</p>
              <p><strong>Originally Scheduled:</strong> ${new Date(interview.scheduledDate).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${interview.duration} minutes</p>
              <p><strong>Interview Type:</strong> ${interview.interviewType || 'Not specified'}</p>
              <p><strong>Price:</strong> ${interview.currency} ${interview.price}</p>
              <p><strong>Cancelled By:</strong> ${req.user.role === 'admin' ? 'Admin' : 'Candidate'}</p>
            </div>
            <p>This is an automated notification for administrative purposes.</p>
            <p>Best regards,<br>S30 Mocks System</p>
          </div>`,
          `Interview Cancellation (Admin Notification)

Hello Admin,

An interview has been cancelled. Here are the details:

Candidate: ${candidate.name} (${candidate.email})
Interviewer: ${interviewer.name} (${interviewer.email})
Originally Scheduled: ${new Date(interview.scheduledDate).toLocaleString()}
Duration: ${interview.duration} minutes
Interview Type: ${interview.interviewType || 'Not specified'}
Price: ${interview.currency} ${interview.price}
Cancelled By: ${req.user.role === 'admin' ? 'Admin' : 'Candidate'}

This is an automated notification for administrative purposes.

Best regards,
S30 Mocks System`
        );
      }
      
      console.log('Cancellation notification emails sent successfully');
    } catch (emailError) {
      console.error('Error sending cancellation notification emails:', emailError);
      // Continue with the response even if email fails
    }
    
    res.json({ message: 'Interview cancelled successfully', interview });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update interview status
exports.updateInterviewStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['scheduled', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const interview = await Interview.findById(req.params.id);
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Only interviewer or admin can update status
    if (
      interview.interviewer.toString() !== req.user.id && 
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Store old status for comparison
    const oldStatus = interview.status;
    
    // Update interview status
    interview.status = status;
    await interview.save();
    
    // If status is being changed to cancelled, make the slot available again
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      // If the interview was booked from a slot, make the slot available again
      if (interview.slot) {
        const InterviewSlot = require('../models/InterviewSlot');
        const slot = await InterviewSlot.findById(interview.slot);
        
        if (slot) {
          slot.isBooked = false;
          await slot.save();
          console.log(`Slot ${slot._id} has been made available again after interview cancellation`);
        }
      }
      
      // Get candidate and interviewer details for email notification
      try {
        const candidate = await User.findById(interview.candidate);
        const interviewer = await User.findById(interview.interviewer);
        const admin = await User.findOne({ role: 'admin' });
        const adminEmail = admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com';
        
        // Send email notifications
        await sendInterviewCancellationNotification(interview, candidate, interviewer, adminEmail);
        await sendInterviewCancellationConfirmation(interview, candidate, interviewer, adminEmail);
      } catch (emailError) {
        console.error('Error sending cancellation notification emails:', emailError);
        // Continue with the response even if email fails
      }
    }
    
    res.json(interview);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update meeting details (link and password)
exports.updateMeetingDetails = async (req, res) => {
  try {
    const { meetingLink, meetingPassword } = req.body;
    
    const interview = await Interview.findById(req.params.id);
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Only interviewer can update meeting details
    if (interview.interviewer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    if (meetingLink) interview.meetingLink = meetingLink;
    if (meetingPassword) interview.meetingPassword = meetingPassword;
    
    await interview.save();
    
    res.json(interview);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get available time slots for an interviewer
exports.getAvailableTimeSlots = async (req, res) => {
  try {
    const { interviewerId, date } = req.query;
    
    // Verify interviewer exists
    const interviewer = await User.findOne({ _id: interviewerId, role: 'interviewer' });
    if (!interviewer) {
      return res.status(404).json({ message: 'Interviewer not found' });
    }
    
    // Get existing interviews for that day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const interviews = await Interview.find({
      interviewer: interviewerId,
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: { $ne: 'cancelled' }
    });
    
    // Generate available time slots (9 AM to 5 PM, 1-hour slots)
    const bookedTimes = interviews.map(interview => {
      const time = new Date(interview.scheduledDate);
      return time.getHours();
    });
    
    const availableSlots = [];
    for (let hour = 9; hour < 17; hour++) {
      if (!bookedTimes.includes(hour)) {
        const slot = new Date(date);
        slot.setHours(hour, 0, 0, 0);
        availableSlots.push(slot);
      }
    }
    
    res.json(availableSlots);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
