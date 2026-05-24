const {
  getActiveSessions,
  getSessionById,
  revokeSessionById,
  revokeAllSessionsForUser,
} = require("../services/sessionOwnershipService");
const { getRequestMetadata } = require("../utils/auth/requestMetadata");
const SessionRecord = require("../models/SessionRecord");

const mapSessionResponse = (session) => ({
  session_id: session.sessionId,
  user_id: session.userId,
  role: session.role,
  operator_name: session.metadata?.operatorName || "",
  jti: session.jti,
  device_hash: session.deviceHash,
  device_label: session.deviceLabel,
  ip_address: session.ipAddress,
  user_agent: session.userAgent,
  created_at: session.createdAt,
  last_seen: session.lastSeen,
  expires_at: session.expiresAt,
  revoked: session.revoked,
  revoke_reason: session.revokeReason,
  revoked_at: session.revokedAt,
  metadata: session.metadata || {},
});

const buildDashboardSessionResponse = (session) => ({
  id: session.sessionId,
  sessionId: session.sessionId,
  userId: session.userId,
  role: session.role,
  operatorName: session.metadata?.operatorName || "",
  jti: session.jti,
  deviceHash: session.deviceHash,
  deviceLabel: session.deviceLabel,
  ipAddress: session.ipAddress,
  userAgent: session.userAgent,
  createdAt: session.createdAt,
  lastSeen: session.lastSeen,
  expiresAt: session.expiresAt,
  revoked: session.revoked,
  revokeReason: session.revokeReason,
  revokedAt: session.revokedAt,
  metadata: session.metadata || {},
});

exports.getActiveSessions = async (req, res) => {
  try {
    const role = String(req.query.role || "").trim();
    const userId = String(req.query.userId || "").trim();

    const sessions = await getActiveSessions({ role, userId });

    res.json({
      sessions: sessions.map(mapSessionResponse),
      total: sessions.length,
    });
  } catch (err) {
    console.error("getActiveSessions error:", err);
    res.status(500).json({ msg: "Failed to load active sessions." });
  }
};

exports.getLiveSessionsDashboard = async (_req, res) => {
  try {
    const sessions = await getActiveSessions({});
    res.json({ ok: true, sessions: sessions.map(buildDashboardSessionResponse) });
  } catch (err) {
    console.error("getLiveSessionsDashboard error:", err);
    res.status(500).json({ ok: false, msg: "Server error." });
  }
};

exports.getHistorySessionsDashboard = async (_req, res) => {
  try {
    const sessions = await SessionRecord.find({
      $or: [{ revoked: true }, { expiresAt: { $lte: new Date() } }],
    })
      .sort({ lastSeen: -1 })
      .limit(60);

    res.json({ ok: true, sessions: sessions.map(buildDashboardSessionResponse) });
  } catch (err) {
    console.error("getHistorySessionsDashboard error:", err);
    res.status(500).json({ ok: false, msg: "Server error." });
  }
};

exports.revokeDashboardSession = async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || "").trim();
    const reason = String(req.body?.reason || "revoked_by_admin").trim();

    if (!sessionId) {
      return res.status(400).json({ ok: false, msg: "sessionId is required." });
    }

    const session = await revokeSessionById(sessionId, {
      reason: reason || "revoked_by_admin",
      actorUserId: req.admin?.email || "admin",
      actorRole: "admin",
    });

    if (!session) {
      return res.status(404).json({ ok: false, msg: "Session not found." });
    }

    res.json({ ok: true, msg: "Session revoked successfully.", session: buildDashboardSessionResponse(session) });
  } catch (err) {
    console.error("revokeDashboardSession error:", err);
    res.status(500).json({ ok: false, msg: "Failed to revoke session." });
  }
};

exports.revokeAllDashboardSessions = async (_req, res) => {
  try {
    const sessions = await getActiveSessions({});
    let revokedCount = 0;

    for (const session of sessions) {
      const revoked = await revokeSessionById(session.sessionId, {
        reason: "Global administrator reset",
        actorUserId: "admin",
        actorRole: "admin",
      });

      if (revoked) {
        revokedCount += 1;
      }
    }

    res.json({
      ok: true,
      msg: `Successfully terminated and blacklisted ${revokedCount} active sessions.`,
      revokedCount,
    });
  } catch (err) {
    console.error("revokeAllDashboardSessions error:", err);
    res.status(500).json({ ok: false, msg: "Failed to revoke all sessions." });
  }
};

exports.getSessionById = async (req, res) => {
  try {
    const sessionId = String(req.params.id || "").trim();
    if (!sessionId) {
      return res.status(400).json({ msg: "Session id is required." });
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ msg: "Session not found." });
    }

    res.json({ session: mapSessionResponse(session) });
  } catch (err) {
    console.error("getSessionById error:", err);
    res.status(500).json({ msg: "Failed to load session details." });
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const sessionId = String(req.params.id || "").trim();
    const revokeReason = String(req.body?.reason || "revoked_by_admin").trim();

    if (!sessionId) {
      return res.status(400).json({ msg: "Session id is required." });
    }

    const metadata = getRequestMetadata(req);
    const revokedSession = await revokeSessionById(sessionId, {
      reason: revokeReason || "revoked_by_admin",
      actorUserId: req.admin?.email || "admin",
      actorRole: "admin",
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    if (!revokedSession) {
      return res.status(404).json({ msg: "Session not found." });
    }

    // Placeholder for future websocket/DO disconnect integration.
    const websocketDispatch = {
      queued: false,
      channel: "session.revoke",
      session_id: revokedSession.sessionId,
    };

    res.json({
      msg: "Session revoked successfully.",
      session: mapSessionResponse(revokedSession),
      websocket: websocketDispatch,
    });
  } catch (err) {
    console.error("revokeSession error:", err);
    res.status(500).json({ msg: "Failed to revoke session." });
  }
};

exports.revokeAllSessions = async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const revokeReason = String(req.body?.reason || "revoked_all_by_admin").trim();

    if (!userId) {
      return res.status(400).json({ msg: "User id is required." });
    }

    const metadata = getRequestMetadata(req);
    const revokedCount = await revokeAllSessionsForUser(userId, {
      reason: revokeReason || "revoked_all_by_admin",
      actorUserId: req.admin?.email || "admin",
      actorRole: "admin",
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    res.json({
      msg: "All active sessions revoked.",
      user_id: userId,
      revoked_count: revokedCount,
    });
  } catch (err) {
    console.error("revokeAllSessions error:", err);
    res.status(500).json({ msg: "Failed to revoke user sessions." });
  }
};
