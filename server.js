require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// 🔁 Import Routes
const registrationRoutes = require("./routes/registrationRoutes"); // ⚠️ सही filename – registerRoutes.js
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes"); // यदि तुमने admin बनाया है
const offlineTicketRoutes = require("./routes/offlineTicketRoutes"); // Offline ticket generator
const checkinRoutes = require("./routes/checkinRoutes"); // Check-in system
const eventRoutes = require("./routes/eventRoutes");
const accountRoutes = require("./routes/accountRoutes");

const app = express();

app.set('trust proxy', 1);

// 🔐 Security Middlewares
app.use(helmet());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "http://localhost:8080",
      "http://localhost:5175",      // For ticket generator
      "http://127.0.0.1:8080",      // For ticket generator
      "null",                        // For file:// protocol
      "https://techmnhub-gamma.vercel.app",
      "https://techmnhub-admin.vercel.app",
      "https://techmnhub.com",
      "https://www.techmnhub.com",
      "https://checkin-system-techmnhub.tpriyansh973.workers.dev",
      "https://ticket-generator.tpriyansh973.workers.dev",
      "https://techmnhub-1.pages.dev",
      "https://techmnhub-frontend.pages.dev",
      "admin-techmnhub.pages.dev"
    ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 🔁 Rate Limiting – सिर्फ payment create-order पर ही लगाओ (verify पर नहीं)
const paymentCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 मिनट
  max: 20, // 20 requests per IP
  message: "Too many payment requests, please try again later.",
});

// ✅ Payment routes पर **कोई auth नहीं**, सिर्फ rate limit
app.use("/api/payment/create-order", paymentCreateLimiter); // सिर्फ create-order limit करो
// verify पर limit नहीं डालनी (handler को तुरंत hit होना चाहिए)

// 🔁 MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// 🔁 Routes
app.use("/api/register", registrationRoutes);
app.use("/api/payment", paymentRoutes); // ✅ बिना auth के
app.use("/api/admin", adminRoutes); // admin route (यदि है तो)
app.use("/api/ticket", offlineTicketRoutes); // Offline ticket generator
app.use("/api/checkin", checkinRoutes); // Check-in system
app.use("/api/events", eventRoutes); // Event management
app.use("/api/account", accountRoutes); // Institute auth

// 🟢 Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
