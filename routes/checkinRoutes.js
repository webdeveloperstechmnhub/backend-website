const express = require("express");
const router = express.Router();
const {
  upsertEmployee,
  verifyEmployee,
  verifyRegistration,
  checkInParticipant,
  getCheckinStats
} = require("../controllers/checkinController");

// Employee save and verify (QR flow)
router.post("/employee", upsertEmployee);
router.post("/employee/verify", verifyEmployee);

// Verify registration
router.post("/verify", verifyRegistration);

// Check in participant
router.post("/checkin", checkInParticipant);

// Get stats
router.get("/stats", getCheckinStats);

module.exports = router;
