const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  interview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview',
    required: true
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'inr'
  },
  upiId: {
    type: String
  },
  qrCodeUrl: {
    type: String
  },
  transactionId: {
    type: String
  },
  transactionScreenshot: {
    type: String
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'other'],
    default: 'upi'
  },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'verified', 'rejected', 'refunded'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  metadata: {
    type: Object
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', PaymentSchema);
