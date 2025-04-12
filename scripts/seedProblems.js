const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Problem = require('../models/Problem');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Could not connect to MongoDB:', err);
    process.exit(1);
  });

// Sample problems data
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
  {
    title: "Valid Parentheses",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.\n\nExample:\nInput: s = \"()[]{}\"\nOutput: true",
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
    title: "Merge Two Sorted Lists",
    description: "You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.\n\nReturn the head of the merged linked list.\n\nExample:\nInput: list1 = [1,2,4], list2 = [1,3,4]\nOutput: [1,1,2,3,4,4]",
    difficulty: "easy",
    category: "linked-lists",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/merge-sorted-lists.md",
    videoUrl: "https://www.youtube.com/watch?v=XIdigk956u0",
    hints: [
      "Create a dummy node to start your result list",
      "Compare the values of the two lists and append the smaller one to your result"
    ]
  },
  {
    title: "Maximum Subarray",
    description: "Given an integer array nums, find the subarray with the largest sum, and return its sum.\n\nExample:\nInput: nums = [-2,1,-3,4,-1,2,1,-5,4]\nOutput: 6\nExplanation: The subarray [4,-1,2,1] has the largest sum 6.",
    difficulty: "medium",
    category: "arrays",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/maximum-subarray.md",
    videoUrl: "https://www.youtube.com/watch?v=5WZl3MMT0Eg",
    hints: [
      "Consider using Kadane's algorithm",
      "Keep track of the current sum and the maximum sum seen so far"
    ]
  },
  {
    title: "3Sum",
    description: "Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.\n\nNotice that the solution set must not contain duplicate triplets.\n\nExample:\nInput: nums = [-1,0,1,2,-1,-4]\nOutput: [[-1,-1,2],[-1,0,1]]",
    difficulty: "medium",
    category: "arrays",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/3sum.md",
    videoUrl: "https://www.youtube.com/watch?v=jzZsG8n2R9A",
    hints: [
      "Sort the array first",
      "Fix one number and use two pointers technique to find the other two"
    ]
  },
  {
    title: "Binary Tree Level Order Traversal",
    description: "Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).\n\nExample:\nInput: root = [3,9,20,null,null,15,7]\nOutput: [[3],[9,20],[15,7]]",
    difficulty: "medium",
    category: "trees",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/level-order-traversal.md",
    videoUrl: "https://www.youtube.com/watch?v=6ZnyEApgFYg",
    hints: [
      "Use a queue for BFS traversal",
      "Keep track of the number of nodes at each level"
    ]
  },
  {
    title: "Trapping Rain Water",
    description: "Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.\n\nExample:\nInput: height = [0,1,0,2,1,0,1,3,2,1,2,1]\nOutput: 6\nExplanation: The elevation map is represented by array [0,1,0,2,1,0,1,3,2,1,2,1]. In this case, 6 units of rain water are being trapped.",
    difficulty: "hard",
    category: "arrays",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/trapping-rain-water.md",
    videoUrl: "https://www.youtube.com/watch?v=ZI2z5pq0TqA",
    hints: [
      "For each position, water trapped = min(maxLeft, maxRight) - height[i]",
      "Consider using two pointers approach"
    ]
  },
  {
    title: "Word Search",
    description: "Given an m x n grid of characters board and a string word, return true if word exists in the grid.\n\nThe word can be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once.\n\nExample:\nInput: board = [['A','B','C','E'],['S','F','C','S'],['A','D','E','E']], word = 'ABCCED'\nOutput: true",
    difficulty: "medium",
    category: "graphs",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/word-search.md",
    videoUrl: "https://www.youtube.com/watch?v=pfiQ_PS1g8E",
    hints: [
      "Use backtracking with DFS",
      "Mark visited cells to avoid using them again in the same path"
    ]
  },
  {
    title: "Merge Intervals",
    description: "Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.\n\nExample:\nInput: intervals = [[1,3],[2,6],[8,10],[15,18]]\nOutput: [[1,6],[8,10],[15,18]]\nExplanation: Since intervals [1,3] and [2,6] overlap, merge them into [1,6].",
    difficulty: "medium",
    category: "sorting",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/merge-intervals.md",
    videoUrl: "https://www.youtube.com/watch?v=44H3cEC2fFM",
    hints: [
      "Sort the intervals by their start time",
      "Iterate through the sorted intervals and merge when there's an overlap"
    ]
  },
  {
    title: "LRU Cache",
    description: "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the LRUCache class:\n- LRUCache(int capacity) Initialize the LRU cache with positive size capacity.\n- int get(int key) Return the value of the key if the key exists, otherwise return -1.\n- void put(int key, int value) Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity from this operation, evict the least recently used key.\n\nThe functions get and put must each run in O(1) average time complexity.",
    difficulty: "hard",
    category: "other",
    solutionUrl: "https://github.com/username/coding-problems/blob/main/solutions/lru-cache.md",
    videoUrl: "https://www.youtube.com/watch?v=7ABFKPK2hD4",
    hints: [
      "Use a combination of a hash map and a doubly linked list",
      "The hash map gives O(1) access, while the linked list helps with tracking usage order"
    ]
  }
];

// Seed the database
const seedDatabase = async () => {
  try {
    // Clear existing problems
    await Problem.deleteMany({});
    console.log('Cleared existing problems');
    
    // Insert new problems
    await Problem.insertMany(problemsData);
    console.log(`Successfully seeded ${problemsData.length} problems`);
    
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
