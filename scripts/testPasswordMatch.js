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
).then(async () => {
  try {
    const User = require('../models/User');
    const email = 'jaspinder@thes30.com';
    const password = 'Jaspinder$123';
    
    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    
    console.log('User details:');
    console.log('- Email:', user.email);
    console.log('- Role:', user.role);
    console.log('- Email verified:', user.isEmailVerified);
    console.log('- Has password:', !!user.password);
    console.log('- Has Google ID:', !!user.googleId);
    
    // Test password directly with bcrypt
    if (user.password) {
      const directMatch = await bcrypt.compare(password, user.password);
      console.log('Direct bcrypt password match:', directMatch);
    }
    
    // Test password with the model method
    const modelMatch = await user.comparePassword(password);
    console.log('Model comparePassword match:', modelMatch);
    
    // Check the condition in comparePassword method
    if (user.googleId && !user.password) {
      console.log('WARNING: User has Google ID but no password - this will cause comparePassword to return false');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
