const Feedback = require('../models/Feedback');
const Interview = require('../models/Interview');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { sendFeedbackNotification } = require('../utils/email');

// Create feedback for an interview
exports.createFeedback = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      interviewId, 
      codingAndDebugging, 
      communicationScore, 
      problemSolvingScore, 
      strengths, 
      areasOfImprovement, 
      additionalComments 
    } = req.body;
    
    // Verify interview exists
    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ 
        message: 'Interview not found' 
      });
    }
    
    // Verify the current user is the interviewer for this interview
    if (interview.interviewer.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'Only the interviewer can provide feedback' 
      });
    }
    
    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({ interview: interviewId });
    if (existingFeedback) {
      return res.status(400).json({ 
        message: 'Feedback already exists for this interview' 
      });
    }
    
    // Create new feedback
    const feedback = new Feedback({
      interview: interviewId,
      interviewer: req.user.id,
      candidate: interview.candidate,
      codingAndDebugging,
      communicationScore,
      problemSolvingScore,
      strengths,
      areasOfImprovement,
      additionalComments
    });

    await feedback.save();
    
    // Update interview status to completed
    interview.status = 'completed';
    await interview.save();
    
    // Get candidate and admin details for email notification
    const candidate = await User.findById(interview.candidate);
    const interviewer = await User.findById(interview.interviewer);
    const admin = await User.findOne({ role: 'admin' });
    
    // Send email notifications
    try {
      await sendFeedbackNotification(
        feedback, 
        interview, 
        candidate, 
        interviewer, 
        admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com'
      );
    } catch (emailError) {
      console.error('Error sending feedback notification emails:', emailError);
      // Continue with the response even if email sending fails
    }
    
    res.status(201).json(feedback);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get feedback for a specific interview
exports.getFeedbackByInterviewId = async (req, res) => {
  try {
    const interviewId = req.params.interviewId;
    
    // Verify interview exists
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Check if user is authorized to view this feedback
    if (
      interview.candidate.toString() !== req.user.id && 
      interview.interviewer.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const feedback = await Feedback.findOne({ interview: interviewId })
      .populate('interviewer', 'name email')
      .populate('candidate', 'name email');
    
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    
    res.json(feedback);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all feedback for a candidate
exports.getCandidateFeedback = async (req, res) => {
  try {
    // Only the candidate themselves or an admin can view all their feedback
    if (
      req.params.candidateId !== req.user.id && 
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const feedback = await Feedback.find({ candidate: req.params.candidateId })
      .populate('interviewer', 'name email')
      .populate('interview')
      .sort({ createdAt: -1 });
    
    res.json(feedback);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update feedback
exports.updateFeedback = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      codingAndDebugging, 
      communicationScore, 
      problemSolvingScore, 
      strengths, 
      areasOfImprovement, 
      additionalComments 
    } = req.body;
    
    // Find the feedback
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    
    // Verify the current user is the interviewer who created this feedback
    if (feedback.interviewer.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'Only the original interviewer can update feedback' 
      });
    }
    
    // Update feedback fields
    if (codingAndDebugging) feedback.codingAndDebugging = codingAndDebugging;
    if (communicationScore) feedback.communicationScore = communicationScore;
    if (problemSolvingScore) feedback.problemSolvingScore = problemSolvingScore;
    if (strengths) feedback.strengths = strengths;
    if (areasOfImprovement) feedback.areasOfImprovement = areasOfImprovement;
    if (additionalComments) feedback.additionalComments = additionalComments;
    
    await feedback.save();
    
    res.json(feedback);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
