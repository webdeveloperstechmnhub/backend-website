require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const generateQR = require('../utils/generateQR');
const sendEmail = require('../utils/sendEmail');
const { buildSummerEmail } = require('../controllers/paymentController');

const emailArg = process.argv[2] || 'tpriyansh973@gmail.com';

(async () => {
  try {
    await connectDB();

    const user = await User.findOne({ email: emailArg });
    if (!user) {
      console.error(`User not found with email: ${emailArg}`);
      process.exit(1);
    }

    console.log(`Found user: ${user.fullName} (${user._id}) — event: ${user.eventShortName}`);

    if (!user.registrationId) {
      console.log('User has no registrationId — generating one');
      user.registrationId = `SUMMER-${Date.now()}`;
    }

    if (!user.qrCode) {
      console.log('Generating QR code for user...');
      user.qrCode = await generateQR(user.registrationId);
      await user.save();
    }

    const { subject, emailHtml } = buildSummerEmail(user);

    console.log(`Sending Summer Camp email to ${user.email}...`);
    const result = await sendEmail({ to: user.email, subject, html: emailHtml });
    console.log('Email send result:', result);

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
