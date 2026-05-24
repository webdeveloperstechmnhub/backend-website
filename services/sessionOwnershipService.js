const SessionRecord = require("../models/SessionRecord");
const RevokedToken = require("../models/RevokedToken");
const { generateSessionIdentifiers } = require("../utils/auth/jwtSession");
const { logAuthEvent } = require("./authAuditService");

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const LAST_SEEN_TOUCH_WINDOW_MS = 30 * 1000;

const resolveSessionTtlSeconds = () => {
  const configured = Number(process.env.SESSION_TTL_SECONDS || 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_SECONDS;
};

const createSessionOwnership = async ({ userId, role, metadata = {}, providedSessionId = "", providedJti = "" }) => {
  const { sessionId, jti } = providedSessionId && providedJti
    ? { sessionId: providedSessionId, jti: providedJti }
    : generateSessionIdentifiers();

  const ttlSeconds = resolveSessionTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const record = await SessionRecord.create({
    sessionId,
    userId: String(userId),
    role,
    jti,
    deviceHash: metadata.deviceHash || "",
    deviceLabel: metadata.deviceLabel || "unknown",
    ipAddress: metadata.ipAddress || "",
    userAgent: metadata.userAgent || "",
    createdAt: new Date(),
    lastSeen: new Date(),
    expiresAt,
    metadata: {
      browser: metadata.browser || "",
      platform: metadata.platform || "",
      operatorName: metadata.operatorName || "",
    },
  });

  const distinctActiveDevices = await SessionRecord.distinct("deviceHash", {
    userId: String(userId),
    role,
    revoked: false,
    expiresAt: { $gt: new Date() },
  });

  if (distinctActiveDevices.filter(Boolean).length > 1) {
    await logAuthEvent({
      actorUserId: String(userId),
      actorRole: role,
      action: "multi_device_login",
      targetSessionId: record.sessionId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      metadata: {
        distinctDeviceCount: distinctActiveDevices.filter(Boolean).length,
      },
    });
  }

  return record;
};

const touchSession = async (session) => {
  if (!session) return;

  const lastSeenMs = new Date(session.lastSeen || 0).getTime();
  if (Date.now() - lastSeenMs < LAST_SEEN_TOUCH_WINDOW_MS) return;

  await SessionRecord.updateOne(
    { sessionId: session.sessionId },
    { $set: { lastSeen: new Date() } },
  );
};

const validateSessionFromClaims = async ({ sessionId, jti, role, userId }) => {
  if (!sessionId || !jti) {
    return { valid: false, reason: "missing_session_context" };
  }

  const session = await SessionRecord.findOne({ sessionId });
  if (!session) {
    return { valid: false, reason: "session_not_found" };
  }

  if (session.revoked) {
    return { valid: false, reason: "session_revoked", revokeReason: session.revokeReason || "revoked" };
  }

  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    await revokeSessionById(session.sessionId, {
      reason: "session_expired",
      actorUserId: session.userId,
      actorRole: "system",
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    });
    return { valid: false, reason: "session_expired" };
  }

  if (session.jti !== jti) {
    return { valid: false, reason: "jti_mismatch" };
  }

  if (role && session.role !== role) {
    return { valid: false, reason: "role_mismatch" };
  }

  if (userId && session.userId !== String(userId)) {
    return { valid: false, reason: "user_mismatch" };
  }

  const revokedToken = await RevokedToken.findOne({ jti });
  if (revokedToken) {
    return { valid: false, reason: "token_revoked", revokeReason: revokedToken.reason || "revoked" };
  }

  await touchSession(session);
  return { valid: true, session };
};

const revokeSessionById = async (
  sessionId,
  {
    reason = "revoked_by_admin",
    actorUserId = "system",
    actorRole = "system",
    ipAddress = "",
    userAgent = "",
  } = {},
) => {
  const session = await SessionRecord.findOne({ sessionId });
  if (!session) return null;

  if (!session.revoked) {
    session.revoked = true;
    session.revokeReason = reason;
    session.revokedAt = new Date();
    session.lastSeen = new Date();
    await session.save();
  }

  await RevokedToken.findOneAndUpdate(
    { jti: session.jti },
    {
      $set: {
        sessionId: session.sessionId,
        userId: session.userId,
        role: session.role,
        reason,
        revokedAt: new Date(),
        expiresAt: session.expiresAt,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  await logAuthEvent({
    actorUserId: String(actorUserId),
    actorRole,
    action: "session_revoked",
    targetSessionId: session.sessionId,
    ipAddress,
    userAgent,
    metadata: {
      reason,
      targetUserId: session.userId,
      targetRole: session.role,
    },
  });

  // Notify session-manager to force-disconnect and mark revoked (best-effort)
  try {
    const sessionManager = require('../utils/sessionManagerClient');
    sessionManager.revokeSession(session.sessionId, {
      jti: session.jti,
      reason,
      actorUserId,
      actorRole,
    });
  } catch (err) {
    console.warn('[sessionOwnershipService] session-manager revoke notify failed', err && err.message);
  }

  return session;
};

const revokeAllSessionsForUser = async (
  userId,
  {
    reason = "revoked_all_by_admin",
    actorUserId = "system",
    actorRole = "system",
    ipAddress = "",
    userAgent = "",
  } = {},
) => {
  const sessions = await SessionRecord.find({
    userId: String(userId),
    revoked: false,
    expiresAt: { $gt: new Date() },
  });

  for (const session of sessions) {
    await revokeSessionById(session.sessionId, {
      reason,
      actorUserId,
      actorRole,
      ipAddress,
      userAgent,
    });
  }

  await logAuthEvent({
    actorUserId: String(actorUserId),
    actorRole,
    action: "session_revoked_all",
    ipAddress,
    userAgent,
    metadata: {
      targetUserId: String(userId),
      revokedCount: sessions.length,
      reason,
    },
  });

  return sessions.length;
};

const getActiveSessions = async ({ role = "", userId = "" } = {}) => {
  const filter = {
    revoked: false,
    expiresAt: { $gt: new Date() },
  };

  if (role) filter.role = role;
  if (userId) filter.userId = String(userId);

  return SessionRecord.find(filter).sort({ lastSeen: -1, createdAt: -1 });
};

const getSessionById = async (sessionId) => SessionRecord.findOne({ sessionId });

module.exports = {
  createSessionOwnership,
  validateSessionFromClaims,
  revokeSessionById,
  revokeAllSessionsForUser,
  getActiveSessions,
  getSessionById,
};
