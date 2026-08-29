const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  empId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  // Authentication fields for employee accounts
  passwordHash: { type: String, default: "" },
  adminAccess: {
    type: Boolean,
    default: false,
    index: true,
  },
  accountStatus: {
    type: String,
    enum: ["active", "locked", "disabled", "terminated"],
    default: "active",
    index: true,
  },
  employmentStatus: {
    type: String,
    enum: ["active", "terminated"],
    default: "active",
    index: true,
  },
  photoUrl: { type: String, default: "" },
  mobile: { type: String, default: "" },
  email: { type: String, default: "" },
  joiningDate: { type: Date, default: null },
  designation: { type: String, default: "" },
  department: { type: String, default: "" },
  description: { type: String, default: "" },
  terminationDate: { type: Date, default: null },
  terminationReason: { type: String, default: "" },
  terminationLetterSentAt: { type: Date, default: null },
  role: {
    type: String,
    default: "employee",
    index: true,
  },
  permissions: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

employeeSchema.index({ updatedAt: -1, createdAt: -1 });
employeeSchema.index({ employmentStatus: 1, updatedAt: -1 });

employeeSchema.pre("save", function preSave() {
  this.updatedAt = new Date();
});

module.exports = mongoose.model("Employee", employeeSchema);
