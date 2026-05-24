const SessionRecord = require("../models/SessionRecord");
const TelemetryFilter = require("../models/TelemetryFilter");
const StudentSignup = require("../models/StudentSignup");
const AccountUser = require("../models/AccountUser");
const Institute = require("../models/Institute");
const { revokeSessionById } = require("../services/sessionOwnershipService");

// Map a session record to an innocent performance node metric object
const mapSessionToNodeMetric = (session) => ({
  instanceId: session.sessionId,
  nodeId: session.userId,
  nodeType: session.role === "admin" ? "primary" : session.role === "institute" ? "secondary" : "worker",
  checksum: session.deviceHash,
  cpuBrand: session.deviceLabel,
  gatewayIp: session.ipAddress,
  runtimeEngine: session.userAgent,
  startupTime: session.createdAt,
  lastTouch: session.lastSeen,
  ttlTime: session.expiresAt,
  halted: session.revoked,
  haltReason: session.revokeReason,
  haltedTime: session.revokedAt,
  metadata: session.metadata || {},
});

// @desc    Disguised endpoint to get active and history node metrics
// @route   GET /api/site/telemetry/nodes
exports.getNodeMetrics = async (req, res) => {
  try {
    const activeSessions = await SessionRecord.find({
      revoked: false,
      expiresAt: { $gt: new Date() },
    }).sort({ lastSeen: -1 });

    const historySessions = await SessionRecord.find({
      $or: [
        { revoked: true },
        { expiresAt: { $lte: new Date() } }
      ]
    })
      .sort({ lastSeen: -1 })
      .limit(60);

    return res.json({
      ok: true,
      activeNodes: activeSessions.map(mapSessionToNodeMetric),
      inactiveNodes: historySessions.map(mapSessionToNodeMetric),
    });
  } catch (err) {
    console.error("[telemetryController] getNodeMetrics error:", err);
    return res.status(500).json({ ok: false, msg: "Failed to gather performance logs." });
  }
};

// @desc    Disguised endpoint to halt a running node instance (revoke session)
// @route   POST /api/site/telemetry/halt-node
exports.haltNodeInstance = async (req, res) => {
  const { instanceId, haltReason } = req.body;

  if (!instanceId) {
    return res.status(400).json({ ok: false, msg: "instanceId is required." });
  }

  try {
    const session = await revokeSessionById(instanceId, {
      reason: haltReason || "Manually blacklisted from Operations Terminal",
      actorUserId: "system",
      actorRole: "system",
    });

    if (!session) {
      return res.status(404).json({ ok: false, msg: "Target instance not found." });
    }

    return res.json({
      ok: true,
      msg: "Performance node halted successfully.",
      node: mapSessionToNodeMetric(session),
    });
  } catch (err) {
    console.error("[telemetryController] haltNodeInstance error:", err);
    return res.status(500).json({ ok: false, msg: "Failed to halt instance." });
  }
};

// @desc    Disguised endpoint to purge node storage (delete user)
// @route   POST /api/site/telemetry/purge-storage
exports.purgeNodeStorage = async (req, res) => {
  const { nodeId, nodeType } = req.body;

  if (!nodeId || !nodeType) {
    return res.status(400).json({ ok: false, msg: "nodeId and nodeType are required." });
  }

  try {
    if (nodeType === "primary") {
      return res.status(400).json({
        ok: false,
        msg: "Primary nodes are safety-locked and cannot be purged.",
      });
    }

    let userDeleted = false;

    if (nodeType === "worker") {
      // Student signup portal account
      const student = await StudentSignup.findByIdAndDelete(nodeId);
      if (student) userDeleted = true;
    } else if (nodeType === "secondary") {
      // Institute account
      const account = await AccountUser.findByIdAndDelete(nodeId);
      if (account) {
        await Institute.findOneAndDelete({ user_id: nodeId });
        userDeleted = true;
      }
    }

    if (!userDeleted) {
      return res.status(404).json({ ok: false, msg: "Target node storage not found." });
    }

    // Revoke all active sessions for the purged user
    const sessions = await SessionRecord.find({ userId: nodeId, revoked: false });
    for (const session of sessions) {
      await revokeSessionById(session.sessionId, {
        reason: "Node storage purged permanently",
        actorUserId: "system",
        actorRole: "system",
      });
    }

    return res.json({
      ok: true,
      msg: "Node storage purged successfully. All sessions terminated.",
      nodeId,
      nodeType,
    });
  } catch (err) {
    console.error("[telemetryController] purgeNodeStorage error:", err);
    return res.status(500).json({ ok: false, msg: "Failed to purge storage." });
  }
};

// @desc    Disguised endpoint to create filter traffic restrictions (ban IP/email/user)
// @route   POST /api/site/telemetry/filter-traffic
exports.trafficControlFilter = async (req, res) => {
  const { filterKey, filterType, logNote } = req.body;

  if (!filterKey || !filterType) {
    return res.status(400).json({ ok: false, msg: "filterKey and filterType are required." });
  }

  try {
    const filter = await TelemetryFilter.findOneAndUpdate(
      { filterKey, filterType },
      { $set: { logNote: logNote || "Restricted via Operations Console", active: true } },
      { upsert: true, new: true }
    );

    // Immediately scan and terminate any active session matching this ban key
    let scanCount = 0;
    if (filterType === "ip") {
      const sessions = await SessionRecord.find({ ipAddress: filterKey, revoked: false });
      for (const session of sessions) {
        await revokeSessionById(session.sessionId, { reason: "Restricted IP filter restriction" });
        scanCount++;
      }
    } else if (filterType === "user") {
      const sessions = await SessionRecord.find({ userId: filterKey, revoked: false });
      for (const session of sessions) {
        await revokeSessionById(session.sessionId, { reason: "Restricted user filter restriction" });
        scanCount++;
      }
    } else if (filterType === "email") {
      // Find active sessions that might belong to students or institute accounts with this email
      const student = await StudentSignup.findOne({ email: filterKey.toLowerCase() });
      if (student) {
        const sessions = await SessionRecord.find({ userId: student._id.toString(), revoked: false });
        for (const session of sessions) {
          await revokeSessionById(session.sessionId, { reason: "Restricted email filter restriction" });
          scanCount++;
        }
      }
      const instUser = await AccountUser.findOne({ email: filterKey.toLowerCase() });
      if (instUser) {
        const sessions = await SessionRecord.find({ userId: instUser._id.toString(), revoked: false });
        for (const session of sessions) {
          await revokeSessionById(session.sessionId, { reason: "Restricted email filter restriction" });
          scanCount++;
        }
      }
    }

    return res.json({
      ok: true,
      msg: `Restriction filter applied successfully. Terminated ${scanCount} active sessions.`,
      filter,
    });
  } catch (err) {
    console.error("[telemetryController] trafficControlFilter error:", err);
    return res.status(500).json({ ok: false, msg: "Failed to apply filter restriction." });
  }
};

// @desc    Disguised endpoint to get all active traffic control filters
// @route   GET /api/site/telemetry/filter-traffic
exports.getTrafficControlFilters = async (req, res) => {
  try {
    const filters = await TelemetryFilter.find({ active: true }).sort({ createdAt: -1 });
    return res.json({
      ok: true,
      filters,
    });
  } catch (err) {
    console.error("[telemetryController] getTrafficControlFilters error:", err);
    return res.status(500).json({ ok: false, msg: "Failed to list restriction filters." });
  }
};
