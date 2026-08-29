require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('./models/Employee');

async function updateAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const empId = process.env.ADMIN_ID || 'ADMIN-2026';
  const password = process.env.ADMIN_PASS || 'WTTS2026@';
  
  const admin = await Employee.findOne({ empId });
  if (admin) {
    const salt = await bcrypt.genSalt(10);
    admin.passwordHash = await bcrypt.hash(password, salt);
    await admin.save();
    console.log('Successfully updated Super Admin password in DB to match .env');
  } else {
    console.log('Admin not found in DB.');
  }
  process.exit(0);
}

updateAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
