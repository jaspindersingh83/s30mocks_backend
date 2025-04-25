const mongoose = require('mongoose');
const Interview = require('../models/Interview');
const Payment = require('../models/Payment');
const Feedback = require('../models/Feedback');
require('dotenv').config();

// The specific interview ID to delete
const interviewId = '680b108a8d76d5e922356f16';


async function deleteSpecificInterview() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected...');
    
    // Find the interview
    const interview = await Interview.findById(interviewId);
    
    if (!interview) {
      console.log(`Interview with ID ${interviewId} not found.`);
      await mongoose.disconnect();
      return;
    }
    
    console.log(`Found interview: ${interviewId}`);
    
    // Find and delete associated payment
    let paymentDeleted = false;
    if (interview.paymentId) {
      const payment = await Payment.findOneAndDelete({ _id: interview.paymentId });
      if (payment) {
        console.log(`Deleted associated payment: ${payment._id}`);
        paymentDeleted = true;
      } else {
        console.log(`No payment found with ID: ${interview.paymentId}`);
      }
    } else {
      // Try to find payment by interview ID
      const payment = await Payment.findOneAndDelete({ interview: interviewId });
      if (payment) {
        console.log(`Deleted associated payment: ${payment._id}`);
        paymentDeleted = true;
      } else {
        console.log('No associated payment found for this interview.');
      }
    }
    
    // Find and delete associated feedback
    const feedback = await Feedback.findOneAndDelete({ interview: interviewId });
    if (feedback) {
      console.log(`Deleted associated feedback: ${feedback._id}`);
    } else {
      console.log('No associated feedback found for this interview.');
    }
    
    // Delete the interview
    await Interview.findByIdAndDelete(interviewId);
    console.log(`Deleted interview: ${interviewId}`);
    
    console.log('Summary:');
    console.log(`- Interview ${interviewId} deleted`);
    console.log(`- Payment ${paymentDeleted ? 'deleted' : 'not found'}`);
    console.log(`- Feedback ${feedback ? 'deleted' : 'not found'}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
    
  } catch (err) {
    console.error('Error:', err.message);
    try {
      await mongoose.disconnect();
    } catch (disconnectErr) {
      console.error('Error disconnecting from MongoDB:', disconnectErr.message);
    }
  }
}

// Run the function
deleteSpecificInterview();
