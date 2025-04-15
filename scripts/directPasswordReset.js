const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// MongoDB connection
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/s30interviews',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Direct update without using the User model's pre-save hooks
const directPasswordReset = async () => {
  try {
    const email = 'jaspinder@thes30.com';
    const newPassword = 'Jaspinder$123';
    
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update user's password directly in the database
    const result = await mongoose.connection.collection('users').updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );
    
    if (result.matchedCount === 0) {
      console.log('User not found');
      process.exit(1);
    }
    
    console.log(`Password reset successfully for ${email}`);
    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    
    // Verify the password can be compared correctly
    const user = await mongoose.connection.collection('users').findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(newPassword, user.password);
      console.log('Password verification check:', isMatch ? 'SUCCESS' : 'FAILED');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
};

// Run the script
directPasswordReset();
