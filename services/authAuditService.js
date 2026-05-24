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
    await AuthAuditLog.create({
      actorUserId: String(actorUserId),
      actorRole,
      action,
      targetSessionId,
      ipAddress,
      userAgent,
      metadata,
    });
  } catch (err) {
    console.error("Auth audit logging failed:", err.message || err);
  }
};

module.exports = {
  logAuthEvent,
};
