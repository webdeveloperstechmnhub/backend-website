const express = require("express");
const {
	createStudentSignup,
	loginStudent,
	getStudentProfile,
} = require("../controllers/studentSignupController");
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");

const router = express.Router();

router.post("/student-signup", createStudentSignup);
router.post("/signup", createStudentSignup);
router.post("/student-login", loginStudent);
router.get("/student/profile", studentAuthMiddleware, getStudentProfile);

module.exports = router;
