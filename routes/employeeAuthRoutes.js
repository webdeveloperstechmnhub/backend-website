const express = require('express');
const router = express.Router();
const { login } = require('../controllers/employeeAuthController');

// Public employee login
router.post('/login', login);

module.exports = router;
