const express = require("express");
const router = express.Router();
const {
  generateOfflineTicket,
  sendOfflineTicketEmail,
} = require("../controllers/offlineTicketController");

// Health check
router.get("/health", (req, res) => {
  res.status(200).json({ ok: true, msg: "Offline ticket API is running" });
});

// Generate offline ticket
router.post("/generate", generateOfflineTicket);

// Send ticket email
router.post("/send-email", sendOfflineTicketEmail);

module.exports = router;
