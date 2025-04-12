const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const { initializeScheduler } = require('./utils/scheduler');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const mockRoutes = require('./routes/mocks');
const paymentRoutes = require('./routes/payments');
const problemRoutes = require('./routes/problems');
const feedbackRoutes = require('./routes/feedback');
const slotRoutes = require('./routes/slots');
const adminRoutes = require('./routes/adminRoutes');
const priceRoutes = require('./routes/prices');
const interviewRoutes = require('./routes/interviews');
const ratingRoutes = require('./routes/ratings');
const dashboardRoutes = require('./routes/dashboard');

// Import controllers
const priceController = require('./controllers/priceController');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Initialize the interview reminder scheduler
    initializeScheduler();
  })
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Debugging: Wrap route registration
const originalUse = app.use;
app.use = function(path, ...handlers) {
  console.log(`Registering route: ${path}`);
  return originalUse.call(this, path, ...handlers);
};

try {
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/mocks', mockRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/problems', problemRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/slots', slotRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/prices', priceRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/ratings', ratingRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Welcome route
  app.get('/api', (req, res) => {
    res.send('Welcome to S30 Mocks API');
  });

  // Initialize default prices
  priceController.initializePrices();

  // Serve static assets in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
    });
  }
} catch (err) {
  console.error('Route registration failed:', err);
  process.exit(1);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
