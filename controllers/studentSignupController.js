const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const StudentSignup = require("../models/StudentSignup");

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
    const email = normalize(req.body?.email).toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required." });
    }

    const student = await StudentSignup.findOne({ email });
    if (!student) {
      return res.status(401).json({ msg: "Invalid credentials." });
    }

    const passwordMatches = await bcrypt.compare(password, student.passwordHash);
    if (!passwordMatches) {
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

    const token = jwt.sign(
      {
        id: student._id.toString(),
        email: student.email,
        role: "student",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      msg: "Student login successful.",
      token,
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
