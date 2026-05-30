const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const { getRequestMetadata } = require('../utils/auth/requestMetadata');
const { generateSessionIdentifiers, signSessionJwt } = require('../utils/auth/jwtSession');
const { createSessionOwnership } = require('../services/sessionOwnershipService');
const { logAuthEvent } = require('../services/authAuditService');
const sendEmail = require('../utils/sendEmail');
const SystemSetting = require('../models/SystemSetting');

// Employee login using empId and password
exports.login = async (req, res) => {
  try {
    const { empId, password } = req.body || {};
    const metadata = getRequestMetadata(req);

    if (!empId || !password) return res.status(400).json({ msg: 'empId and password are required' });

    const employee = await Employee.findOne({ empId: String(empId).trim() });
    if (!employee) {
      await logAuthEvent({ actorUserId: String(empId || 'unknown'), actorRole: 'employee', action: 'login_failed', ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadata: { reason: 'employee_not_found' } });
      return res.status(404).json({ msg: 'Employee not found' });
    }

    if (employee.accountStatus !== 'active') {
      await logAuthEvent({ actorUserId: employee.empId, actorRole: 'employee', action: employee.accountStatus === 'locked' ? 'account_locked' : 'account_disabled', ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadata: { status: employee.accountStatus } });
      return res.status(403).json({ msg: `Account status: ${employee.accountStatus}. Login blocked.` });
    }

    const passwordOk = employee.passwordHash ? await bcrypt.compare(password, employee.passwordHash) : false;
    if (!passwordOk) {
      await logAuthEvent({ actorUserId: employee.empId, actorRole: 'employee', action: 'login_failed', ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadata: { reason: 'invalid_credentials' } });
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const { sessionId, jti } = generateSessionIdentifiers();
    try {
      const session = await createSessionOwnership({ userId: `employee:${employee.empId}`, role: 'employee', metadata: { ...metadata, operatorName: employee.name }, providedSessionId: sessionId, providedJti: jti });

      const token = signSessionJwt({ claims: { id: `employee:${employee.empId}`, role: 'employee', name: employee.name }, sessionId, jti, expiresIn: '7d' });

      await logAuthEvent({ actorUserId: `employee:${employee.empId}`, actorRole: 'employee', action: 'login_success', targetSessionId: session.sessionId, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadata: { deviceHash: metadata.deviceHash, deviceLabel: metadata.deviceLabel } });

      res.json({ token, msg: 'Login successful', session: { session_id: session.sessionId, jti: session.jti, expires_at: session.expiresAt, device_label: session.deviceLabel } });
    } catch (err) {
      if (err && err.code === 'MAX_SESSIONS_EXCEEDED') {
        // Send email alert to admin-configured recipient
        try {
          const recipient = (await SystemSetting.get('alerts.email')) || process.env.SESSION_ALERT_EMAIL;
          const locationParts = [metadata.geoCity, metadata.geoState, metadata.geoCountry].filter(Boolean).join(', ');
          const emailBody = `Third session attempt blocked for employee ${employee.empId} (${employee.name})\nTime: ${new Date().toISOString()}\nIP: ${metadata.ipAddress}\nUserAgent: ${metadata.userAgent}\nDevice: ${metadata.deviceLabel}\nPlatform: ${metadata.platform}\nBrowser: ${metadata.browser}\nLocation: ${locationParts || 'Unknown'}\nEmployee Status: ${employee.accountStatus || 'active'}`;
          if (recipient) await sendEmail({ to: recipient, subject: `Security Alert: Third Session Attempt - ${employee.empId}`, text: emailBody });
        } catch (e) {
          console.warn('Failed to send session-limit alert email', e && e.message);
        }

        return res.status(429).json({ msg: 'Maximum active sessions reached. Please terminate an existing session before logging in.', code: 'MAX_SESSIONS_EXCEEDED' });
      }

      console.error('Employee login error:', err && err.message);
      res.status(500).json({ msg: 'Server error' });
    }
  } catch (err) {
    console.error('Employee login error:', err && err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};
