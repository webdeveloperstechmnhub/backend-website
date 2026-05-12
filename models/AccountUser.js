const mongoose = require("mongoose");

const accountUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["institute"], default: "institute" },
    verified: { type: Boolean, default: true },
    createdByAdminEmail: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AccountUser", accountUserSchema);
