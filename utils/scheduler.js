const Interview = require('../models/Interview');
const User = require('../models/User');
const { sendInterviewReminder } = require('./email');
const cron = require('node-cron');

/**
 * Schedule an email reminder for 30 minutes before an interview
 * @param {String} interviewId - The ID of the interview
 */
const scheduleInterviewReminder = async (interviewId) => {
  try {
    // Get the interview details
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      console.error(`Interview not found for ID: ${interviewId}`);
      return;
    }

    // Check if a reminder is already scheduled for this interview
    if (global.reminderJobs && global.reminderJobs.has(interviewId)) {
      console.log(`Reminder already scheduled for interview ${interviewId}, skipping`);
      return;
    }

    // Calculate the reminder time (30 minutes before the interview)
    const interviewTime = new Date(interview.scheduledDate);
    const reminderTime = new Date(interviewTime.getTime() - 30 * 60 * 1000);
    
    // If the reminder time is in the past, don't schedule it
    if (reminderTime <= new Date()) {
      console.log(`Reminder time is in the past for interview: ${interviewId}`);
      return;
    }

    console.log(`Scheduling reminder for interview ${interviewId} at ${reminderTime.toISOString()}`);
    
    // Schedule the reminder
    const job = setTimeout(async () => {
      try {
        // Remove the job from the map since it's executing now
        if (global.reminderJobs) {
          global.reminderJobs.delete(interviewId);
        }

        // Fetch the latest interview data to ensure it's not cancelled
        const updatedInterview = await Interview.findById(interviewId);
        if (!updatedInterview || updatedInterview.status === 'cancelled') {
          console.log(`Interview ${interviewId} is cancelled or no longer exists. Skipping reminder.`);
          return;
        }

        // Get user details
        const candidate = await User.findById(updatedInterview.candidate);
        const interviewer = await User.findById(updatedInterview.interviewer);
        const admin = await User.findOne({ role: 'admin' });
        
        // Send reminder emails
        await sendInterviewReminder(
          updatedInterview,
          candidate,
          interviewer,
          admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com'
        );
        
        console.log(`Reminder sent for interview ${interviewId}`);
      } catch (error) {
        console.error(`Error sending reminder for interview ${interviewId}:`, error);
      }
    }, reminderTime.getTime() - Date.now());
    
    // Store the job in a global map to be able to cancel it if needed
    if (!global.reminderJobs) {
      global.reminderJobs = new Map();
    }
    global.reminderJobs.set(interviewId, job);
    
  } catch (error) {
    console.error(`Error scheduling reminder for interview ${interviewId}:`, error);
  }
};

/**
 * Cancel a scheduled reminder
 * @param {String} interviewId - The ID of the interview
 */
const cancelInterviewReminder = (interviewId) => {
  if (global.reminderJobs && global.reminderJobs.has(interviewId)) {
    clearTimeout(global.reminderJobs.get(interviewId));
    global.reminderJobs.delete(interviewId);
    console.log(`Cancelled reminder for interview ${interviewId}`);
  }
};

/**
 * Initialize the scheduler to check for upcoming interviews
 */
const initializeScheduler = () => {
  // Initialize the global map for reminder jobs if it doesn't exist
  if (!global.reminderJobs) {
    global.reminderJobs = new Map();
  }

  // Run every hour to schedule reminders for upcoming interviews
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('Running scheduled check for upcoming interviews...');
      
      // Get all scheduled interviews in the next 24 hours
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const upcomingInterviews = await Interview.find({
        status: 'scheduled',
        scheduledDate: { $gte: now, $lte: tomorrow }
      });
      
      console.log(`Found ${upcomingInterviews.length} upcoming interviews in the next 24 hours`);
      
      // Log currently scheduled reminders
      console.log(`Currently have ${global.reminderJobs.size} reminders scheduled`);
      
      // Schedule reminders for each interview (the function will check for duplicates)
      for (const interview of upcomingInterviews) {
        scheduleInterviewReminder(interview._id);
      }
    } catch (error) {
      console.error('Error in scheduled interview check:', error);
    }
  });
  
  console.log('Interview reminder scheduler initialized');
};

module.exports = {
  scheduleInterviewReminder,
  cancelInterviewReminder,
  initializeScheduler
};
