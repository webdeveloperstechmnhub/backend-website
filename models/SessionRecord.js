const mongoose = require("mongoose");

const sessionRecordSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["admin", "institute", "student"],
      required: true,
      index: true,
    },
    jti: { type: String, required: true, unique: true, index: true },
    deviceHash: { type: String, required: true, index: true },
    deviceLabel: { type: String, default: "unknown" },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now, index: true },
    lastSeen: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revoked: { type: Boolean, default: false, index: true },
    revokeReason: { type: String, default: "" },
    revokedAt: { type: Date, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    versionKey: false,
  },
);

sessionRecordSchema.index({ userId: 1, role: 1, revoked: 1, expiresAt: 1 });
sessionRecordSchema.index({ role: 1, revoked: 1, lastSeen: -1 });

module.exports = mongoose.model("SessionRecord", sessionRecordSchema);
