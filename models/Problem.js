const mongoose = require('mongoose');

const SolutionSchema = new mongoose.Schema({
  language: {
    type: String,
    enum: ['java', 'python'],
    required: true
  },
  code: {
    type: String,
    required: true
  },
  solutionVideoUrl: {
    type: String,
    required: true
  },
  timeComplexity: {
    type: String,
    required: true
  },
  spaceComplexity: {
    type: String,
    required: true
  }
});

const ProblemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  leetcodeUrl: {
    type: String,
    required: true
  },
  solutions: [SolutionSchema],
  hints: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Problem', ProblemSchema);
