/**
 * Script to safely delete data from specific collections while preserving indexes
 * Run with: node scripts/cleanCollections.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const Interview = require('../models/Interview');
const InterviewSlot = require('../models/InterviewSlot');
const Feedback = require('../models/Feedback');
const Payment = require('../models/Payment');

// Collections to clean
const collectionsToClean = [
  { name: 'interviews', model: Interview },
  { name: 'interviewslots', model: InterviewSlot },
  { name: 'feedbacks', model: Feedback },
  { name: 'payments', model: Payment }
];

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    cleanCollections();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function cleanCollections() {
  try {
    for (const collection of collectionsToClean) {
      // Count documents before deletion
      const countBefore = await collection.model.countDocuments();
      
      // Delete all documents
      const result = await collection.model.deleteMany({});
      
      console.log(`Cleaned ${collection.name}: ${result.deletedCount}/${countBefore} documents deleted`);
    }
    
    console.log('All collections cleaned successfully');
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning collections:', error);
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    process.exit(1);
  }
}
