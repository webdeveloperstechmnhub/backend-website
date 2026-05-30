const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const Employee = require('../models/Employee');
const sendEmail = require('../utils/sendEmail');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('Missing MONGO_URI in environment.');
}

const generateStrongPassword = (length = 12) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%&*';
  return Array.from({ length })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join('');
};

async function sendCredentialEmail(employee, password) {
  if (!employee.email) return { emailStatus: 'skipped', emailError: '' };

  try {
    await sendEmail({
      to: employee.email,
      subject: `Employee Credentials Backfill - ${employee.empId}`,
      text: `Employee ID: ${employee.empId}\nName: ${employee.name}\nPassword: ${password}`,
    });
    return { emailStatus: 'sent', emailError: '' };
  } catch (err) {
    return { emailStatus: 'failed', emailError: err.message || 'Email send failed' };
  }
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const employees = await Employee.find({
    $or: [
      { passwordHash: { $exists: false } },
      { passwordHash: '' },
      { passwordHash: null },
    ],
  }).sort({ createdAt: 1 });

  const results = [];
  for (const employee of employees) {
    const password = generateStrongPassword(12);
    employee.passwordHash = await bcrypt.hash(password, 12);
    if (!employee.accountStatus || employee.accountStatus === 'disabled') {
      employee.accountStatus = 'active';
    }
    await employee.save();
    const emailResult = await sendCredentialEmail(employee, password);
    results.push({ empId: employee.empId, email: employee.email, ...emailResult });
  }

  console.log(JSON.stringify({ processed: results.length, results }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
