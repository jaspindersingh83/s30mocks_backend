const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  interviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem'
  },
  interviewType: {
    type: String,
    enum: ['DSA', 'System Design'],
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  meetingLink: {
    type: String
  },
  meetingPassword: {
    type: String
  },
  recordingUrl: {
    type: String
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Set duration based on interview type
InterviewSchema.pre('save', function(next) {
  if (!this.duration) {
    if (this.interviewType === 'DSA') {
      this.duration = 40;
    } else if (this.interviewType === 'System Design') {
      this.duration = 50;
    }
  }
  next();
});

module.exports = mongoose.model('Interview', InterviewSchema);
