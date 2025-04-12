const InterviewPrice = require('../models/InterviewPrice');
const { validationResult } = require('express-validator');

// Get all interview prices
exports.getAllPrices = async (req, res) => {
  try {
    const prices = await InterviewPrice.find().sort({ interviewType: 1 });
    res.json(prices);
  } catch (err) {
    console.error('Error fetching prices:', err);
    res.status(500).send('Server error');
  }
};

// Get price by interview type
exports.getPriceByType = async (req, res) => {
  try {
    const { interviewType } = req.params;
    
    if (!['DSA', 'System Design'].includes(interviewType)) {
      return res.status(400).json({ message: 'Invalid interview type' });
    }
    
    const price = await InterviewPrice.findOne({ interviewType });
    
    if (!price) {
      return res.status(404).json({ message: `Price for ${interviewType} interviews not found` });
    }
    
    res.json(price);
  } catch (err) {
    console.error('Error fetching price:', err);
    res.status(500).send('Server error');
  }
};

// Update or create price for an interview type (admin only)
exports.updatePrice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { interviewType, price, currency } = req.body;
    
    if (!['DSA', 'System Design'].includes(interviewType)) {
      return res.status(400).json({ message: 'Invalid interview type' });
    }
    
    // Find existing price or create new one
    let priceRecord = await InterviewPrice.findOne({ interviewType });
    
    if (priceRecord) {
      // Update existing price
      priceRecord.price = price;
      if (currency) priceRecord.currency = currency;
      priceRecord.updatedBy = req.user.id;
      priceRecord.updatedAt = Date.now();
    } else {
      // Create new price record
      priceRecord = new InterviewPrice({
        interviewType,
        price,
        currency: currency || 'INR',
        updatedBy: req.user.id
      });
    }
    
    await priceRecord.save();
    
    res.json({
      message: `Price for ${interviewType} interviews updated successfully`,
      price: priceRecord
    });
  } catch (err) {
    console.error('Error updating price:', err);
    res.status(500).send('Server error');
  }
};

// Initialize default prices if they don't exist
exports.initializePrices = async () => {
  try {
    const dsaPrice = await InterviewPrice.findOne({ interviewType: 'DSA' });
    const systemDesignPrice = await InterviewPrice.findOne({ interviewType: 'System Design' });
    
    if (!dsaPrice) {
      await new InterviewPrice({
        interviewType: 'DSA',
        price: 1000, // Default price in INR
        currency: 'INR'
      }).save();
      console.log('Default DSA interview price initialized');
    }
    
    if (!systemDesignPrice) {
      await new InterviewPrice({
        interviewType: 'System Design',
        price: 1500, // Default price in INR
        currency: 'INR'
      }).save();
      console.log('Default System Design interview price initialized');
    }
  } catch (err) {
    console.error('Error initializing prices:', err);
  }
};
