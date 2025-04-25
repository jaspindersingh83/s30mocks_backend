const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Interview = require('../models/Interview');
require('dotenv').config();

const paymentId = '68052  42e43f121af6871e10a';

async function deletePayment() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find the payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      console.log('Payment not found');
      return;
    }
    
    console.log('Found payment:', payment);
    
    // If the payment is associated with an interview, update the interview
    if (payment.interview) {
      const interview = await Interview.findById(payment.interview);
      if (interview) {
        // Remove payment reference from interview
        interview.paymentId = undefined;
        await interview.save();
        console.log('Updated interview:', interview._id);
      }
    }
    
    // Delete the payment
    await Payment.findByIdAndDelete(paymentId);
    console.log('Payment deleted successfully');
    
    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

deletePayment();
