const AuthAuditLog = require("../models/AuthAuditLog");

const logAuthEvent = async ({
  actorUserId,
  actorRole = "system",
  action,
  targetSessionId = "",
  ipAddress = "",
  userAgent = "",
  metadata = {},
}) => {
  if (!actorUserId || !action) return;

  try {
    // include more context with employee-friendly fields
    const payload = {
      actorUserId: String(actorUserId),
      actorRole,
      action,
      targetSessionId,
      ipAddress,
      userAgent,
      metadata,
    };

    await AuthAuditLog.create(payload);
  } catch (err) {
    console.error("Auth audit logging failed:", err.message || err);
  }
};

module.exports = {
  logAuthEvent,
};
