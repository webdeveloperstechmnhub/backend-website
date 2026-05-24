const express = require('express')

const {
  applyAmbassador,
  getAmbassadorLeaderboard,
  getAmbassadorDashboard,
  trackReferral,
} = require('../controllers/ambassadorController')
const studentAuthMiddleware = require('../middleware/studentAuthMiddleware')

const router = express.Router()

// Ambassador Public
router.post('/apply', applyAmbassador)
router.get('/leaderboard', getAmbassadorLeaderboard)
router.get('/dashboard', getAmbassadorDashboard)
router.get('/dashboard/me', studentAuthMiddleware, getAmbassadorDashboard)
router.post('/referrals/track', trackReferral)

module.exports = router


