const express = require('express');
const { registerUser, validateReferralCode } = require('../controllers/registrationController');
const router = express.Router();

router.post('/', registerUser);
router.post('/validate-referral', validateReferralCode);

module.exports = router;