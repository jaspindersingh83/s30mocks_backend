const Rating = require("../models/Rating");
const Interview = require("../models/Interview");
const User = require("../models/User");
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const { sendRatingNotification } = require("../utils/email");

// Create a new rating
exports.createRating = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { interviewId, rating, feedback } = req.body;

    // Verify the interview exists and is completed
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Verify the user is the candidate of this interview
    if (interview.candidate.toString() !== req.user.id) {
      return res.status(403).json({
        message:
          "You can only rate interviews you participated in as a candidate",
      });
    }

    // Verify the interview is completed
    if (interview.status !== "completed") {
      return res
        .status(400)
        .json({ message: "You can only rate completed interviews" });
    }

    // Check if the candidate has already rated this interview
    const existingRating = await Rating.findOne({
      interview: interviewId,
      candidate: req.user.id,
    });

    if (existingRating) {
      return res
        .status(400)
        .json({ message: "You have already rated this interview" });
    }

    // Create the rating
    const newRating = new Rating({
      interviewer: interview.interviewer,
      candidate: req.user.id,
      interview: interviewId,
      rating,
      feedback: feedback || "",
    });

    await newRating.save();

    // Update interviewer's average rating
    await updateInterviewerAverageRating(interview.interviewer);

    // Get candidate and interviewer details
    const candidate = await User.findById(req.user.id);
    const interviewer = await User.findById(interview.interviewer);
    
    // Get admin email from environment variables
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

    // Send email notification
    await sendRatingNotification(
      newRating,
      interview,
      candidate,
      interviewer,
      adminEmail
    );

    res.status(201).json(newRating);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Get all ratings (for admin)
exports.getAllRatings = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to view all ratings" });
    }

    // Get all ratings with populated fields
    const ratings = await Rating.find()
      .populate("candidate", "name email")
      .populate("interviewer", "name email")
      .populate("interview", "scheduledDate interviewType")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Get ratings for an interviewer
exports.getInterviewerRatings = async (req, res) => {
  try {
    const interviewerId = req.params.interviewerId;

    // Verify the interviewer exists
    const interviewer = await User.findOne({
      _id: interviewerId,
      role: "interviewer",
    });
    if (!interviewer) {
      return res.status(404).json({ message: "Interviewer not found" });
    }

    const ratings = await Rating.find({ interviewer: interviewerId })
      .populate("candidate", "name")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Get average rating for an interviewer
exports.getInterviewerAverageRating = async (req, res) => {
  try {
    const interviewerId = req.params.interviewerId;

    // Verify the interviewer exists
    const interviewer = await User.findOne({
      _id: interviewerId,
      role: "interviewer",
    });
    if (!interviewer) {
      return res.status(404).json({ message: "Interviewer not found" });
    }

    const result = await Rating.aggregate([
      { $match: { interviewer: mongoose.Types.ObjectId(interviewerId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return res.json({ averageRating: 0, count: 0 });
    }

    res.json({
      averageRating: parseFloat(result[0].averageRating.toFixed(1)),
      count: result[0].count,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Helper function to update interviewer's average rating
const updateInterviewerAverageRating = async (interviewerId) => {
  try {
    const result = await Rating.aggregate([
      { $match: { interviewer: interviewerId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (result.length > 0) {
      const averageRating = parseFloat(result[0].averageRating.toFixed(1));
      const ratingsCount = result[0].count;

      await User.findByIdAndUpdate(interviewerId, {
        averageRating,
        ratingsCount,
      });
    }
  } catch (err) {
    console.error("Error updating interviewer average rating:", err);
  }
};
