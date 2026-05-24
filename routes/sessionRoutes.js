const express = require('express')
const authMiddleware = require('../middleware/authMiddleware')
const {
  createSessionBooking,
  getSessionBookings,
  updateSessionBooking,
  deleteSessionBooking,
} = require('../controllers/sessionController')
const {
  getActiveSessions,
  getSessionById,
  revokeSession,
  revokeAllSessions,
  getLiveSessionsDashboard,
  getHistorySessionsDashboard,
  revokeDashboardSession,
  revokeAllDashboardSessions,
} = require('../controllers/sessionIntelligenceController')

const router = express.Router()

router.post('/', createSessionBooking)
router.get('/live', getLiveSessionsDashboard)
router.get('/history', getHistorySessionsDashboard)
router.post('/revoke/:sessionId', revokeDashboardSession)
router.post('/revoke-all', revokeAllDashboardSessions)
router.get('/active', authMiddleware, getActiveSessions)
router.get('/:id', authMiddleware, getSessionById)
router.post('/:id/revoke', authMiddleware, revokeSession)
router.post('/revoke-all/:userId', authMiddleware, revokeAllSessions)
router.get('/', authMiddleware, getSessionBookings)
router.put('/:id', authMiddleware, updateSessionBooking)
router.delete('/:id', authMiddleware, deleteSessionBooking)

module.exports = router
