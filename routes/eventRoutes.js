const express = require("express");
const router = express.Router();

const {
  getActiveEvents,
  getPublicEvents,
  getEventById,
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  closeEvent,
  reopenEvent,
  getEventEntries,
} = require("../controllers/eventController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/active", getActiveEvents);
router.get("/public", getPublicEvents);
router.get("/:id", getEventById);
router.get("/", authMiddleware, getAllEvents);
router.post("/", authMiddleware, createEvent);
router.put("/:id", authMiddleware, updateEvent);
router.delete("/:id", authMiddleware, deleteEvent);
router.get("/:id/entries", authMiddleware, getEventEntries);
router.patch("/:id/close", authMiddleware, closeEvent);
router.patch("/:id/reopen", authMiddleware, reopenEvent);

module.exports = router;
