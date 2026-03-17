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
const authMiddleware = require('../middleware/authMiddleware');

// Public route
router.post('/login', login);

// Protected routes (require token)
router.get('/users', authMiddleware, getAllUsers);
router.get('/users/:id', authMiddleware, getUser);
router.delete('/users/:id', authMiddleware, deleteUser);
router.put('/users/:id/checkin', authMiddleware, checkInUser);
router.get('/stats', authMiddleware, getStats);

module.exports = router;