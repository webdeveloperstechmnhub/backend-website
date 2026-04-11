const User = require("../../../website/backend - webdevs/models/User");
const Employee = require("../../../website/backend - webdevs/models/Employee");
const generateQR = require("../../../website/backend - webdevs/utils/generateQR");

const normalizeEmployeeInput = (source = {}, fallbackEmpId = "") => {
  const empId = String(source.empId || fallbackEmpId || "").trim();

  return {
    empId,
    name: String(source.name || "").trim(),
    designation: String(source.designation || "").trim(),
    department: String(source.department || "").trim(),
    description: String(source.description || "").trim(),
  };
};

// Create or update employee by empId
exports.upsertEmployee = async (req, res) => {
  try {
    const { empId, name, designation, department, description } = normalizeEmployeeInput(req.body);

    if (!empId || !name) {
      return res.status(400).json({ msg: "empId and name are required" });
    }

    const employee = await Employee.findOneAndUpdate(
      { empId },
      {
        empId,
        name,
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
    const employees = await Employee.find().sort({ updatedAt: -1, createdAt: -1 });
    res.json(employees);
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
