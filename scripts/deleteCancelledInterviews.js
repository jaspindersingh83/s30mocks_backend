const mongoose = require('mongoose');
const Interview = require('../models/Interview');
const Payment = require('../models/Payment');
require('dotenv').config();

async function deleteCancelledInterviews() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('MongoDB Connected...');
    
    // Find all cancelled interviews
    const cancelledInterviews = await Interview.find({ status: 'cancelled' });
    
    console.log(`Found ${cancelledInterviews.length} cancelled interviews`);
    
    if (cancelledInterviews.length === 0) {
      console.log('No cancelled interviews to delete.');
      process.exit(0);
    }
    
    // Ask for confirmation
    console.log('Are you sure you want to delete all cancelled interviews? (y/n)');
    process.stdin.once('data', async (data) => {
      const answer = data.toString().trim().toLowerCase();
      
      if (answer === 'y' || answer === 'yes') {
        let deletedCount = 0;
        let errorCount = 0;
        
        // Delete each cancelled interview and its associated payment
        for (const interview of cancelledInterviews) {
          try {
            // Check if there's an associated payment
            if (interview.paymentId) {
              // Find and delete the payment
              await Payment.findOneAndDelete({ _id: interview.paymentId });
              console.log(`Deleted associated payment for interview ${interview._id}`);
            }
            
            // Delete the interview
            await Interview.findByIdAndDelete(interview._id);
            console.log(`Deleted cancelled interview ${interview._id}`);
            deletedCount++;
          } catch (err) {
            console.error(`Error deleting interview ${interview._id}:`, err.message);
            errorCount++;
          }
        }
        
        console.log(`Successfully deleted ${deletedCount} cancelled interviews.`);
        if (errorCount > 0) {
          console.log(`Failed to delete ${errorCount} interviews due to errors.`);
        }
      } else {
        console.log('Operation cancelled.');
      }
      
      // Disconnect from MongoDB
      await mongoose.disconnect();
      console.log('MongoDB Disconnected');
      process.exit(0);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

// Run the function
deleteCancelledInterviews();
