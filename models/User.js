const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  college: String,
  courseYear: String,
  city: String,

  category: String,
  subCategory: [String],  // 👈 Array banaya

  portfolio: String,
  github: String,
  instagram: String,

  referralCode: String,

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

  paymentMode: String,     // Cash, UPI, Card, Complimentary, etc.

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  },

  amountPaid: Number,
  passName: String,        // 👈 Pass name bhi save karo
  passType: {
    type: String,
    default: "pro",
  },
  ticketQuantity: { type: Number, default: 1 },

  checkedIn: { type: Boolean, default: false },
  checkInTime: Date,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);