require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
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
const siteRoutes = require("./routes/siteRoutes");
const studentSignupRoutes = require("./routes/studentSignupRoutes");
const { ensureSeedEventsIfEmpty } = require("./controllers/eventController");
const sessionRoutes = require("./routes/sessionRoutes");
const employeeAuthRoutes = require("./routes/employeeAuthRoutes");
const ambassadorRoutes = require("./routes/ambassadorRoutes");
const adminAmbassadorRoutes = require("./routes/adminAmbassadorRoutes");
const certificateRoutes = require("./routes/certificateRoutes");

const app = express();

app.set('trust proxy', 1);

// 🔐 Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5500",
  "null",
  "https://techmnhub-gamma.vercel.app",
  "https://techmnhub-admin.vercel.app",
  "https://techmnhub.com",
  "https://www.techmnhub.com",
  "https://checkin-system.pages.dev",
  "https://tickets-generator.pages.dev",
  "https://techmnhub-1.pages.dev",
  "https://techmnhub-frontend.pages.dev",
  "https://admin-techmnhub.pages.dev",
  "https://session-manager-atex.onrender.com",
  "https://session-manager.tpriyansh973.workers.dev",
  "https://admin.techmnhub.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Check explicit allowed list
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow local Wi-Fi / LAN IPs for mobile device testing (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost)
      if (
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
          origin
        )
      ) {
        return callback(null, true);
      }

      // Allow official domains and previews (techmnhub.com, vercel, pages.dev, ngrok)
      if (
        /^https?:\/\/([a-zA-Z0-9-]+\.)*(techmnhub\.com|pages\.dev|vercel\.app|ngrok-free\.app|loca\.lt)(:\d+)?$/.test(
          origin
        ) ||
        /^capacitor:\/\/localhost/.test(origin) ||
        /^ionic:\/\/localhost/.test(origin)
      ) {
        return callback(null, true);
      }

      // Public verification can be embedded or queried from any client
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
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
  .then(async () => {
    console.log("✅ MongoDB Connected");
    try {
      await ensureSeedEventsIfEmpty();
      console.log("✅ Seed events verified");
    } catch (err) {
      console.error("❌ Seed event verification failed:", err);
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// 🔁 Routes
app.use("/api/register", registrationRoutes);
app.use("/api/payment", paymentRoutes); // ✅ बिना auth के
app.use('/api/admin/ambassadors', adminAmbassadorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/admin", adminRoutes); // Direct alias
app.use("/api/ticket", offlineTicketRoutes); // Offline ticket generator
app.use("/api/checkin", checkinRoutes); // Check-in system
app.use("/api/events", eventRoutes); // Event management
app.use("/api/account", accountRoutes); // Institute auth
app.use("/api/site", siteRoutes); // Homepage and site content
app.use("/api/sessions", sessionRoutes); // Session booking management
app.use("/api", studentSignupRoutes); // Student signup flow
app.use('/api/employee', employeeAuthRoutes);
app.use('/employee', employeeAuthRoutes); // Direct alias
app.use("/api/ambassador", ambassadorRoutes); // Ambassador program
app.use("/api/certificate", certificateRoutes); // Certificate verification
app.use("/certificate", certificateRoutes); // Direct alias

// 🟢 Admin Panel Static Serving
app.use('/admin', express.static(path.join(__dirname, '../admin2/dist')));
app.get(['/admin', /^\/admin\/.*/], (req, res) => {
  res.sendFile(path.join(__dirname, '../admin2/dist', 'index.html'));
});

// 🟢 Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
