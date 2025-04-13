const mongoose = require("mongoose");

const InterviewSlotSchema = new mongoose.Schema({
  interviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  interviewType: {
    type: String,
    enum: ["DSA", "System Design"],
    required: true,
  },
  isBooked: {
    type: Boolean,
    default: false,
  },
  interview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Interview",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Validate slot duration based on interview type
InterviewSlotSchema.pre("save", function (next) {
  const duration = (this.endTime - this.startTime) / (1000 * 60); // duration in minutes

  if (this.interviewType === "DSA") {
    // DSA interviews should be 40 minutes
    if (Math.abs(duration - 40) > 1) {
      // Allow 1 minute tolerance
      const error = new Error("DSA interview slots must be 40 minutes");
      return next(error);
    }
  } else if (this.interviewType === "System Design") {
    // System Design interviews should be 50 minutes
    if (Math.abs(duration - 50) > 1) {
      // Allow 1 minute tolerance
      const error = new Error(
        "System Design interview slots must be 50 minutes"
      );
      return next(error);
    }
  }

  next();
});

module.exports = mongoose.model("InterviewSlot", InterviewSlotSchema);
