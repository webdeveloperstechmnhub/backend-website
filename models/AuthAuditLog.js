const mongoose = require("mongoose");

const authAuditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: String, required: true, index: true },
    actorRole: {
      type: String,
      enum: ["admin", "institute", "student", "employee", "system", "super_admin"],
      default: "system",
      index: true,
    },
    action: {
      type: String,
      enum: [
        "login_success",
        "login_failed",
        "logout",
        "session_revoked",
        "session_revoked_all",
        "session_created",
        "auth_failed",
        "suspicious_session",
        "multi_device_login",
        "third_session_attempt",
        "failed_login",
        "password_change",
        "password_creation",
        "profile_update",
        "employee_account_provisioning",
        "employee_account_unlock",
        "account_locked",
        "account_disabled",
      ],
      required: true,
      index: true,
    },
    targetSessionId: { type: String, default: "", index: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    versionKey: false,
  },
);

authAuditLogSchema.index({ action: 1, createdAt: -1 });
authAuditLogSchema.index({ actorUserId: 1, createdAt: -1 });

module.exports = mongoose.model("AuthAuditLog", authAuditLogSchema);
