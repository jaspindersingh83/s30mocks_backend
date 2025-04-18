/**
 * Script to send promotional emails to candidates who have signed up but haven't scheduled their first mock interview
 * 
 * Usage: node scripts/sendPromotionalEmails.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Interview = require('../models/Interview');
const { sendPromotionalEmail } = require('../utils/email');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

/**
 * Send promotional emails to candidates who haven't scheduled their first interview
 */
const sendPromotionalEmails = async () => {
  try {
    console.log('Finding candidates who have not scheduled interviews...');
    
    // Get all candidates
    const candidates = await User.find({ role: 'candidate' });
    console.log(`Found ${candidates.length} total candidates`);
    
    // Get candidates who have scheduled at least one interview
    const candidatesWithInterviews = await Interview.distinct('candidate');
    console.log(`Found ${candidatesWithInterviews.length} candidates who have scheduled interviews`);
    
    // Filter candidates who haven't scheduled any interviews
    const eligibleCandidates = candidates.filter(
      candidate => !candidatesWithInterviews.some(
        id => id.toString() === candidate._id.toString()
      )
    );
    
    console.log(`Found ${eligibleCandidates.length} candidates who have not scheduled any interviews`);
    
    if (eligibleCandidates.length === 0) {
      console.log('No eligible candidates found. Exiting.');
      mongoose.disconnect();
      return;
    }
    
    // Get admin email for CC
    const admin = await User.findOne({ role: 'admin' });
    const adminEmail = admin ? admin.email : process.env.ADMIN_EMAIL || 'admin@s30mocks.com';
    
    console.log(`Sending promotional emails to ${eligibleCandidates.length} candidates...`);
    console.log(`CC'ing admin at ${adminEmail}`);
    
    // Send promotional emails
    const results = await sendPromotionalEmail(eligibleCandidates, adminEmail);
    
    console.log('Email sending completed.');
    console.log(`Successfully sent: ${results.filter(r => !r.error).length}`);
    console.log(`Failed: ${results.filter(r => r.error).length}`);
    
    // Disconnect from MongoDB
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error sending promotional emails:', error);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Execute the function
sendPromotionalEmails();
