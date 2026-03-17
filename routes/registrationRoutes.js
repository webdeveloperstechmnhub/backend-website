const express = require('express');
const { registerUser } = require('../controllers/registrationController');
const router = express.Router();

router.post('/', registerUser);

module.exports = router;