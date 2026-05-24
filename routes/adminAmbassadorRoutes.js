const express = require('express')

const {
  listAmbassadorApplications,
  approveAmbassadorApplication,
  rejectAmbassadorApplication,
  listActiveAmbassadors,
  terminateAmbassador,
} = require('../controllers/ambassadorAdminController')

const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

// Protected admin endpoints
router.get('/applications', authMiddleware, listAmbassadorApplications)
router.post('/approve', authMiddleware, approveAmbassadorApplication)
router.post('/reject', authMiddleware, rejectAmbassadorApplication)
router.get('/active', authMiddleware, listActiveAmbassadors)
router.delete('/:id/terminate', authMiddleware, terminateAmbassador)

module.exports = router


