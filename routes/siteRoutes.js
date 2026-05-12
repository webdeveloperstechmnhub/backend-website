const express = require('express')
const { getHomepageContent } = require('../controllers/siteController')

const router = express.Router()

router.get('/homepage', getHomepageContent)

module.exports = router