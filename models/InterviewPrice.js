const mongoose = require('mongoose');

const InterviewPriceSchema = new mongoose.Schema({
  interviewType: {
    type: String,
    enum: ['DSA', 'System Design'],
    required: true,
    unique: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('InterviewPrice', InterviewPriceSchema);
