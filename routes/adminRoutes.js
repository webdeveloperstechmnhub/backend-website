const express = require('express');
const router = express.Router();
const {
  login,
  getAllUsers,
  getUser,
  deleteUser,
  checkInUser,
  getStats
} = require('../controllers/adminController');
const {
  getEmployees,
  getEmployee,
  upsertEmployee,
  updateEmployee,
  deleteEmployee,
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
router.get('/employees', authMiddleware, getEmployees);
router.get('/employees/:empId', authMiddleware, getEmployee);
router.post('/employees', authMiddleware, upsertEmployee);
router.put('/employees/:empId', authMiddleware, updateEmployee);
router.delete('/employees/:empId', authMiddleware, deleteEmployee);

module.exports = router;