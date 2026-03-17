const express = require("express");
const router = express.Router();
const { createOrder, verifyPayment } = require("../controllers/paymentController");

router.post("/create-order", createOrder);   // ❌ no auth
router.post("/verify", verifyPayment);      // ❌ no auth

module.exports = router;
