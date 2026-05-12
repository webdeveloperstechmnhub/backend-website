const express = require('express');
const router = express.Router();
const {
	loginInstitute,
	getInstituteProfile,
	getInstituteSummary,
	getInstituteStudents,
	getLeaderboard,
	getActivities,
	createInstituteActivity,
} = require('../controllers/accountController');
const instituteAuthMiddleware = require('../middleware/instituteAuthMiddleware');

router.post('/institute/login', loginInstitute);
router.get('/institute/profile', instituteAuthMiddleware, getInstituteProfile);
router.get('/institute/summary', instituteAuthMiddleware, getInstituteSummary);
router.get('/institute/students', instituteAuthMiddleware, getInstituteStudents);
router.post('/institute/activities', instituteAuthMiddleware, createInstituteActivity);

router.get('/activities', getActivities);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
