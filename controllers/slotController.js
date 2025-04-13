const InterviewSlot = require('../models/InterviewSlot');
const User = require('../models/User');
const Interview = require('../models/Interview');
const InterviewPrice = require('../models/InterviewPrice');
const { validationResult } = require('express-validator');
const { parse } = require('csv-parse/sync');
const nodemailer = require('nodemailer');
const { scheduleInterviewReminder } = require('../utils/scheduler');

// Create slots from Google Sheet data
exports.createSlotsFromSheet = async (req, res) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({ errors: validationErrors.array() });
    }

    const { csvData } = req.body;
    
    if (!csvData) {
      return res.status(400).json({ message: 'CSV data is required' });
    }
    
    // Parse CSV data
    // Expected format: interviewer_email,start_time,end_time
    // Example: interviewer@example.com,2023-04-10T10:00:00Z,2023-04-10T10:40:00Z
    let records;
    try {
      records = parse(csvData, {
        columns: true,
        skip_empty_lines: true
      });
    } catch (err) {
      return res.status(400).json({ message: 'Invalid CSV format', error: err.message });
    }
    
    if (!records || records.length === 0) {
      return res.status(400).json({ message: 'No valid records found in CSV data' });
    }
    
    const createdSlots = [];
    const processingErrors = [];
    
    // Process each record
    for (const record of records) {
      try {
        const { interviewer_email, start_time, end_time } = record;
        
        // Validate required fields
        if (!interviewer_email || !start_time || !end_time) {
          processingErrors.push(`Missing required fields in record: ${JSON.stringify(record)}`);
          continue;
        }
        
        // Find interviewer by email
        const interviewer = await User.findOne({ 
          email: interviewer_email.trim().toLowerCase(),
          role: 'interviewer'
        });
        
        if (!interviewer) {
          processingErrors.push(`Interviewer not found with email: ${interviewer_email}`);
          continue;
        }
        
        // Create slot
        const startTime = new Date(start_time);
        const endTime = new Date(end_time);
        
        // Validate times
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          processingErrors.push(`Invalid date format in record: ${JSON.stringify(record)}`);
          continue;
        }
        
        // Check if slot already exists
        const existingSlot = await InterviewSlot.findOne({
          interviewer: interviewer._id,
          startTime,
          endTime
        });
        
        if (existingSlot) {
          processingErrors.push(`Slot already exists for interviewer ${interviewer_email} at ${start_time}`);
          continue;
        }
        
        // Create new slot
        const slot = new InterviewSlot({
          interviewer: interviewer._id,
          startTime,
          endTime,
          createdBy: req.user.id
        });
        
        await slot.save();
        createdSlots.push(slot);
      } catch (err) {
        processingErrors.push(`Error processing record: ${err.message}`);
      }
    }
    
    res.status(201).json({
      message: `Successfully created ${createdSlots.length} slots`,
      createdSlots,
      errors: processingErrors.length > 0 ? processingErrors : undefined
    });
  } catch (err) {
    console.error('Error creating slots:', err);
    res.status(500).send('Server error');
  }
};

// Get all available slots
exports.getAvailableSlots = async (req, res) => {
  try {
    const { startDate, endDate, interviewerId, interviewType } = req.query;
    
    // Build filter
    const filter = { isBooked: false };
    
    // Add interviewer filter if provided
    if (interviewerId) {
      filter.interviewer = interviewerId;
    }
    
    // Add interview type filter if provided
    if (interviewType && ['DSA', 'System Design'].includes(interviewType)) {
      filter.interviewType = interviewType;
    }
    
    // Add date range filter if provided
    if (startDate && endDate) {
      filter.startTime = { 
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      filter.startTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.startTime = { $lte: new Date(endDate) };
    } else {
      // Default to future slots if no dates specified
      filter.startTime = { $gte: new Date() };
    }
    
    // Get available slots
    const slots = await InterviewSlot.find(filter)
      .populate('interviewer', 'name email')
      .sort({ startTime: 1 });
    
    // Get prices for each interview type
    const prices = await InterviewPrice.find();
    const priceMap = {};
    prices.forEach(price => {
      priceMap[price.interviewType] = {
        price: price.price,
        currency: price.currency
      };
    });
    
    // Add price information to each slot
    const slotsWithPrices = slots.map(slot => {
      const slotObj = slot.toObject();
      if (priceMap[slot.interviewType]) {
        slotObj.price = priceMap[slot.interviewType].price;
        slotObj.currency = priceMap[slot.interviewType].currency;
      }
      return slotObj;
    });
    
    res.json(slotsWithPrices);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Book a slot
exports.bookSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    
    // Find the slot
    const slot = await InterviewSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    // Check if slot is already booked
    if (slot.isBooked) {
      return res.status(400).json({ message: 'Slot is already booked' });
    }
    
    // Get the price for this interview type
    const priceRecord = await InterviewPrice.findOne({ interviewType: slot.interviewType });
    if (!priceRecord) {
      return res.status(404).json({ message: `Price for ${slot.interviewType} interviews not found` });
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
    
    // Set duration based on interview type
    const duration = slot.interviewType === 'DSA' ? 40 : 50;
    
    // Create interview
    const interview = new Interview({
      candidate: req.user.id,
      interviewer: slot.interviewer,
      interviewType: slot.interviewType,
      scheduledDate: slot.startTime,
      duration: duration,
      price: priceRecord.price,
      currency: priceRecord.currency,
      status: 'scheduled',
      slot: slot._id, // Set the reference to the slot
      meetingLink: `https://meet.google.com/${Math.random().toString(36).substring(2, 10)}`
    });
    
    await interview.save();
    
    // Update slot
    slot.isBooked = true;
    slot.interview = interview._id;
    await slot.save();
    
    // Schedule email reminders for 30 minutes before the interview
    await scheduleInterviewReminder(interview._id);
    
    res.json({
      message: 'Slot booked successfully',
      interview,
      slot
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all slots (admin only)
exports.getAllSlots = async (req, res) => {
  try {
    const slots = await InterviewSlot.find()
      .populate('interviewer', 'name email')
      .populate('interview')
      .sort({ startTime: 1 });
    
    res.json(slots);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Delete a slot (admin only)
exports.deleteSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    
    // Find the slot
    const slot = await InterviewSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    // Check if slot is booked
    if (slot.isBooked) {
      return res.status(400).json({ message: 'Cannot delete a booked slot' });
    }
    
    // Delete the slot
    await InterviewSlot.findByIdAndDelete(slotId);
    
    res.json({ message: 'Slot deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Create a slot (for interviewers)
exports.createInterviewerSlot = async (req, res) => {
  try {
    const { startTime, endTime, interviewType } = req.body;
    
    // Validate input
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start time and end time are required' });
    }
    
    // Validate interview type
    if (!interviewType) {
      return res.status(400).json({ message: 'Interview type is required' });
    }
    
    if (!['DSA', 'System Design'].includes(interviewType)) {
      return res.status(400).json({ message: 'Interview type must be either DSA or System Design' });
    }
    
    // Check if user is an interviewer
    if (req.user.role !== 'interviewer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only interviewers can create slots' });
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Validate times
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    // Ensure start time is at a full hour (minutes, seconds, and milliseconds are 0)
    if (start.getMinutes() !== 0 || start.getSeconds() !== 0 || start.getMilliseconds() !== 0) {
      return res.status(400).json({ message: 'Slots can only be created at full hours (1:00 PM, 2:00 PM, etc.)' });
    }
    
    // Ensure start time is in the future
    if (start < new Date()) {
      return res.status(400).json({ message: 'Start time must be in the future' });
    }
    
    // Ensure end time is after start time
    if (end <= start) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }
    
    // Validate duration based on interview type
    const durationMinutes = (end - start) / (1000 * 60);
    if (interviewType === 'DSA' && Math.abs(durationMinutes - 40) > 1) {
      return res.status(400).json({ message: 'DSA interview slots must be 40 minutes' });
    }
    if (interviewType === 'System Design' && Math.abs(durationMinutes - 50) > 1) {
      return res.status(400).json({ message: 'System Design interview slots must be 50 minutes' });
    }
    
    // Check if slot already exists
    const existingSlot = await InterviewSlot.findOne({
      interviewer: req.user.id,
      $or: [
        // Check if new slot overlaps with existing slots
        { startTime: { $lt: end }, endTime: { $gt: start } }
      ]
    });
    
    if (existingSlot) {
      return res.status(400).json({ message: 'Slot overlaps with an existing slot' });
    }
    
    // Create new slot
    const slot = new InterviewSlot({
      interviewer: req.user.id,
      startTime: start,
      endTime: end,
      interviewType,
      createdBy: req.user.id
    });
    
    await slot.save();
    
    res.status(201).json({
      message: 'Slot created successfully',
      slot
    });
  } catch (err) {
    console.error('Error creating slot:', err);
    res.status(500).send('Server error');
  }
};

// Get interviewer's slots
exports.getInterviewerSlots = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build filter
    const filter = { interviewer: req.user.id };
    
    // Add date range filter if provided
    if (startDate && endDate) {
      filter.startTime = { 
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      filter.startTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.startTime = { $lte: new Date(endDate) };
    } else {
      // Default to future slots if no dates specified
      filter.startTime = { $gte: new Date() };
    }
    
    // Get slots
    const slots = await InterviewSlot.find(filter)
      .populate('interview', 'candidate status')
      .sort({ startTime: 1 });
    
    res.json(slots);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Create multiple slots at once (for recurring slots)
exports.createBatchSlots = async (req, res) => {
  try {
    const { interviewType, slots } = req.body;
    
    // Validate input
    if (!interviewType || !slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: 'Interview type and slots array are required' });
    }
    
    // Validate interview type
    if (!['DSA', 'System Design'].includes(interviewType)) {
      return res.status(400).json({ message: 'Interview type must be either DSA or System Design' });
    }
    
    // Check if user is an interviewer
    if (req.user.role !== 'interviewer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only interviewers can create slots' });
    }
    
    // Validate each slot's start and end times
    for (const slot of slots) {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
      
      // Validate times
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid start or end time' });
      }
      
      // Check if start time is before end time
      if (start >= end) {
        return res.status(400).json({ message: 'Start time must be before end time' });
      }
      
      // Check if the slot is in the future
      if (start <= new Date()) {
        return res.status(400).json({ message: 'Slots must be in the future' });
      }
    }
    
    // Create all slots
    const createdSlots = [];
    for (const slot of slots) {
      const newSlot = new InterviewSlot({
        interviewer: req.user.id,
        startTime: slot.start,
        endTime: slot.end,
        interviewType,
        status: 'available'
      });
      
      await newSlot.save();
      createdSlots.push(newSlot);
    }
    
    res.status(201).json({
      message: `Successfully created ${createdSlots.length} slots`,
      slots: createdSlots
    });
  } catch (err) {
    console.error('Error creating batch slots:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete interviewer's slot
exports.deleteInterviewerSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    
    // Find the slot
    const slot = await InterviewSlot.findById(slotId);
    
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    // Check if user is the interviewer who created the slot
    if (slot.interviewer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this slot' });
    }
    
    // Check if slot is already booked
    if (slot.isBooked) {
      return res.status(400).json({ message: 'Cannot delete a booked slot' });
    }
    
    // Delete the slot
    await InterviewSlot.findByIdAndDelete(slotId);
    
    res.json({ message: 'Slot deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Helper function to schedule reminder emails
async function scheduleReminderEmail(interviewId) {
  try {
    const interview = await Interview.findById(interviewId)
      .populate('candidate', 'name email emailNotifications')
      .populate('interviewer', 'name email emailNotifications');
    
    if (!interview) {
      console.error(`Interview not found with ID: ${interviewId}`);
      return;
    }
    
    const interviewTime = new Date(interview.scheduledDate);
    const reminderTime = new Date(interviewTime.getTime() - 30 * 60 * 1000); // 30 minutes before
    
    // Calculate delay until reminder time
    const now = new Date();
    const delay = reminderTime.getTime() - now.getTime();
    
    if (delay <= 0) {
      console.log('Interview is too soon for a reminder');
      return;
    }
    
    // Schedule reminder
    setTimeout(async () => {
      try {
        // Fetch fresh interview data in case it was updated
        const updatedInterview = await Interview.findById(interviewId)
          .populate('candidate', 'name email emailNotifications')
          .populate('interviewer', 'name email emailNotifications')
          .populate('problem');
        
        if (!updatedInterview || updatedInterview.status === 'cancelled') {
          console.log('Interview cancelled or not found, skipping reminder');
          return;
        }
        
        // Send emails
        await sendReminderEmail(updatedInterview);
      } catch (err) {
        console.error('Error sending reminder email:', err);
      }
    }, delay);
    
    console.log(`Reminder scheduled for interview ${interviewId} at ${reminderTime}`);
  } catch (err) {
    console.error('Error scheduling reminder:', err);
  }
}

// Helper function to send reminder emails
async function sendReminderEmail(interview) {
  // This would typically use a proper email service like SendGrid, Mailgun, etc.
  // For demonstration purposes, we'll just log the email content
  
  // Check if users have email notifications enabled
  const candidateWantsEmails = interview.candidate.emailNotifications !== false;
  const interviewerWantsEmails = interview.interviewer.emailNotifications !== false;
  
  if (!candidateWantsEmails && !interviewerWantsEmails) {
    console.log('Both users have disabled email notifications');
    return;
  }
  
  const interviewDate = new Date(interview.scheduledDate);
  const formattedDate = interviewDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // In a real implementation, you would use an email service here
  console.log('Sending reminder emails for interview:', interview._id);
  
  if (candidateWantsEmails) {
    console.log(`To: ${interview.candidate.email}`);
    console.log(`Subject: Reminder: Your mock interview is in 30 minutes`);
    console.log(`Body: 
      Hello ${interview.candidate.name},
      
      This is a reminder that your mock interview is scheduled to begin in 30 minutes at ${formattedDate}.
      
      Meeting link: ${interview.meetingLink}
      
      Please be ready on time and ensure your camera and microphone are working properly.
      
      Good luck!
      
      The Mock Interview Team
    `);
  }
  
  if (interviewerWantsEmails) {
    console.log(`To: ${interview.interviewer.email}`);
    console.log(`Subject: Reminder: You have an interview to conduct in 30 minutes`);
    console.log(`Body: 
      Hello ${interview.interviewer.name},
      
      This is a reminder that you are scheduled to conduct a mock interview in 30 minutes at ${formattedDate}.
      
      Candidate: ${interview.candidate.name}
      Meeting link: ${interview.meetingLink}
      ${interview.problem ? `Problem: ${interview.problem.title}` : 'No problem assigned yet'}
      
      Please be ready on time and ensure your camera and microphone are working properly.
      
      Thank you for your contribution!
      
      The Mock Interview Team
    `);
  }
}
