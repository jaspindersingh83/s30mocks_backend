const Problem = require('../models/Problem');
const Interview = require('../models/Interview');
const { validationResult } = require('express-validator');

// Create a new problem
exports.createProblem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      title, 
      leetcodeUrl, 
      solutions, 
      hints 
    } = req.body;
    
    // Validate solutions
    if (!solutions || solutions.length === 0) {
      return res.status(400).json({ 
        errors: [{ msg: 'At least one solution is required' }] 
      });
    }

    // Validate each solution
    for (const solution of solutions) {
      if (!solution.language || !solution.code || !solution.description || 
          !solution.timeComplexity || !solution.spaceComplexity) {
        return res.status(400).json({ 
          errors: [{ msg: 'Each solution must include language, code, description, timeComplexity, and spaceComplexity' }] 
        });
      }
    }
    
    // Create new problem
    const problem = new Problem({
      title,
      leetcodeUrl,
      solutions,
      hints: hints || []
    });

    await problem.save();
    
    res.status(201).json(problem);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all problems
exports.getAllProblems = async (req, res) => {
  try {
    const problems = await Problem.find().sort({ createdAt: -1 });
    res.json(problems);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get problem by ID
exports.getProblemById = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);
    
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    
    res.json(problem);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Problem not found' });
    }
    res.status(500).send('Server error');
  }
};

// Update problem
exports.updateProblem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      title, 
      leetcodeUrl, 
      solutions, 
      hints 
    } = req.body;
    
    // Validate solutions
    if (!solutions || solutions.length === 0) {
      return res.status(400).json({ 
        errors: [{ msg: 'At least one solution is required' }] 
      });
    }

    // Validate each solution
    for (const solution of solutions) {
      if (!solution.language || !solution.code || !solution.description || 
          !solution.timeComplexity || !solution.spaceComplexity) {
        return res.status(400).json({ 
          errors: [{ msg: 'Each solution must include language, code, description, timeComplexity, and spaceComplexity' }] 
        });
      }
    }
    
    // Find problem by ID
    let problem = await Problem.findById(req.params.id);
    
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    
    // Update problem fields
    problem.title = title;
    problem.leetcodeUrl = leetcodeUrl;
    problem.solutions = solutions;
    problem.hints = hints || [];
    
    await problem.save();
    
    res.json(problem);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Problem not found' });
    }
    res.status(500).send('Server error');
  }
};

// Delete problem
exports.deleteProblem = async (req, res) => {
  try {
    // Find problem by ID
    const problem = await Problem.findById(req.params.id);
    
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    
    // Check if problem is assigned to any interviews
    const assignedInterviews = await Interview.find({ problem: req.params.id });
    
    if (assignedInterviews.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete problem as it is assigned to interviews. Unassign it first.' 
      });
    }
    
    // Delete problem
    await problem.remove();
    
    res.json({ message: 'Problem deleted successfully' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Problem not found' });
    }
    res.status(500).send('Server error');
  }
};

// Get a random problem
exports.getRandomProblem = async (req, res) => {
  try {
    const { difficulty, category } = req.query;
    
    // Build filter object
    const filter = {};
    if (difficulty) filter.difficulty = difficulty;
    if (category) filter.category = category;
    
    // Count total matching problems
    const count = await Problem.countDocuments(filter);
    
    if (count === 0) {
      return res.status(404).json({ message: 'No problems found with the given criteria' });
    }
    
    // Get a random problem
    const random = Math.floor(Math.random() * count);
    const problem = await Problem.findOne(filter).skip(random);
    
    res.json(problem);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Assign a random problem to an interview
exports.assignRandomProblem = async (req, res) => {
  try {
    const { interviewId } = req.params;
    
    // Verify interview exists
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Verify the current user is the interviewer
    if (interview.interviewer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the interviewer can assign problems' });
    }
    
    // Check if interview already has a problem
    if (interview.problem) {
      return res.status(400).json({ message: 'Interview already has a problem assigned' });
    }
    
    // Get a random problem
    const count = await Problem.countDocuments();
    if (count === 0) {
      return res.status(404).json({ message: 'No problems found in the database' });
    }
    
    const random = Math.floor(Math.random() * count);
    const problem = await Problem.findOne().skip(random);
    
    // Assign problem to interview
    interview.problem = problem._id;
    interview.status = 'in-progress';
    await interview.save();
    
    res.json({
      message: 'Problem assigned successfully',
      interview,
      problem
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update interview with recording URL
exports.updateRecordingUrl = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { recordingUrl } = req.body;
    
    if (!recordingUrl) {
      return res.status(400).json({ message: 'Recording URL is required' });
    }
    
    // Verify interview exists
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Verify the current user is the interviewer
    if (interview.interviewer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the interviewer can update recording URL' });
    }
    
    // Update recording URL
    interview.recordingUrl = recordingUrl;
    interview.status = 'completed';
    await interview.save();
    
    res.json({
      message: 'Recording URL updated successfully',
      interview
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get problem and solution for a completed interview
exports.getInterviewProblemAndSolution = async (req, res) => {
  try {
    const { interviewId } = req.params;
    
    // Verify interview exists and is completed
    const interview = await Interview.findOne({
      _id: interviewId,
      status: 'completed'
    }).populate('problem');
    
    if (!interview) {
      return res.status(404).json({ 
        message: 'Interview not found or not yet completed' 
      });
    }
    
    // Verify the current user is authorized to view this information
    if (
      interview.candidate.toString() !== req.user.id && 
      interview.interviewer.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if problem exists
    if (!interview.problem) {
      return res.status(404).json({ message: 'No problem was assigned to this interview' });
    }
    
    res.json({
      interview: {
        id: interview._id,
        scheduledDate: interview.scheduledDate,
        status: interview.status,
        recordingUrl: interview.recordingUrl
      },
      problem: interview.problem
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
