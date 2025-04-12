const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Authenticate with Google
exports.googleAuth = async (req, res) => {
  try {
    const { tokenId } = req.body;
    
    if (!tokenId) {
      return res.status(400).json({ message: 'Google token ID is required' });
    }
    
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const { email_verified, name, email, picture } = ticket.getPayload();
    
    // Check if email is verified
    if (!email_verified) {
      return res.status(400).json({ message: 'Google email not verified' });
    }
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        googleId: ticket.getUserId(),
        picture,
        role: 'candidate' // Default role for Google sign-ups
      });
      
      await user.save();
    } else {
      // Update existing user with Google info if not already set
      if (!user.googleId) {
        user.googleId = ticket.getUserId();
        user.picture = picture || user.picture;
        await user.save();
      }
    }
    
    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        
        // Set cookie
        res.cookie('token', token, {
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
        
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            picture: user.picture
          }
        });
      }
    );
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
