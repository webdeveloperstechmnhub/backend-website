const express = require("express");
const {
	createStudentSignup,
	loginStudent,
	getStudentProfile,
	submitStudentActivity,
	updateStudentProfile,
} = require("../controllers/studentSignupController");
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");

const router = express.Router();

router.post("/student-signup", createStudentSignup);
router.post("/signup", createStudentSignup);
router.post("/student-login", loginStudent);
router.get("/student/profile", studentAuthMiddleware, getStudentProfile);
router.post("/student/activities/submit", studentAuthMiddleware, submitStudentActivity);
router.put("/student/profile", studentAuthMiddleware, updateStudentProfile);

module.exports = router;
