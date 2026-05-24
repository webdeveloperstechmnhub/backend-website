const mongoose = require("mongoose");

const studentSignupSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, required: true, trim: true },
    college: { type: String, required: true, trim: true },
    year: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    interests: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: String, trim: true },
    decisionNote: { type: String, trim: true },
    points: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StudentSignup", studentSignupSchema);
