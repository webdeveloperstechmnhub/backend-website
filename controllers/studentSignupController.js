const bcrypt = require("bcryptjs");
const StudentSignup = require("../models/StudentSignup");
const InstituteActivity = require("../models/InstituteActivity");
const { generateSessionIdentifiers, signSessionJwt } = require("../utils/auth/jwtSession");
const { getRequestMetadata } = require("../utils/auth/requestMetadata");
const { createSessionOwnership } = require("../services/sessionOwnershipService");
const { logAuthEvent } = require("../services/authAuditService");

const normalize = (value) => String(value || "").trim();

const toStudentResponse = (student) => ({
  id: student._id,
  fullName: student.fullName,
  email: student.email,
  phone: student.phone,
  college: student.college,
  year: student.year,
  city: student.city,
  interests: student.interests,
  status: student.status,
  approvedAt: student.approvedAt,
  reviewedAt: student.reviewedAt,
  studentId: `TMH-ST-${String(student._id).slice(-6).toUpperCase()}`,
  points: student.points || 0,
  badges: student.badges || [],
});

exports.createStudentSignup = async (req, res) => {
  try {
    const fullName = normalize(req.body?.fullName);
    const email = normalize(req.body?.email).toLowerCase();
    const phone = normalize(req.body?.phone);
    const college = normalize(req.body?.college);
    const year = normalize(req.body?.year);
    const city = normalize(req.body?.city);
    const interests = normalize(req.body?.interests);
    const password = String(req.body?.password || "");

    if (!fullName || !email || !phone || !college || !year || !city || !interests || !password) {
      return res.status(400).json({ msg: "All fields are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters long." });
    }

    const emailExists = await StudentSignup.findOne({ email });
    if (emailExists) {
      return res.status(409).json({ msg: "This email is already registered for signup." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const signup = await StudentSignup.create({
      fullName,
      email,
      phone,
      college,
      year,
      city,
      interests,
      passwordHash,
      status: "pending",
    });

    return res.status(201).json({
      msg: "Signup request submitted successfully.",
      signupId: signup._id,
      status: signup.status,
    });
  } catch (error) {
    console.error("Student signup error:", error);
    return res.status(500).json({ msg: "Server error while creating signup request." });
  }
};

exports.loginStudent = async (req, res) => {
  try {
    const metadata = getRequestMetadata(req);
    const email = normalize(req.body?.email).toLowerCase();
    const password = String(req.body?.password || "");

    const TelemetryFilter = require("../models/TelemetryFilter");
    const clientIp = metadata.ipAddress || req.ip || "";
    const isBanned = await TelemetryFilter.findOne({
      active: true,
      $or: [
        { filterKey: clientIp, filterType: "ip" },
        { filterKey: email, filterType: "email" }
      ]
    });

    if (isBanned) {
      return res.status(403).json({ msg: "Access restriction active. Connection suspended." });
    }

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required." });
    }

    const student = await StudentSignup.findOne({ email });
    if (!student) {
      await logAuthEvent({
        actorUserId: email || "unknown",
        actorRole: "student",
        action: "login_failed",
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { reason: "invalid_credentials", email },
      });
      return res.status(401).json({ msg: "Invalid credentials." });
    }

    const passwordMatches = await bcrypt.compare(password, student.passwordHash);
    if (!passwordMatches) {
      await logAuthEvent({
        actorUserId: student._id.toString(),
        actorRole: "student",
        action: "login_failed",
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { reason: "invalid_credentials", email },
      });
      return res.status(401).json({ msg: "Invalid credentials." });
    }

    if (student.status !== "approved") {
      const msgByStatus = {
        pending: "Your account is pending admin approval.",
        rejected: "Your signup was rejected. Contact support or admin.",
      };

      return res.status(403).json({
        msg: msgByStatus[student.status] || "Student account is not approved yet.",
        status: student.status,
      });
    }

    const { sessionId, jti } = generateSessionIdentifiers();
    const session = await createSessionOwnership({
      userId: student._id.toString(),
      role: "student",
      metadata,
      providedSessionId: sessionId,
      providedJti: jti,
    });

    const token = signSessionJwt({
      claims: {
        id: student._id.toString(),
        email: student.email,
        role: "student",
      },
      sessionId,
      jti,
      expiresIn: "7d",
    });

    await logAuthEvent({
      actorUserId: student._id.toString(),
      actorRole: "student",
      action: "login_success",
      targetSessionId: sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        email: student.email,
        deviceHash: metadata.deviceHash,
        deviceLabel: metadata.deviceLabel,
      },
    });

    // Notify session-manager about the new session (best-effort)
    try {
      const sessionManager = require('../utils/sessionManagerClient');
      sessionManager.createSession({
        userId: student._id.toString(),
        role: 'student',
        sessionId,
        jti,
        ip: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceHash: metadata.deviceHash,
        loginAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[studentSignupController] session-manager notify failed', err && err.message);
    }

    return res.json({
      msg: "Student login successful.",
      token,
      session: {
        session_id: session.sessionId,
        jti: session.jti,
        expires_at: session.expiresAt,
        device_label: session.deviceLabel,
      },
      student: toStudentResponse(student),
    });
  } catch (error) {
    console.error("Student login error:", error);
    return res.status(500).json({ msg: "Server error while logging in student." });
  }
};

exports.getStudentProfile = async (req, res) => {
  try {
    const studentId = req.studentUser?.id;
    if (!studentId) {
      return res.status(401).json({ msg: "Unauthorized student request." });
    }

    const student = await StudentSignup.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: "Student profile not found." });
    }

    if (student.status !== "approved") {
      return res.status(403).json({ msg: "Student account is not approved anymore." });
    }

    return res.json({ student: toStudentResponse(student) });
  } catch (error) {
    console.error("Student profile error:", error);
    return res.status(500).json({ msg: "Server error while loading student profile." });
  }
};

exports.submitStudentActivity = async (req, res) => {
  try {
    const studentId = req.studentUser?.id;
    if (!studentId) {
      return res.status(401).json({ msg: "Unauthorized student request." });
    }

    const { activityId, notes } = req.body;
    if (!activityId || !notes || notes.trim().length < 5) {
      return res.status(400).json({ msg: "activityId and at least 5 characters of notes are required." });
    }

    const student = await StudentSignup.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: "Student profile not found." });
    }

    if (student.status !== "approved") {
      return res.status(403).json({ msg: "Student account is not approved." });
    }

    // Try to find the activity to get its point value, fallback to 50
    let pointsToAdd = 50;
    const activity = await InstituteActivity.findById(activityId);
    if (activity) {
      pointsToAdd = Number(activity.points) || 50;
    }

    // Calculate new total points
    const currentPoints = student.points || 0;
    const newTotalPoints = currentPoints + pointsToAdd;
    student.points = newTotalPoints;

    // Calculate dynamic badges based on thresholds
    const badges = [];
    if (newTotalPoints >= 0) badges.push("Starter");
    if (newTotalPoints >= 150) badges.push("Growth");
    if (newTotalPoints >= 300) badges.push("Buzz");
    if (newTotalPoints >= 500) badges.push("Future Leader");
    student.badges = badges;

    await student.save();

    return res.json({
      msg: "Activity submitted successfully.",
      newTotalPoints,
      student: toStudentResponse(student),
    });
  } catch (error) {
    console.error("Submit activity error:", error);
    return res.status(500).json({ msg: "Server error while submitting activity." });
  }
};

exports.updateStudentProfile = async (req, res) => {
  try {
    const studentId = req.studentUser?.id;
    if (!studentId) {
      return res.status(401).json({ msg: "Unauthorized student request." });
    }

    const fullName = normalize(req.body?.fullName);
    const phone = normalize(req.body?.phone);
    const college = normalize(req.body?.college);
    const year = normalize(req.body?.year);
    const city = normalize(req.body?.city);
    const interests = normalize(req.body?.interests);

    if (!fullName || !phone || !college || !year || !city || !interests) {
      return res.status(400).json({ msg: "All profile fields are required." });
    }

    const student = await StudentSignup.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: "Student profile not found." });
    }

    if (student.status !== "approved") {
      return res.status(403).json({ msg: "Student account is not approved." });
    }

    student.fullName = fullName;
    student.phone = phone;
    student.college = college;
    student.year = year;
    student.city = city;
    student.interests = interests;

    await student.save();

    return res.json({
      msg: "Student profile updated successfully.",
      student: toStudentResponse(student),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ msg: "Server error while updating profile." });
  }
};

