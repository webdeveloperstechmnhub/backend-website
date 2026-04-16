const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  empId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
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

employeeSchema.pre("save", function preSave(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Employee", employeeSchema);
