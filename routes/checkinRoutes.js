const express = require("express");
const router = express.Router();
const {
  verifyRegistration,
  checkInParticipant,
  getCheckinStats
} = require("../controllers/checkinController");

// Verify registration
router.post("/verify", verifyRegistration);

// Check in participant
router.post("/checkin", checkInParticipant);

// Get stats
router.get("/stats", getCheckinStats);

module.exports = router;
