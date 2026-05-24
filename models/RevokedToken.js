const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["admin", "institute", "student"],
      required: true,
      index: true,
    },
    reason: { type: String, default: "revoked" },
    revokedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    versionKey: false,
  },
);

module.exports = mongoose.model("RevokedToken", revokedTokenSchema);
