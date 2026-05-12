const express = require('express')
const authMiddleware = require('../middleware/authMiddleware')
const {
  createSessionBooking,
  getSessionBookings,
  updateSessionBooking,
  deleteSessionBooking,
} = require('../controllers/sessionController')

const router = express.Router()

router.post('/', createSessionBooking)
router.get('/', authMiddleware, getSessionBookings)
router.put('/:id', authMiddleware, updateSessionBooking)
router.delete('/:id', authMiddleware, deleteSessionBooking)

module.exports = router
