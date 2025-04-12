const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  interview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview',
    required: true
  },
  interviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  codingAndDebugging: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  communicationScore: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  problemSolvingScore: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  strengths: {
    type: String,
    required: true
  },
  areasOfImprovement: {
    type: String,
    required: true
  },
  additionalComments: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Feedback', FeedbackSchema);
