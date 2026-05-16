const User = require("../models/User");
const Employee = require("../models/Employee");
const generateQR = require("../utils/generateQR");
const sendEmail = require("../utils/sendEmail");
const Attendance = require("../models/Attendance");

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

    if (user.checkedIn) {
      return res.status(200).json({
        msg: "Already checked in",
        user,
        alreadyCheckedIn: true,
      });
    }

    res.json({ msg: "Registration verified", user });

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

    if (user.checkedIn) {
      return res.status(400).json({ msg: "Already checked in" });
    }

    user.checkedIn = true;
    user.checkInTime = new Date();
    await user.save();

    // Record an attendance entry for this check-in (keeps historical records)
    try {
      await Attendance.create({
        userId: user._id,
        eventId: user.eventId || req.body.eventId || '',
        registrationId: user.registrationId,
        markedBy: req.body.markedBy || req.admin?.email || 'scanner',
        session: req.body.session || ''
      });
    } catch (attErr) {
      console.warn('Failed to write attendance record:', attErr.message || attErr);
    }

    console.log(`✅ Check-in: ${user.fullName} (${user.registrationId})`);

    res.json({ msg: "Check-in successful", user, checkedInAt: user.checkInTime });

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

    const att = await Attendance.create({
      userId: user._id,
      eventId: eventId || user.eventId || '',
      registrationId: user.registrationId,
      markedBy: markedBy || req.admin?.email || 'scanner',
      session: session || ''
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
    const checkedIn = await User.countDocuments({ ...filter, checkedIn: true });
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
