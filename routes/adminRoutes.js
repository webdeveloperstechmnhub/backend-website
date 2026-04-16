const express = require('express');
const router = express.Router();
const {
  login,
  getAllUsers,
  getUser,
  deleteUser,
  checkInUser,
  getStats,
  cloneDatabaseToCurrentDb,
  exportDatabaseData,
  getDatabaseOverview,
  getDatabaseCollectionPreview,
} = require('../controllers/adminController');
const {
  getEmployees,
  getEmployee,
  upsertEmployee,
  updateEmployee,
  deleteEmployee,
  terminateEmployee,
} = require('../controllers/checkinController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route
router.post('/login', login);

// Protected routes (require token)
router.get('/users', authMiddleware, getAllUsers);
router.get('/users/:id', authMiddleware, getUser);
router.delete('/users/:id', authMiddleware, deleteUser);
router.put('/users/:id/checkin', authMiddleware, checkInUser);
router.get('/stats', authMiddleware, getStats);
router.post('/database-clone', authMiddleware, cloneDatabaseToCurrentDb);
router.post('/database-export', authMiddleware, exportDatabaseData);
router.post('/database-overview', authMiddleware, getDatabaseOverview);
router.post('/database-collection-preview', authMiddleware, getDatabaseCollectionPreview);
router.get('/employees', authMiddleware, getEmployees);
router.get('/employees/:empId', authMiddleware, getEmployee);
router.post('/employees', authMiddleware, upsertEmployee);
router.put('/employees/:empId', authMiddleware, updateEmployee);
router.put('/employees/:empId/terminate', authMiddleware, terminateEmployee);
router.delete('/employees/:empId', authMiddleware, deleteEmployee);

module.exports = router;