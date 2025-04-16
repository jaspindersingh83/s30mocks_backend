const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    deleteUser();
  })
  .catch(err => {
    console.error('Could not connect to MongoDB:', err);
    process.exit(1);
  });

const deleteUser = async () => {
  try {
    // Get the User model
    const User = require('../models/User');
    
    // Email of the user to delete
    const email = 'shubhamgupta202017@gmail.com';
    
    // Find the user first to confirm they exist
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`User with email ${email} not found in the database.`);
      process.exit(0);
    }
    
    // Delete the user
    const result = await User.deleteOne({ email });
    
    if (result.deletedCount === 1) {
      console.log(`Successfully deleted user with email: ${email}`);
      console.log('User details:');
      console.log('- Name:', user.name);
      console.log('- Email:', user.email);
      console.log('- Role:', user.role);
      console.log('- Email verified:', user.isEmailVerified);
    } else {
      console.log(`Failed to delete user with email: ${email}`);
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('Error deleting user:', err);
    process.exit(1);
  }
};
