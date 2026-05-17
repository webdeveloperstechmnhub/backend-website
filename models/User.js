const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  college: String,
  courseYear: String,
  city: String,

  ticketDescription: String,  // Custom description for the ticket
  subCategory: [String],  // 👈 Array banaya

  portfolio: String,
  github: String,
  instagram: String,

  referralCode: String,
  referralCodeApplied: { type: Boolean, default: false },
  referralDiscountAmount: { type: Number, default: 0 },
  originalAmountPaid: { type: Number, default: 0 },

  // Event mapping for admin event-wise entries
  eventId: String,
  eventShortName: { type: String, default: "Zonex 2026" },

  // Team Members for Hackathon
  teamMembers: [String],   // 👈 Team members ke liye naya field
  teamLeader: String,      // 👈 Team leader ka naam

  registrationId: String,
  qrCode: String,

  orderId: String,
  paymentId: String,
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

  paymentMode: String,     // Cash, UPI, Card, Complimentary, etc.

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending"
  },
  registrationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected", "waitlisted"],
    default: "pending"
  },
  parentName: String,
  school: String,
  className: String,
  age: Number,
  amountPaid: Number,
  passName: String,        // 👈 Pass name bhi save karo
  passType: {
    type: String,
    default: "pro",
  },
  ticketQuantity: { type: Number, default: 1 },

  checkedIn: { type: Boolean, default: false },
  checkInTime: Date,
  attendanceMarkedBy: String,
  approvedAt: Date,
  rejectedAt: Date,
  qrPlaceholder: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);
