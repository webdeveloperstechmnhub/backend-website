const mongoose = require("mongoose");

const telemetryFilterSchema = new mongoose.Schema(
  {
    filterKey: { type: String, required: true, index: true }, // The email, IP address, or user ID restricted
    filterType: { type: String, enum: ["ip", "email", "user"], required: true, index: true },
    logNote: { type: String, default: "auto_logged" },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TelemetryFilter", telemetryFilterSchema);
