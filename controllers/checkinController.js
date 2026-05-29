const User = require("../models/User");
const Employee = require("../models/Employee");
const Event = require("../models/Event");
const generateQR = require("../utils/generateQR");
const sendEmail = require("../utils/sendEmail");
const Attendance = require("../models/Attendance");

const DAY_MS = 24 * 60 * 60 * 1000;

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLocalDayKey = (date = new Date()) => {
  const localDate = date instanceof Date ? date : new Date(date);
  return [
    localDate.getFullYear(),
    String(localDate.getMonth() + 1).padStart(2, "0"),
    String(localDate.getDate()).padStart(2, "0"),
  ].join("-");
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const formatCheckinDate = (date) => {
  const resolved = toValidDate(date);
  if (!resolved) return null;
  return resolved.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const isTruthy = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const addDays = (date, days) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return endOfDay(next);
};

const parseDurationFromCampDates = (campDates = "") => {
  const normalized = String(campDates || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const rangeMatch = normalized.match(/(\d{1,2}).*?(\d{1,2}).*?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*.*?(\d{4})/i);
  if (!rangeMatch) return null;

  const [, startDay, endDay, month, year] = rangeMatch;
  const startDate = new Date(`${startDay} ${month} ${year}`);
  const endDate = new Date(`${endDay} ${month} ${year}`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return null;
  }

  return {
    startDate: startOfDay(startDate),
    endDate: endOfDay(endDate),
    durationDays: Math.max(Math.round((endOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / DAY_MS) + 1, 1),
  };
};

const resolveEventLookupQuery = (user) => {
  if (user?.eventId) {
    return { _id: user.eventId };
  }

  if (user?.eventShortName) {
    return {
      shortName: { $regex: new RegExp(`^${escapeRegex(String(user.eventShortName).trim())}$`, "i") },
    };
  }

  return null;
};

const resolveCheckinWindow = (event, user) => {
  const eventType = String(event?.eventType || "").toLowerCase();
  const eventDate = toValidDate(event?.startDate || event?.date);
  const eventEndDate = toValidDate(event?.endDate);
  const campDatesWindow = parseDurationFromCampDates(event?.summerCampConfig?.campDates);

  if (campDatesWindow) {
    return campDatesWindow;
  }

  if (eventType === "summer_camp") {
    const startDate = startOfDay(eventDate || new Date());
    const endDate = eventEndDate ? endOfDay(eventEndDate) : addDays(startDate, 9);
    return {
      startDate,
      endDate,
      durationDays: 10,
    };
  }

  if (eventDate || eventEndDate) {
    const startDate = startOfDay(eventDate || eventEndDate);
    const endDate = endOfDay(eventEndDate || eventDate || new Date());
    return {
      startDate,
      endDate,
      durationDays: Math.max(Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1, 1),
    };
  }

  const fallbackDate = toValidDate(user?.checkInTime) || new Date();
  return {
    startDate: startOfDay(fallbackDate),
    endDate: endOfDay(fallbackDate),
    durationDays: 1,
  };
};

const getAttendanceSummary = async (user, event) => {
  const attendanceFilter = { registrationId: user.registrationId };
  if (event?._id) {
    attendanceFilter.eventId = String(event._id);
  }

  const [attendanceCount, latestAttendance, todayAttendance] = await Promise.all([
    Attendance.countDocuments(attendanceFilter),
    Attendance.findOne(attendanceFilter).sort({ createdAt: -1 }).lean(),
    Attendance.findOne({ ...attendanceFilter, session: toLocalDayKey() }).lean(),
  ]);

  return {
    attendanceCount,
    latestAttendance,
    todayAttendance,
  };
};

const getResolvedEvent = async (user) => {
  const lookup = resolveEventLookupQuery(user);
  if (!lookup) return null;
  return Event.findOne(lookup);
};

const buildTerminationLetterHtml = ({ employeeName, empId, terminationDate, reason }) => {
  const dateText = new Date(terminationDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:680px;margin:0 auto;">
      <h2 style="margin-bottom:8px;color:#b91c1c;">Employment Termination Notice</h2>
      <p>Dear ${employeeName || "Employee"},</p>
      <p>
        This email serves as formal notice that your employment with TechMNHub has been terminated
        effective from <strong>${dateText}</strong>.
      </p>
      <p><strong>Employee ID:</strong> ${empId}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>
        If you have questions about final settlement, company property handover, or documentation,
        please contact the admin team.
      </p>
      <p>Regards,<br/>TechMNHub Admin Team</p>
    </div>
  `;
};

const normalizeEmployeeInput = (source = {}, fallbackEmpId = "") => {
  const empId = String(source.empId || fallbackEmpId || "").trim();
  const normalizedJoiningDate = source.joiningDate ? new Date(source.joiningDate) : null;

  return {
    empId,
    name: String(source.name || "").trim(),
    photoUrl: String(source.photoUrl || "").trim(),
    mobile: String(source.mobile || "").trim(),
    email: String(source.email || "").trim().toLowerCase(),
    joiningDate: normalizedJoiningDate && !Number.isNaN(normalizedJoiningDate.getTime()) ? normalizedJoiningDate : null,
    designation: String(source.designation || "").trim(),
    department: String(source.department || "").trim(),
    description: String(source.description || "").trim(),
  };
};

// Create or update employee by empId
exports.upsertEmployee = async (req, res) => {
  try {
    const { empId, name, photoUrl, mobile, email, joiningDate, designation, department, description } = normalizeEmployeeInput(req.body);

    if (!empId || !name) {
      return res.status(400).json({ msg: "empId and name are required" });
    }

    const employee = await Employee.findOneAndUpdate(
      { empId },
      {
        empId,
        name,
        photoUrl,
        mobile,
        email,
        joiningDate,
        designation,
        department,
        description,
        updatedAt: new Date(),
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );

    const qrCode = await generateQR(empId);

    res.status(200).json({ msg: "Employee saved", employee, qrCode });
  } catch (err) {
    console.error("Employee save error:", err);
    res.status(500).json({ msg: err.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const queryText = String(req.query.q || "").trim();
    const sortOrder = String(req.query.sort || "latest").toLowerCase() === "oldest" ? 1 : -1;

    const filter = queryText
      ? {
          $or: [
            { empId: { $regex: queryText, $options: "i" } },
            { name: { $regex: queryText, $options: "i" } },
            { email: { $regex: queryText, $options: "i" } },
            { mobile: { $regex: queryText, $options: "i" } },
            { designation: { $regex: queryText, $options: "i" } },
            { department: { $regex: queryText, $options: "i" } },
          ],
        }
      : {};

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .sort({ updatedAt: sortOrder, createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .select("empId name employmentStatus photoUrl mobile email joiningDate designation department description terminationDate terminationReason terminationLetterSentAt updatedAt createdAt")
        .allowDiskUse(true)
        .lean(),
      Employee.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      items: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error("Employee list error:", err);
    res.status(500).json({ msg: err.message });
  }
};

exports.getEmployee = async (req, res) => {
  try {
    const empId = String(req.params.empId || "").trim();

    if (!empId) {
      return res.status(400).json({ msg: "empId required" });
    }

    const employee = await Employee.findOne({ empId });

    if (!employee) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    res.json(employee);
  } catch (err) {
    console.error("Employee fetch error:", err);
    res.status(500).json({ msg: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const empId = String(req.params.empId || "").trim();

    if (!empId) {
      return res.status(400).json({ msg: "empId required" });
    }

    const payload = normalizeEmployeeInput(req.body, empId);

    if (req.body.empId && String(req.body.empId).trim() !== empId) {
      return res.status(400).json({ msg: "Employee ID cannot be changed" });
    }

    if (!payload.name) {
      return res.status(400).json({ msg: "name is required" });
    }

    const employee = await Employee.findOneAndUpdate(
      { empId },
      {
        empId,
        name: payload.name,
        photoUrl: payload.photoUrl,
        mobile: payload.mobile,
        email: payload.email,
        joiningDate: payload.joiningDate,
        designation: payload.designation,
        department: payload.department,
        description: payload.description,
        updatedAt: new Date(),
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!employee) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    res.json({ msg: "Employee updated", employee });
  } catch (err) {
    console.error("Employee update error:", err);
    res.status(500).json({ msg: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const empId = String(req.params.empId || "").trim();

    if (!empId) {
      return res.status(400).json({ msg: "empId required" });
    }

    const employee = await Employee.findOneAndDelete({ empId });

    if (!employee) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    res.json({ msg: "Employee deleted", employee });
  } catch (err) {
    console.error("Employee delete error:", err);
    res.status(500).json({ msg: err.message });
  }
};

exports.terminateEmployee = async (req, res) => {
  try {
    const empId = String(req.params.empId || "").trim();
    const reason = String(req.body.reason || "").trim();

    if (!empId) {
      return res.status(400).json({ msg: "empId required" });
    }

    if (!reason) {
      return res.status(400).json({ msg: "Termination reason is required" });
    }

    const employee = await Employee.findOne({ empId });

    if (!employee) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    if (employee.employmentStatus === "terminated") {
      return res.status(400).json({ msg: "Employee is already terminated", employee });
    }

    employee.employmentStatus = "terminated";
    employee.terminationDate = new Date();
    employee.terminationReason = reason;
    employee.updatedAt = new Date();
    await employee.save();

    let emailStatus = "skipped";
    let emailError = "";

    if (employee.email) {
      try {
        await sendEmail({
          to: employee.email,
          subject: `Employment Termination Notice - ${employee.empId}`,
          html: buildTerminationLetterHtml({
            employeeName: employee.name,
            empId: employee.empId,
            terminationDate: employee.terminationDate,
            reason,
          }),
        });

        employee.terminationLetterSentAt = new Date();
        employee.updatedAt = new Date();
        await employee.save();
        emailStatus = "sent";
      } catch (err) {
        console.error("Termination email error:", err);
        emailStatus = "failed";
        emailError = err.message || "Email send failed";
      }
    }

    res.json({
      msg:
        emailStatus === "sent"
          ? "Employee terminated and termination letter sent"
          : "Employee terminated",
      employee,
      emailStatus,
      emailError,
    });
  } catch (err) {
    console.error("Employee terminate error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Verify employee by empId
exports.verifyEmployee = async (req, res) => {
  try {
    const { empId } = req.body;
    const normalizedEmpId = String(empId || "").trim();

    if (!normalizedEmpId) {
      return res.status(400).json({ msg: "empId required" });
    }

    const employee = await Employee.findOne({ empId: normalizedEmpId });

    if (!employee) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    const isTerminated = employee.employmentStatus === "terminated";
    res.json({ msg: "Employee verified", employee, verified: true, terminated: isTerminated });
  } catch (err) {
    console.error("Employee verify error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Verify ticket/registration
exports.verifyRegistration = async (req, res) => {
  try {
    const { registrationId } = req.body;

    if (!registrationId) {
      return res.status(400).json({ msg: "Registration ID required" });
    }

    const user = await User.findOne({ registrationId });

    if (!user) {
      return res.status(404).json({ msg: "Registration not found" });
    }

    const event = await getResolvedEvent(user);
    const { attendanceCount, latestAttendance, todayAttendance } = await getAttendanceSummary(user, event);
    const window = resolveCheckinWindow(event, user);
    const now = new Date();
    const eventOpen = now >= window.startDate && now <= window.endDate;
    const checkinStartText = formatCheckinDate(window.startDate);
    const checkinEndText = formatCheckinDate(window.endDate);

    res.json({
      msg: eventOpen
        ? "Registration verified"
        : `Registration verified, but the event check-in window opens on ${checkinStartText || "the scheduled start date"}`,
      user: {
        ...user.toObject(),
        checkedIn: Boolean(todayAttendance),
        checkInTime: latestAttendance?.createdAt || user.checkInTime || null,
        attendanceCount,
        maxCheckins: window.durationDays,
        remainingCheckins: Math.max(window.durationDays - attendanceCount, 0),
        eventCheckinOpen: eventOpen,
        checkinStartDate: window.startDate,
        checkinEndDate: window.endDate,
        checkinStartText,
        checkinEndText,
      },
      alreadyCheckedIn: Boolean(todayAttendance),
      attendanceCount,
      maxCheckins: window.durationDays,
      remainingCheckins: Math.max(window.durationDays - attendanceCount, 0),
      eventCheckinOpen: eventOpen,
      checkinStartText,
      checkinEndText,
    });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Check in participant
exports.checkInParticipant = async (req, res) => {
  try {
    const { registrationId, userId } = req.body;

    if (!registrationId && !userId) {
      return res.status(400).json({ msg: "Registration ID or User ID required" });
    }

    let user = userId
      ? await User.findById(userId)
      : await User.findOne({ registrationId });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const event = await getResolvedEvent(user);
    const window = resolveCheckinWindow(event, user);
    const now = new Date();
    const allowEarlyCheckin =
      isTruthy(req.body?.allowEarlyCheckin) ||
      isTruthy(req.query?.allowEarlyCheckin);
    const allowRepeatToday =
      isTruthy(req.body?.allowRepeatToday) ||
      isTruthy(req.query?.allowRepeatToday);

    if (now < window.startDate && !allowEarlyCheckin) {
      return res.status(403).json({
        msg: `Check-in has not started for this event yet. It opens on ${formatCheckinDate(window.startDate) || "the scheduled start date"}.`,
        checkinStartDate: window.startDate,
        checkinEndDate: window.endDate,
      });
    }

    if (now > window.endDate) {
      return res.status(403).json({
        msg: "Check-in is closed for this event.",
        checkinStartDate: window.startDate,
        checkinEndDate: window.endDate,
      });
    }

    const { attendanceCount, todayAttendance } = await getAttendanceSummary(user, event);
    if (attendanceCount >= window.durationDays) {
      return res.status(403).json({
        msg: "Check-in limit reached for this event.",
        maxCheckins: window.durationDays,
        attendanceCount,
      });
    }

    if (todayAttendance && !allowRepeatToday) {
      return res.status(409).json({
        msg: "Already checked in today.",
        alreadyCheckedIn: true,
        attendanceCount,
        maxCheckins: window.durationDays,
        remainingCheckins: Math.max(window.durationDays - attendanceCount, 0),
      });
    }

    user.checkedIn = true;
    user.checkInTime = now;
    await user.save();

    const sessionKey = toLocalDayKey(now);

    // Record an attendance entry for this check-in (keeps historical records)
    try {
      await Attendance.create({
        userId: user._id,
        eventId: event?._id ? String(event._id) : (user.eventId || req.body.eventId || ''),
        registrationId: user.registrationId,
        markedBy: req.body.markedBy || req.admin?.email || 'scanner',
        session: req.body.session || sessionKey,
      });
    } catch (attErr) {
      console.warn('Failed to write attendance record:', attErr.message || attErr);
    }

    console.log(`✅ Check-in: ${user.fullName} (${user.registrationId})`);

    const updatedAttendanceCount = attendanceCount + 1;
    res.json({
      msg: "Check-in successful",
      user: {
        ...user.toObject(),
        checkedIn: true,
        checkInTime: user.checkInTime,
        attendanceCount: updatedAttendanceCount,
        maxCheckins: window.durationDays,
        remainingCheckins: Math.max(window.durationDays - updatedAttendanceCount, 0),
        eventCheckinOpen: true,
      },
      checkedInAt: user.checkInTime,
      attendanceCount: updatedAttendanceCount,
      maxCheckins: window.durationDays,
      remainingCheckins: Math.max(window.durationDays - updatedAttendanceCount, 0),
    });

  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Create a standalone attendance record (no change to user checkedIn flag)
exports.createAttendance = async (req, res) => {
  try {
    const { userId, registrationId, eventId, session, markedBy } = req.body;

    if (!userId && !registrationId) {
      return res.status(400).json({ msg: 'userId or registrationId required' });
    }

    let user = null;
    if (userId) user = await User.findById(userId);
    if (!user && registrationId) user = await User.findOne({ registrationId });

    if (!user) return res.status(404).json({ msg: 'User not found' });

    const event = await getResolvedEvent(user);
    const sessionKey = session || toLocalDayKey();

    const att = await Attendance.create({
      userId: user._id,
      eventId: event?._id ? String(event._id) : (eventId || user.eventId || ''),
      registrationId: user.registrationId,
      markedBy: markedBy || req.admin?.email || 'scanner',
      session: sessionKey,
    });

    res.json({ msg: 'Attendance recorded', attendance: att });
  } catch (err) {
    console.error('Attendance create error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// List attendance records (filter by eventId, userId, registrationId, date range)
exports.getAttendance = async (req, res) => {
  try {
    const { eventId, userId, registrationId, since, until, limit } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (userId) filter.userId = userId;
    if (registrationId) filter.registrationId = registrationId;

    if (since || until) {
      filter.createdAt = {};
      if (since) filter.createdAt.$gte = new Date(since);
      if (until) filter.createdAt.$lte = new Date(until);
    }

    const lim = Math.min(500, Math.max(1, parseInt(limit || '50', 10)));

    const items = await Attendance.find(filter).sort({ createdAt: -1 }).limit(lim).lean();
    res.json(items);
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ msg: err.message });
  }
};

// Get check-in statistics (optionally filtered by eventId query param)
exports.getCheckinStats = async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = eventId ? { eventId } : {};

    const total = await User.countDocuments(filter);
    const checkedIn = eventId
      ? await Attendance.distinct('registrationId', { eventId }).then((items) => items.length)
      : await User.countDocuments({ checkedIn: true });
    const pending = total - checkedIn;

    res.json({
      total,
      checkedIn,
      pending,
      checkinPercentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
    });

  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ msg: err.message });
  }
};

module.exports = exports;
