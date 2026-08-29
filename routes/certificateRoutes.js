const express = require("express");
const router = express.Router();
const certificateController = require("../controllers/certificateController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes
router.get("/verify/:id", certificateController.verifyCertificate);

// Protected Admin / Certificate Management routes
router.post("/issue", authMiddleware, certificateController.issueCertificate);
router.post("/batch-issue", authMiddleware, certificateController.batchIssueCertificates);
router.get("/list", authMiddleware, certificateController.getCertificates);
router.get("/:id", authMiddleware, certificateController.getCertificateById);
router.delete("/:id", authMiddleware, certificateController.deleteCertificate);

module.exports = router;
