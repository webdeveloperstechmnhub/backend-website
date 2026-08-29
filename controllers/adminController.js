const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const AccountUser = require('../models/AccountUser');
const Institute = require('../models/Institute');
const StudentSignup = require('../models/StudentSignup');
const ContactMessage = require('../models/ContactMessage');
const sendEmail = require('../utils/sendEmail');
const { cloneDatabaseBetweenUris, exportDatabaseData, inferDbName } = require('../utils/databaseCloner');const { listDatabaseOverview, getCollectionPreview } = require('../utils/databaseInspector');
const { generateSessionIdentifiers, signSessionJwt } = require('../utils/auth/jwtSession');
const { getRequestMetadata } = require('../utils/auth/requestMetadata');
const { createSessionOwnership } = require('../services/sessionOwnershipService');
const { logAuthEvent } = require('../services/authAuditService');
const SystemSetting = require('../models/SystemSetting');

const INSTITUTE_TYPES = new Set(['School', 'College', 'Coaching', 'Academy']);

const generateStrongPassword = (length = 12) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%&*';
  return Array.from({ length })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join('');
};

// @desc    Admin Login
exports.login = async (req, res) => {
  try {
    const { empId, password, operatorName } = req.body;
    const metadata = getRequestMetadata(req);
    const normalizedEmpId = String(empId || '').trim();

    const TelemetryFilter = require('../models/TelemetryFilter');
    const AuthAuditLog = require('../models/AuthAuditLog');
    const clientIp = metadata.ipAddress || req.ip || '';
    const isBanned = await TelemetryFilter.findOne({
      active: true,
      $or: [
        { filterKey: clientIp, filterType: 'ip' },
        { filterKey: normalizedEmpId, filterType: 'user' }
      ]
    });

    if (isBanned) {
      return res.status(403).json({ msg: 'Access restriction active. Connection suspended.' });
    }
    if (!normalizedEmpId || !password) {
      return res.status(400).json({ msg: 'adminId and password are required' });
    }

    const isSuperAdmin = (normalizedEmpId === String(process.env.ADMIN_ID || '').trim());
    let adminEmployee;
    let passwordOk = false;
    let role = 'admin';
    let permissions = [];
    const adminUserId = `admin:${normalizedEmpId || 'unknown'}`;

    const handleFailedLogin = async (actorUserId, reason) => {
      await logAuthEvent({
        actorUserId,
        actorRole: isSuperAdmin ? 'admin' : 'employee',
        action: 'login_failed',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { reason },
      });

      const since = new Date(Date.now() - 15 * 60 * 1000);
      const failedCount = await AuthAuditLog.countDocuments({
        actorUserId,
        action: 'login_failed',
        createdAt: { $gte: since }
      });

      if (failedCount >= 3) {
        try {
          const recipient = (await SystemSetting.get('alerts.email')) || process.env.EMAIL;
          const emailBody = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
              <h2>Security Alert: Multiple Failed Login Attempts</h2>
              <p><strong>User ID Entered:</strong> ${normalizedEmpId}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              <p><strong>IP Address:</strong> ${metadata.ipAddress || req.ip || 'Unknown'}</p>
              <p><strong>User Agent:</strong> ${metadata.userAgent || 'Unknown'}</p>
              <p><strong>Platform:</strong> ${metadata.platform || 'Unknown'}</p>
              <p><strong>Browser:</strong> ${metadata.browser || 'Unknown'}</p>
            </div>
          `;
          if (recipient) {
            await sendEmail({
              to: recipient,
              subject: `Security Alert: Multiple Failed Login Attempts - ${normalizedEmpId}`,
              html: emailBody
            });
            console.log(`[FailedLoginMonitoring] Security alert email sent to ${recipient}`);
          }
        } catch (e) {
          console.warn('Failed to send security alert email', e.message);
        }
      }
    };

    if (isSuperAdmin) {
      passwordOk = (password === String(process.env.ADMIN_PASS || '').trim());
      role = 'super_admin';
      permissions = ['*'];
      if (!passwordOk) {
        await handleFailedLogin(adminUserId, 'invalid_credentials');
        return res.status(401).json({ msg: 'Invalid credentials' });
      }
    } else {
      adminEmployee = await Employee.findOne({ empId: normalizedEmpId });

      if (!adminEmployee) {
        await handleFailedLogin(adminUserId, 'admin_employee_not_found');
        return res.status(404).json({ msg: 'Admin not found' });
      }

      if (!adminEmployee.adminAccess) {
        await handleFailedLogin(adminUserId, 'admin_access_denied');
        return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
      }

      if (adminEmployee.accountStatus !== 'active' || adminEmployee.employmentStatus !== 'active') {
        await handleFailedLogin(adminEmployee.empId, 'account_locked_or_disabled');
        return res.status(403).json({ msg: `Account status: ${adminEmployee.accountStatus}. Login blocked.` });
      }

      passwordOk = adminEmployee.passwordHash ? await bcrypt.compare(password, adminEmployee.passwordHash) : false;
      if (!passwordOk) {
        await handleFailedLogin(adminUserId, 'invalid_credentials');
        return res.status(401).json({ msg: 'Invalid credentials' });
      }

      role = adminEmployee.role || 'admin';
      permissions = adminEmployee.permissions || [];
    }

    const { sessionId, jti } = generateSessionIdentifiers();
    const session = await createSessionOwnership({
      userId: adminUserId,
      role: role,
      metadata: {
        ...metadata,
        employeeId: isSuperAdmin ? normalizedEmpId : adminEmployee.empId,
        employeeName: isSuperAdmin ? 'Super Admin' : adminEmployee.name,
        employeeEmail: isSuperAdmin ? 'admin@techmnhub.com' : adminEmployee.email,
        operatorName: String(operatorName || 'System Admin').trim(),
      },
      providedSessionId: sessionId,
      providedJti: jti,
    });

    const token = signSessionJwt({
      claims: {
        id: adminUserId,
        empId: isSuperAdmin ? normalizedEmpId : adminEmployee.empId,
        email: isSuperAdmin ? 'admin@techmnhub.com' : (adminEmployee.email || ''),
        name: isSuperAdmin ? 'Super Admin' : adminEmployee.name,
        role: role,
        permissions: permissions,
        operatorName: String(operatorName || 'System Admin').trim(),
      },
      sessionId,
      jti,
      expiresIn: '7d',
    });

    await logAuthEvent({
      actorUserId: adminUserId,
      actorRole: role,
      action: 'login_success',
      targetSessionId: sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        deviceHash: metadata.deviceHash,
        deviceLabel: metadata.deviceLabel,
        employeeId: isSuperAdmin ? normalizedEmpId : adminEmployee.empId,
        employeeName: isSuperAdmin ? 'Super Admin' : adminEmployee.name,
        operatorName: String(operatorName || 'System Admin').trim(),
      },
    });

    try {
      const sessionManager = require('../utils/sessionManagerClient');
      sessionManager.createSession({
        userId: adminUserId,
        role: role,
        sessionId,
        jti,
        ip: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceHash: metadata.deviceHash,
        loginAt: new Date().toISOString(),
        metadata: {
          employeeId: isSuperAdmin ? normalizedEmpId : adminEmployee.empId,
          employeeName: isSuperAdmin ? 'Super Admin' : adminEmployee.name,
          operatorName: String(operatorName || 'System Admin').trim(),
        }
      });
    } catch (err) {
      console.warn('[adminController] session-manager notify failed', err && err.message);
    }

    res.json({
      token,
      msg: 'Login successful',
      session: {
        session_id: session.sessionId,
        jti: session.jti,
        expires_at: session.expiresAt,
        device_label: session.deviceLabel,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get system settings (admin)
exports.getSystemSettings = async (req, res) => {
  try {
    const keys = ['alerts.email'];
    const result = {};
    for (const key of keys) {
      result[key] = await SystemSetting.get(key);
    }
    res.json({ ok: true, settings: result });
  } catch (err) {
    console.error('getSystemSettings error:', err);
    res.status(500).json({ ok: false, msg: 'Failed to load settings.' });
  }
};

// Set a system setting (admin)
exports.setSystemSetting = async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ ok: false, msg: 'key required' });
    const updated = await SystemSetting.set(String(key), value);
    res.json({ ok: true, key, value: updated });
  } catch (err) {
    console.error('setSystemSetting error:', err);
    res.status(500).json({ ok: false, msg: 'Failed to save setting.' });
  }
};

// @desc    Get all participants
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Check-in user
exports.checkInUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (user.checkedIn) {
      return res.status(400).json({ msg: 'Already checked in' });
    }

    user.checkedIn = true;
    user.checkInTime = new Date();
    await user.save();

    res.json({ msg: 'Check-in successful', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get dashboard stats
exports.getStats = async (req, res) => {
  try {
    const total = await User.countDocuments();
    const paid = await User.countDocuments({ paymentStatus: 'paid' });
    const pending = await User.countDocuments({ paymentStatus: 'pending' });
    const checkedIn = await User.countDocuments({ checkedIn: true });
    
    // Category wise stats
    const categoryStats = await User.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Daily registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      total,
      paid,
      pending,
      checkedIn,
      categoryStats,
      dailyRegistrations
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get overall company growth analytics
exports.getCompanyGrowthAnalytics = async (req, res) => {
  try {
    const Ambassador = require('../models/Ambassador');
    const SessionBooking = require('../models/SessionBooking');
    const AmbassadorReferral = require('../models/AmbassadorReferral');

    // Aggregate monthly data
    const usersMonthly = await User.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
          paidCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amountPaid", 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const studentsMonthly = await StudentSignup.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const ambassadorsMonthly = await Ambassador.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const institutesMonthly = await Institute.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const sessionsMonthly = await SessionBooking.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
          studentsReached: { $sum: "$students" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const messagesMonthly = await ContactMessage.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build unique list of all months involved, default to last 6 months if none
    const months = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    const allAggregatedMonths = [
      ...usersMonthly.map(r => r._id),
      ...studentsMonthly.map(r => r._id),
      ...ambassadorsMonthly.map(r => r._id),
      ...institutesMonthly.map(r => r._id),
      ...sessionsMonthly.map(r => r._id),
      ...messagesMonthly.map(r => r._id)
    ].filter(Boolean);

    let startMonth = months[0];
    if (allAggregatedMonths.length > 0) {
      allAggregatedMonths.sort();
      if (allAggregatedMonths[0] < startMonth) {
        startMonth = allAggregatedMonths[0];
      }
    }

    const endYearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Get previous month string
    const prevDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const monthsRange = [];
    let currentYM = startMonth;
    while (currentYM <= endYearMonth) {
      monthsRange.push(currentYM);
      const [yearStr, monthStr] = currentYM.split('-');
      let year = parseInt(yearStr);
      let month = parseInt(monthStr);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      currentYM = `${year}-${String(month).padStart(2, '0')}`;
    }

    // Build timeline
    let cumulativeUsers = 0;
    let cumulativeRevenue = 0;
    let cumulativeStudents = 0;
    let cumulativeAmbassadors = 0;
    let cumulativeInstitutes = 0;
    let cumulativeSessions = 0;
    let cumulativeLeads = 0;

    const timeline = monthsRange.map(month => {
      const userRec = usersMonthly.find(r => r._id === month) || { count: 0, paidCount: 0, revenue: 0 };
      const studentRec = studentsMonthly.find(r => r._id === month) || { count: 0 };
      const ambRec = ambassadorsMonthly.find(r => r._id === month) || { count: 0 };
      const instRec = institutesMonthly.find(r => r._id === month) || { count: 0 };
      const sessRec = sessionsMonthly.find(r => r._id === month) || { count: 0, studentsReached: 0 };
      const msgRec = messagesMonthly.find(r => r._id === month) || { count: 0 };

      cumulativeUsers += userRec.count;
      cumulativeRevenue += userRec.revenue;
      cumulativeStudents += studentRec.count;
      cumulativeAmbassadors += ambRec.count;
      cumulativeInstitutes += instRec.count;
      cumulativeSessions += sessRec.count;
      cumulativeLeads += msgRec.count;

      return {
        month,
        newRegistrations: userRec.count,
        cumulativeRegistrations: cumulativeUsers,
        newRevenue: userRec.revenue,
        cumulativeRevenue: cumulativeRevenue,
        newStudentSignups: studentRec.count,
        cumulativeStudentSignups: cumulativeStudents,
        newAmbassadors: ambRec.count,
        cumulativeAmbassadors: cumulativeAmbassadors,
        newInstitutes: instRec.count,
        cumulativeInstitutes: cumulativeInstitutes,
        newSessions: sessRec.count,
        cumulativeSessions: cumulativeSessions,
        studentsReached: sessRec.studentsReached || 0,
        newLeads: msgRec.count,
        cumulativeLeads: cumulativeLeads
      };
    });

    // Compute absolute metrics
    const totalUsers = await User.countDocuments();
    const paidUsers = await User.countDocuments({ paymentStatus: "paid" });
    const checkedInUsers = await User.countDocuments({ checkedIn: true });
    const revenueSum = await User.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } }
    ]);
    const totalRevenue = revenueSum[0]?.total || 0;

    const totalStudents = await StudentSignup.countDocuments();
    const approvedStudents = await StudentSignup.countDocuments({ status: "approved" });
    const pendingStudents = await StudentSignup.countDocuments({ status: "pending" });

    const totalAmbassadors = await Ambassador.countDocuments();
    const ambPointsSum = await Ambassador.aggregate([
      { $group: { _id: null, total: { $sum: "$points" } } }
    ]);
    const totalAmbassadorPoints = ambPointsSum[0]?.total || 0;

    const referralsSum = await AmbassadorReferral.aggregate([
      { $group: { _id: null, total: { $sum: "$referralCount" } } }
    ]);
    const totalReferrals = referralsSum[0]?.total || 0;

    const totalInstitutes = await Institute.countDocuments();
    const instituteTypes = await Institute.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    const totalSessions = await SessionBooking.countDocuments();
    const sessionAudienceSum = await SessionBooking.aggregate([
      { $match: { status: { $in: ["confirmed", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$students" } } }
    ]);
    const totalAudienceReached = sessionAudienceSum[0]?.total || 0;

    const sessionsStatus = await SessionBooking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const totalLeads = await ContactMessage.countDocuments();
    const leadSources = await ContactMessage.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } }
    ]);

    // Top colleges by signups
    const topColleges = await StudentSignup.aggregate([
      { $group: { _id: "$college", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Event category-wise stats (from User paid records)
    const categoryStats = await User.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // MoM growth calculations
    let curMonthData = timeline.find(t => t.month === endYearMonth);
    let prevMonthData = timeline.find(t => t.month === prevMonthStr);

    if (!curMonthData && timeline.length > 0) {
      curMonthData = timeline[timeline.length - 1];
      prevMonthData = timeline.length > 1 ? timeline[timeline.length - 2] : null;
    }

    const getGrowth = (cur, prev) => {
      if (!prev) return 0;
      return Number((((cur - prev) / (prev || 1)) * 100).toFixed(1));
    };

    const momGrowth = {
      registrations: getGrowth(curMonthData?.newRegistrations || 0, prevMonthData?.newRegistrations || 0),
      revenue: getGrowth(curMonthData?.newRevenue || 0, prevMonthData?.newRevenue || 0),
      studentSignups: getGrowth(curMonthData?.newStudentSignups || 0, prevMonthData?.newStudentSignups || 0),
      ambassadors: getGrowth(curMonthData?.newAmbassadors || 0, prevMonthData?.newAmbassadors || 0),
      sessions: getGrowth(curMonthData?.newSessions || 0, prevMonthData?.newSessions || 0),
      leads: getGrowth(curMonthData?.newLeads || 0, prevMonthData?.newLeads || 0),
    };

    res.json({
      kpis: {
        registrations: {
          total: totalUsers,
          paid: paidUsers,
          checkedIn: checkedInUsers,
          conversionRate: totalUsers ? Number(((paidUsers / totalUsers) * 100).toFixed(1)) : 0,
          attendanceRate: paidUsers ? Number(((checkedInUsers / paidUsers) * 100).toFixed(1)) : 0,
          momGrowth: momGrowth.registrations
        },
        revenue: {
          total: totalRevenue,
          momGrowth: momGrowth.revenue
        },
        students: {
          total: totalStudents,
          approved: approvedStudents,
          pending: pendingStudents,
          momGrowth: momGrowth.studentSignups
        },
        ambassadors: {
          total: totalAmbassadors,
          totalPoints: totalAmbassadorPoints,
          totalReferrals: totalReferrals,
          momGrowth: momGrowth.ambassadors
        },
        sessions: {
          total: totalSessions,
          audienceReached: totalAudienceReached,
          momGrowth: momGrowth.sessions
        },
        leads: {
          total: totalLeads,
          momGrowth: momGrowth.leads
        }
      },
      timeline,
      breakdowns: {
        topColleges: topColleges.map(c => ({ college: c._id || "Unknown", count: c.count })),
        categories: categoryStats.map(c => ({ category: c._id || "General/Other", count: c.count })),
        instituteTypes: instituteTypes.map(i => ({ type: i._id || "Other", count: i.count })),
        sessionStatus: sessionsStatus.map(s => ({ status: s._id || "pending", count: s.count })),
        leadSources: leadSources.map(l => ({ source: l._id || "website", count: l.count }))
      }
    });

  } catch (err) {
    console.error("getCompanyGrowthAnalytics error:", err);
    res.status(500).json({ msg: "Server error calculating analytics" });
  }
};

// @desc    Get student signup requests
exports.getStudentSignups = async (req, res) => {
  try {
    const status = String(req.query?.status || '').trim().toLowerCase();
    const search = String(req.query?.q || '').trim();

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { college: regex },
        { year: regex },
        { city: regex },
        { interests: regex },
      ];
    }

    const signups = await StudentSignup.find(query).sort({ createdAt: -1 });
    res.json(signups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Update student signup status
exports.reviewStudentSignup = async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim().toLowerCase();
    const decisionNote = String(req.body?.decisionNote || '').trim();

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid student signup status.' });
    }

    const signup = await StudentSignup.findById(req.params.id);
    if (!signup) {
      return res.status(404).json({ msg: 'Student signup not found.' });
    }

    signup.status = status;
    signup.reviewedAt = new Date();
    signup.reviewedBy = req.admin?.email || 'admin';
    signup.decisionNote = decisionNote;

    if (status === 'approved') {
      signup.approvedAt = new Date();
      signup.rejectedAt = undefined;

      // Send approval email
      const subject = 'Your TechMNHub Student Signup Approved'
      const html = `
        <h2>Congratulations!</h2>
        <p>Your student signup has been approved.</p>
        <p>You can now log in to your student dashboard.</p>
        <p>Welcome to TechMNHub!</p>
      `
      sendEmail({
        to: signup.email,
        subject: subject,
        html: html
      })
    } else if (status === 'rejected') {
      signup.rejectedAt = new Date();
      signup.approvedAt = undefined;
    } else {
      signup.approvedAt = undefined;
      signup.rejectedAt = undefined;
    }

    await signup.save();

    res.json({
      msg: `Student signup ${status}.`,
      signup,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get contact/join messages
exports.getContactMessages = async (req, res) => {
  try {
    const status = String(req.query?.status || '').trim().toLowerCase();
    const source = String(req.query?.source || '').trim().toLowerCase();
    const search = String(req.query?.q || '').trim();

    const query = {};

    if (status && status !== 'all') {
      query.emailStatus = status;
    }

    if (source && source !== 'all') {
      query.source = source;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { details: regex },
      ];
    }

    const messages = await ContactMessage.find(query).sort({ createdAt: -1 }).limit(300);
    return res.json(messages);
  } catch (err) {
    console.error('Get contact messages error:', err);
    return res.status(500).json({ msg: 'Failed to load contact messages.' });
  }
};

// @desc    Clone a source database into a destination database
exports.cloneDatabaseToCurrentDb = async (req, res) => {
  try {
    const sourceUri = String(req.body?.sourceUri || '').trim();
    const sourceDbNameInput = String(req.body?.sourceDbName || '').trim();
    const destinationUri = String(req.body?.destinationUri || '').trim();
    const destinationDbNameInput = String(req.body?.destinationDbName || '').trim();
    const collectionsInput = req.body?.collections;

    const selectedCollections = Array.isArray(collectionsInput)
      ? collectionsInput.map((name) => String(name || '').trim()).filter(Boolean)
      : [];

    if (!sourceUri || !destinationUri) {
      return res.status(400).json({ msg: 'Both source and destination MongoDB URIs are required.' });
    }

    const sourceDbName = sourceDbNameInput || inferDbName(sourceUri);
    const destinationDbName = destinationDbNameInput || inferDbName(destinationUri);

    if (!sourceDbName) {
      return res.status(400).json({ msg: 'Source database name is required when the source URI does not include one.' });
    }

    if (!destinationDbName) {
      return res.status(400).json({ msg: 'Destination database name is required when the destination URI does not include one.' });
    }

    if (sourceUri === destinationUri && sourceDbName === destinationDbName) {
      return res.status(400).json({ msg: 'Source and destination point to the same database.' });
    }

    const result = await cloneDatabaseBetweenUris({
      sourceUri,
      sourceDbName,
      destinationUri,
      destinationDbName,
      selectedCollections,
    });

    res.json({
      msg: 'Database clone completed successfully.',
      ...result,
    });
  } catch (err) {
    console.error('Database clone error:', err);
    res.status(500).json({ msg: err.message || 'Failed to clone database.' });
  }
};

// @desc    Export source database data as JSON payload
exports.exportDatabaseData = async (req, res) => {
  try {
    const sourceUri = String(req.body?.sourceUri || '').trim();
    const sourceDbNameInput = String(req.body?.sourceDbName || '').trim();
    const collectionsInput = req.body?.collections;

    const selectedCollections = Array.isArray(collectionsInput)
      ? collectionsInput.map((name) => String(name || '').trim()).filter(Boolean)
      : [];

    if (!sourceUri) {
      return res.status(400).json({ msg: 'Source MongoDB URI is required.' });
    }

    const sourceDbName = sourceDbNameInput || inferDbName(sourceUri);

    if (!sourceDbName) {
      return res.status(400).json({ msg: 'Source database name is required when the source URI does not include one.' });
    }

    const result = await exportDatabaseData({
      sourceUri,
      sourceDbName,
      selectedCollections,
    });

    res.json({
      msg: 'Data export prepared successfully.',
      ...result,
    });
  } catch (err) {
    console.error('Database export error:', err);
    res.status(500).json({ msg: err.message || 'Failed to export database data.' });
  }
};

// @desc    List databases and their collections for a source MongoDB URI
exports.getDatabaseOverview = async (req, res) => {
  try {
    const sourceUri = String(req.body?.sourceUri || '').trim();

    if (!sourceUri) {
      return res.status(400).json({ msg: 'Source MongoDB URI is required.' });
    }

    const overview = await listDatabaseOverview(sourceUri);
    res.json(overview);
  } catch (err) {
    console.error('Database overview error:', err);
    res.status(500).json({ msg: err.message || 'Failed to load database overview.' });
  }
};

// @desc    Preview documents from a collection
exports.getDatabaseCollectionPreview = async (req, res) => {
  try {
    const sourceUri = String(req.body?.sourceUri || '').trim();
    const databaseName = String(req.body?.databaseName || '').trim();
    const collectionName = String(req.body?.collectionName || '').trim();
    const limit = Number(req.body?.limit || 10);

    if (!sourceUri) {
      return res.status(400).json({ msg: 'Source MongoDB URI is required.' });
    }

    const preview = await getCollectionPreview(sourceUri, databaseName, collectionName, limit);
    res.json(preview);
  } catch (err) {
    console.error('Collection preview error:', err);
    res.status(500).json({ msg: err.message || 'Failed to load collection preview.' });
  }
};

// @desc    Admin creates institute account manually
exports.createInstituteAccount = async (req, res) => {
  try {
    const instituteName = String(req.body?.instituteName || '').trim();
    const type = String(req.body?.type || '').trim();
    const address = String(req.body?.address || '').trim();
    const city = String(req.body?.city || '').trim();
    const contactPerson = String(req.body?.contactPerson || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const autoGeneratePassword = Boolean(req.body?.autoGeneratePassword);
    const manualPassword = String(req.body?.password || '').trim();

    if (!instituteName || !address || !city || !contactPerson || !phone || !email || !type) {
      return res.status(400).json({ msg: 'Please fill all required institute and login fields.' });
    }

    if (!INSTITUTE_TYPES.has(type)) {
      return res.status(400).json({ msg: 'Invalid institute type provided.' });
    }

    const finalPassword = autoGeneratePassword ? generateStrongPassword(12) : manualPassword;

    if (!finalPassword || finalPassword.length < 8) {
      return res.status(400).json({ msg: 'Password must be at least 8 characters long.' });
    }

    const existingAccount = await AccountUser.findOne({ email });
    if (existingAccount) {
      return res.status(409).json({ msg: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(finalPassword, 12);

    const accountUser = await AccountUser.create({
      email,
      passwordHash,
      role: 'institute',
      verified: true,
      createdByAdminEmail: req.admin?.email || '',
    });

    const institute = await Institute.create({
      user_id: accountUser._id,
      instituteName,
      type,
      address,
      city,
      contactPerson,
      phone,
      verified: true,
    });

    return res.status(201).json({
      msg: 'Institute account created successfully.',
      user: {
        id: accountUser._id,
        email: accountUser.email,
        role: accountUser.role,
        verified: accountUser.verified,
      },
      institute: {
        id: institute._id,
        instituteName: institute.instituteName,
        type: institute.type,
      },
      credentials: {
        email,
        password: finalPassword,
      },
    });
  } catch (err) {
    console.error('Create institute account error:', err);
    return res.status(500).json({ msg: 'Failed to create institute account.' });
  }
};

// @desc    Admin gets all institute accounts
exports.getInstitutes = async (req, res) => {
  try {
    const institutes = await Institute.find({ deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .populate({
        path: 'user_id',
        select: 'email role verified createdAt',
      });

    const normalized = institutes.map((item) => ({
      _id: item._id,
      instituteName: item.instituteName,
      type: item.type,
      address: item.address,
      city: item.city,
      contactPerson: item.contactPerson,
      phone: item.phone,
      verified: item.verified,
      createdAt: item.createdAt,
      account: item.user_id
        ? {
            _id: item.user_id._id,
            email: item.user_id.email,
            role: item.user_id.role,
            verified: item.user_id.verified,
            createdAt: item.user_id.createdAt,
          }
        : null,
    }));

    return res.json(normalized);
  } catch (err) {
    console.error('Get institutes error:', err);
    return res.status(500).json({ msg: 'Failed to load institutes.' });
  }
};

// @desc    Admin updates institute account details and credentials
exports.updateInstitute = async (req, res) => {
  try {
    const { id } = req.params;
    const { instituteName, type, address, city, contactPerson, phone, email, password } = req.body;

    if (!instituteName || !address || !city || !contactPerson || !phone || !email || !type) {
      return res.status(400).json({ msg: 'Please fill all required institute and login fields.' });
    }

    if (!INSTITUTE_TYPES.has(type)) {
      return res.status(400).json({ msg: 'Invalid institute type provided.' });
    }

    const institute = await Institute.findById(id);
    if (!institute) {
      return res.status(404).json({ msg: 'Institute not found.' });
    }

    const accountUser = await AccountUser.findById(institute.user_id);
    if (accountUser) {
      if (email.toLowerCase() !== accountUser.email.toLowerCase()) {
        const emailTaken = await AccountUser.findOne({ email: email.toLowerCase() });
        if (emailTaken) {
          return res.status(409).json({ msg: 'An account with this email already exists.' });
        }
        accountUser.email = email.toLowerCase();
      }

      if (password && password.length >= 8) {
        accountUser.passwordHash = await bcrypt.hash(password, 12);
      }
      await accountUser.save();
    }

    institute.instituteName = instituteName;
    institute.type = type;
    institute.address = address;
    institute.city = city;
    institute.contactPerson = contactPerson;
    institute.phone = phone;
    await institute.save();

    return res.json({ msg: 'Institute updated successfully.', institute });
  } catch (err) {
    console.error('Update institute error:', err);
    return res.status(500).json({ msg: 'Failed to update institute.' });
  }
};

// @desc    Admin soft deletes institute account
exports.deleteInstitute = async (req, res) => {
  try {
    const { id } = req.params;

    const institute = await Institute.findById(id);
    if (!institute) {
      return res.status(404).json({ msg: 'Institute not found.' });
    }

    institute.deleted = true;
    await institute.save();

    const accountUser = await AccountUser.findById(institute.user_id);
    if (accountUser) {
      accountUser.verified = false;
      await accountUser.save();

      const { revokeAllSessionsForUser } = require("../services/sessionOwnershipService");
      await revokeAllSessionsForUser(String(accountUser._id), {
        reason: "Institute account deleted by administrator",
        actorUserId: req.admin?.email || "admin",
        actorRole: "admin",
      });
    }

    return res.json({ msg: 'Institute deleted successfully.' });
  } catch (err) {
    console.error('Delete institute error:', err);
    return res.status(500).json({ msg: 'Failed to delete institute.' });
  }
};