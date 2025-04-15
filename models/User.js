const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId; // Password is required only if not using Google Auth
    },
  },
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["candidate", "interviewer", "admin"],
    default: "candidate",
  },
  googleId: {
    type: String,
  },
  picture: {
    type: String,
  },
  upiId: {
    type: String,
  },
  qrCodeUrl: {
    type: String,
  },
  phone: {
    type: String,
  },
  linkedInUrl: {
    type: String,
  },
  emailNotifications: {
    type: Boolean,
    default: true,
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  ratingsCount: {
    type: Number,
    default: 0,
  },
  defaultMeetingLink: {
    type: String,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  workExperiences: [
    {
      company: String,
      position: String,
      startDate: Date,
      endDate: Date,
      current: Boolean,
      description: String,
    },
  ],
  education: [
    {
      school: String,
      degree: String,
      fieldOfStudy: String,
      startYear: String,
      endYear: String,
      current: Boolean,
      description: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre("save", async function (next) {
  // Skip hashing if password is not modified or if using Google Auth
  if (!this.isModified("password") || this.googleId) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  // If using Google Auth and no password is set, deny password login
  if (this.googleId && !this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
