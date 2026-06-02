const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

/**
 * Seeds the super-admin employee from environment variables on startup.
 * Only runs if ADMIN_ID and ADMIN_PASS are set in .env AND no admin employee
 * with adminAccess=true already exists in the database.
 *
 * Credentials are NEVER stored in code — they live exclusively in .env.
 */
async function seedAdminIfMissing() {
  const adminId   = String(process.env.ADMIN_ID   || '').trim();
  const adminPass = String(process.env.ADMIN_PASS  || '').trim();
  const adminName = String(process.env.ADMIN_NAME  || 'Super Admin').trim();

  if (!adminId || !adminPass) {
    console.warn('[seedAdmin] ADMIN_ID or ADMIN_PASS not set in .env — skipping admin seed.');
    return;
  }

  // Check if any admin-access employee already exists
  const existingAdmin = await Employee.findOne({ adminAccess: true });
  if (existingAdmin) {
    console.log(`[seedAdmin] Admin employee already exists (${existingAdmin.empId}) — skipping seed.`);
    return;
  }

  // Check if the specific ADMIN_ID already exists (even without adminAccess)
  const existingById = await Employee.findOne({ empId: adminId });
  if (existingById) {
    // Promote it to admin if somehow adminAccess was false
    if (!existingById.adminAccess) {
      existingById.adminAccess = true;
      existingById.accountStatus = 'active';
      existingById.employmentStatus = 'active';
      await existingById.save();
      console.log(`[seedAdmin] Promoted existing employee ${adminId} to admin.`);
    }
    return;
  }

  // Create the super-admin employee
  const passwordHash = await bcrypt.hash(adminPass, 12);
  await Employee.create({
    empId: adminId,
    name: adminName,
    passwordHash,
    adminAccess: true,
    accountStatus: 'active',
    employmentStatus: 'active',
  });

  console.log(`[seedAdmin] ✅ Super-admin created with ID: ${adminId}`);
  console.log('[seedAdmin] ⚠️  Change ADMIN_PASS in .env after first login.');
}

module.exports = seedAdminIfMissing;
