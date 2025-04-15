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

const User = require('../models/User');

const resetPassword = async () => {
  try {
    const email = 'jaspinder@thes30.com';
    const newPassword = 'Jaspinder$123';
    
    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update user's password
    user.password = hashedPassword;
    await user.save();
    
    console.log(`Password reset successfully for ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
};

// Run the script
resetPassword();
