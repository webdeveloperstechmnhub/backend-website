const express = require('express');
const router = express.Router();
const {
  login,
  getAllUsers,
  getUser,
  deleteUser,
  getStats,
  getStudentSignups,
  reviewStudentSignup,
  cloneDatabaseToCurrentDb,
  exportDatabaseData,
  getDatabaseOverview,
  getDatabaseCollectionPreview,
  createInstituteAccount,
  getInstitutes,
  updateInstitute,
  deleteInstitute,
  getSystemSettings,
  setSystemSetting,
  getCompanyGrowthAnalytics,
} = require('../controllers/adminController');
const {
  getEmployees,
  getEmployee,
  upsertEmployee,
  issueEmployeeCredentials,
  backfillEmployeeCredentials,
  updateEmployee,
  deleteEmployee,
  terminateEmployee,
  checkInParticipant,
} = require('../controllers/checkinController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireSuperAdmin, requirePermission } = authMiddleware;

// Public route
router.post('/login', login);

// Protected routes (require token)
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.admin });
});
router.get('/users', authMiddleware, requirePermission('event.view'), getAllUsers);
router.get('/users/:id', authMiddleware, requirePermission('event.view'), getUser);
router.delete('/users/:id', authMiddleware, requirePermission('event.delete'), deleteUser);
router.put('/users/:id/checkin', authMiddleware, requirePermission('event.edit'), (req, res) => {
  req.body = {
    ...(req.body || {}),
    userId: req.params.id,
    allowEarlyCheckin: true,
  };
  return checkInParticipant(req, res);
});
router.get('/stats', authMiddleware, requirePermission('event.view'), getStats);
router.get('/company-growth-analytics', authMiddleware, requirePermission('event.view'), getCompanyGrowthAnalytics);
router.get('/student-signups', authMiddleware, requirePermission('ambassador.view'), getStudentSignups);
router.patch('/student-signups/:id', authMiddleware, requirePermission('ambassador.approve'), reviewStudentSignup);
router.post('/database-clone', authMiddleware, requireSuperAdmin, cloneDatabaseToCurrentDb);
router.post('/database-export', authMiddleware, requireSuperAdmin, exportDatabaseData);
router.post('/database-overview', authMiddleware, requireSuperAdmin, getDatabaseOverview);
router.post('/database-collection-preview', authMiddleware, requireSuperAdmin, getDatabaseCollectionPreview);
router.get('/institutes', authMiddleware, requirePermission('institute.view'), getInstitutes);
router.post('/institutes', authMiddleware, requirePermission('institute.edit'), createInstituteAccount);
router.put('/institutes/:id', authMiddleware, requirePermission('institute.edit'), updateInstitute);
router.delete('/institutes/:id', authMiddleware, requirePermission('institute.edit'), deleteInstitute);
router.get('/employees', authMiddleware, requireSuperAdmin, getEmployees);
router.get('/employees/:empId', authMiddleware, requireSuperAdmin, getEmployee);
router.post('/employees', authMiddleware, requireSuperAdmin, upsertEmployee);
router.post('/employees/:empId/credentials', authMiddleware, requireSuperAdmin, issueEmployeeCredentials);
router.post('/employees/backfill-credentials', authMiddleware, requireSuperAdmin, backfillEmployeeCredentials);
router.put('/employees/:empId', authMiddleware, requireSuperAdmin, updateEmployee);
router.put('/employees/:empId/terminate', authMiddleware, requireSuperAdmin, terminateEmployee);
router.delete('/employees/:empId', authMiddleware, requireSuperAdmin, deleteEmployee);
// System settings
router.get('/system-settings', authMiddleware, requireSuperAdmin, getSystemSettings);
router.post('/system-settings', authMiddleware, requireSuperAdmin, setSystemSetting);

module.exports = router;