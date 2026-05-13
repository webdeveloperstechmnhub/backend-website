const express = require('express')
const { getHomepageContent, sendContactMessage } = require('../controllers/siteController')

const router = express.Router()

router.get('/homepage', getHomepageContent)
router.post('/contact', sendContactMessage)

module.exports = router