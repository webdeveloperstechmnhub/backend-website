const User = require("../models/User");
const Employee = require("../models/Employee");
const generateQR = require("../utils/generateQR");

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
        .select("empId name photoUrl mobile email joiningDate designation department description updatedAt createdAt")
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

    res.json({ msg: "Employee verified", employee, verified: true });
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

    console.log(`✅ Check-in: ${user.fullName} (${user.registrationId})`);

    res.json({ msg: "Check-in successful", user, checkedInAt: user.checkInTime });

  } catch (err) {
    console.error("Check-in error:", err);
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
