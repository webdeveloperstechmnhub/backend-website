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
  duplicateEvent,
  publishEvent,
  unpublishEvent,
  closeEvent,
  reopenEvent,
  getEventEntries,
  getRegistrations,
  updateRegistration,
  getAnalytics,
  exportRegistrations,
  uploadMedia,
} = require("../controllers/eventController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/active", getActiveEvents);
router.get("/public", getPublicEvents);
router.get("/registrations/export", authMiddleware, exportRegistrations);
router.get("/registrations", authMiddleware, getRegistrations);
router.put("/registrations/:id", authMiddleware, updateRegistration);
router.get("/analytics/summary", authMiddleware, getAnalytics);
router.post("/media/upload", authMiddleware, uploadMedia);
router.get("/:id", getEventById);
router.get("/", authMiddleware, getAllEvents);
router.post("/", authMiddleware, createEvent);
router.put("/:id", authMiddleware, updateEvent);
router.delete("/:id", authMiddleware, deleteEvent);
router.post("/:id/duplicate", authMiddleware, duplicateEvent);
router.get("/:id/entries", authMiddleware, getEventEntries);
router.patch("/:id/publish", authMiddleware, publishEvent);
router.patch("/:id/unpublish", authMiddleware, unpublishEvent);
router.patch("/:id/close", authMiddleware, closeEvent);
router.patch("/:id/reopen", authMiddleware, reopenEvent);

module.exports = router;
