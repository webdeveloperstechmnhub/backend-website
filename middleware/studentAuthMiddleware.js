const { extractBearerToken, verifySessionJwt } = require("../utils/auth/jwtSession");
const { validateSessionFromClaims } = require("../services/sessionOwnershipService");
const { getRequestMetadata } = require("../utils/auth/requestMetadata");
const { logAuthEvent } = require("../services/authAuditService");
const TelemetryFilter = require("../models/TelemetryFilter");

module.exports = async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  let decoded;
  try {
    decoded = verifySessionJwt(token);
  } catch (_err) {
    const meta = getRequestMetadata(req);
    await logAuthEvent({
      actorUserId: "unknown",
      actorRole: "system",
      action: "auth_failed",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { reason: "jwt_verify_failed", scope: "student" },
    });
    return res.status(401).json({ msg: "Token is not valid" });
  }

  if (decoded.role !== "student") {
    return res.status(403).json({ msg: "Access denied. Student only." });
  }

  // Secret Traffic Ban Enforcement Check
  const meta = getRequestMetadata(req);
  const clientIp = meta.ipAddress || req.ip || "";
  const isBanned = await TelemetryFilter.findOne({
    active: true,
    $or: [
      { filterKey: clientIp, filterType: "ip" },
      { filterKey: String(decoded.email || "").trim().toLowerCase(), filterType: "email" },
      { filterKey: String(decoded.id || "").trim(), filterType: "user" }
    ]
  });

  if (isBanned) {
    const sessionId = decoded.session_id || decoded.sessionId;
    if (sessionId) {
      const { revokeSessionById } = require("../services/sessionOwnershipService");
      await revokeSessionById(sessionId, {
        reason: `restricted_by_security_filter: ${isBanned.logNote || 'blocked'}`,
        actorUserId: "system",
        actorRole: "system",
        ipAddress: clientIp,
        userAgent: meta.userAgent
      });
    }
    return res.status(403).json({ msg: "Access restriction active. Connection halted." });
  }

  const tokenUserId = decoded.id;
  const validation = await validateSessionFromClaims({
    sessionId: decoded.session_id || decoded.sessionId,
    jti: decoded.jti,
    role: "student",
    userId: tokenUserId,
  });

  if (!validation.valid) {
    const meta = getRequestMetadata(req);
    await logAuthEvent({
      actorUserId: String(tokenUserId || "unknown"),
      actorRole: "student",
      action: "auth_failed",
      targetSessionId: String(decoded.session_id || decoded.sessionId || ""),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        reason: validation.reason,
        revokeReason: validation.revokeReason || "",
        scope: "student",
      },
    });

    const message = validation.revokeReason
      ? `Session revoked: ${validation.revokeReason}`
      : "Session is not valid";
    return res.status(401).json({ msg: message });
  }

  req.studentUser = decoded;
  req.authSession = validation.session;
  return next();
};