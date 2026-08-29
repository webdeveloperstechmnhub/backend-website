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
  getBlockedAttempts,
  getAuthActivities,
} = require('../controllers/sessionIntelligenceController')

const { requireSuperAdmin } = authMiddleware;
const {
  getTrafficControlFilters,
  trafficControlFilter,
  purgeNodeStorage,
} = require('../controllers/telemetryController');

const router = express.Router()

router.post('/', createSessionBooking)

// Session Manager Dashboard / Telemetry Control (Super Admin Only)
router.get('/live', authMiddleware, requireSuperAdmin, getLiveSessionsDashboard)
router.get('/history', authMiddleware, requireSuperAdmin, getHistorySessionsDashboard)
router.get('/blocked', authMiddleware, requireSuperAdmin, getBlockedAttempts)
router.get('/activities', authMiddleware, requireSuperAdmin, getAuthActivities)
router.post('/revoke/:sessionId', authMiddleware, requireSuperAdmin, revokeDashboardSession)
router.post('/revoke-all', authMiddleware, requireSuperAdmin, revokeAllDashboardSessions)
router.get('/bans', authMiddleware, requireSuperAdmin, getTrafficControlFilters)
router.post('/ban', authMiddleware, requireSuperAdmin, trafficControlFilter)
router.post('/purge/:nodeId', authMiddleware, requireSuperAdmin, purgeNodeStorage)

router.get('/active', authMiddleware, getActiveSessions)
router.get('/:id', authMiddleware, getSessionById)
router.post('/:id/revoke', authMiddleware, revokeSession)
router.post('/revoke-all/:userId', authMiddleware, revokeAllSessions)
router.get('/', authMiddleware, getSessionBookings)
router.put('/:id', authMiddleware, updateSessionBooking)
router.delete('/:id', authMiddleware, deleteSessionBooking)

module.exports = router
