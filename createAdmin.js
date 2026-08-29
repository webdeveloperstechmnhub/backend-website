require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('./models/Employee');

async function seedAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const empId = 'ADMIN-2026';
  const password = 'password123';
  
  const existing = await Employee.findOne({ empId });
  if (existing) {
    console.log('Admin already exists.');
    process.exit(0);
  }
  
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  const admin = new Employee({
    empId,
    name: 'Super Admin',
    email: 'admin@techmnhub.in',
    passwordHash,
    adminAccess: true,
    role: 'super_admin',
    permissions: ['*'],
    accountStatus: 'active',
    employmentStatus: 'active',
    designation: 'System Administrator'
  });
  
  await admin.save();
  console.log('Successfully created Super Admin: ADMIN-2026 / password123');
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
