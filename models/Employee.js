const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  empId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  designation: { type: String, default: "" },
  department: { type: String, default: "" },
  description: { type: String, default: "" },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

employeeSchema.pre("save", function preSave(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Employee", employeeSchema);
