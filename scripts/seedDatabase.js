const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const Problem = require('../models/Problem');
const Interview = require('../models/Interview');
const Feedback = require('../models/Feedback');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Could not connect to MongoDB:', err);
    process.exit(1);
  });

// Sample problems data - using the same data from seedProblems.js
const problemsData = [
  {
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nExample:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].",
    difficulty: "easy",
    category: "arrays",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/two-sum.md",
    videoUrl: "https://www.youtube.com/watch?v=KLlXCFG5TnA",
    hints: [
      "Try using a hash map to store numbers you've seen so far",
      "For each number, check if target - current number exists in the hash map"
    ]
  },
  // More problems from the previous list...
  {
    title: "Valid Parentheses",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    difficulty: "easy",
    category: "strings",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/valid-parentheses.md",
    videoUrl: "https://www.youtube.com/watch?v=WTzjTskDFMg",
    hints: [
      "Consider using a stack data structure",
      "Push opening brackets onto the stack and pop when you encounter closing brackets"
    ]
  },
  {
    title: "Maximum Subarray",
    description: "Given an integer array nums, find the subarray with the largest sum, and return its sum.",
    difficulty: "medium",
    category: "arrays",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/maximum-subarray.md",
    videoUrl: "https://www.youtube.com/watch?v=5WZl3MMT0Eg",
    hints: [
      "Consider using Kadane's algorithm",
      "Keep track of the current sum and the maximum sum seen so far"
    ]
  }
];

// Sample users data
const usersData = [
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin'
  },
  {
    name: 'Interviewer One',
    email: 'interviewer1@example.com',
    password: 'password123',
    role: 'interviewer'
  },
  {
    name: 'Interviewer Two',
    email: 'interviewer2@example.com',
    password: 'password123',
    role: 'interviewer'
  },
  {
    name: 'Candidate One',
    email: 'candidate1@example.com',
    password: 'password123',
    role: 'candidate'
  },
  {
    name: 'Candidate Two',
    email: 'candidate2@example.com',
    password: 'password123',
    role: 'candidate'
  }
];

// Seed the database
const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Problem.deleteMany({});
    await Interview.deleteMany({});
    await Feedback.deleteMany({});
    
    console.log('Cleared existing data');
    
    // Insert problems
    const problems = await Problem.insertMany(problemsData);
    console.log(`Successfully seeded ${problems.length} problems`);
    
    // Insert users with hashed passwords
    const users = [];
    for (const userData of usersData) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const user = new User({
        ...userData,
        password: hashedPassword
      });
      
      await user.save();
      users.push(user);
    }
    console.log(`Successfully seeded ${users.length} users`);
    
    // Create sample interviews
    const interviewers = users.filter(user => user.role === 'interviewer');
    const candidates = users.filter(user => user.role === 'candidate');
    
    // Create a few sample interviews
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const interviews = [
      // Completed interview with feedback
      {
        candidate: candidates[0]._id,
        interviewer: interviewers[0]._id,
        problem: problems[0]._id,
        scheduledDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        duration: 60,
        status: 'completed',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        recordingUrl: 'https://www.youtube.com/watch?v=KLlXCFG5TnA',
        paymentStatus: 'paid'
      },
      // Scheduled interview
      {
        candidate: candidates[0]._id,
        interviewer: interviewers[1]._id,
        scheduledDate: tomorrow,
        duration: 60,
        status: 'scheduled',
        meetingLink: 'https://meet.google.com/klm-nopq-rst',
        paymentStatus: 'paid'
      },
      // Scheduled interview for another candidate
      {
        candidate: candidates[1]._id,
        interviewer: interviewers[0]._id,
        scheduledDate: nextWeek,
        duration: 60,
        status: 'scheduled',
        meetingLink: 'https://meet.google.com/uvw-xyz-123',
        paymentStatus: 'pending'
      }
    ];
    
    const createdInterviews = [];
    for (const interviewData of interviews) {
      const interview = new Interview(interviewData);
      await interview.save();
      createdInterviews.push(interview);
    }
    console.log(`Successfully seeded ${createdInterviews.length} interviews`);
    
    // Create feedback for the completed interview
    const feedback = new Feedback({
      interview: createdInterviews[0]._id,
      interviewer: interviewers[0]._id,
      candidate: candidates[0]._id,
      codingAndDebugging: 4,
      communicationScore: 3,
      problemSolvingScore: 4,
      strengths: 'Good understanding of data structures. Clearly explains thought process.',
      areasOfImprovement: 'Could improve time complexity analysis. Consider edge cases earlier.',
      additionalComments: 'Overall a strong candidate with good potential.'
    });
    
    await feedback.save();
    console.log('Successfully seeded feedback');
    
    console.log('Database seeding completed successfully');
    
    // Disconnect from MongoDB
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

// Run the seeding function
seedDatabase();
