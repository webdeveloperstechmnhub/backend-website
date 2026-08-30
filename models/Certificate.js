const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  empId: {
    type: String,
    index: true,
    trim: true,
    default: "",
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    default: "",
  },
  role: {
    type: String,
    required: true,
    trim: true,
  },
  startDate: {
    type: String,
    default: "",
  },
  endDate: {
    type: String,
    default: "",
  },
  issueDate: {
    type: String,
    required: true,
    default: "",
  },
  verificationUrl: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["valid", "revoked"],
    default: "valid",
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  issuedBy: {
    type: String,
    default: "Admin",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

certificateSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  if (typeof next === "function") next();
});

module.exports = mongoose.model("Certificate", certificateSchema);
