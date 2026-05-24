const User = require('../models/User');
const bcrypt = require('bcryptjs');
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
    const { email, password, operatorName } = req.body;
    const metadata = getRequestMetadata(req);
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const TelemetryFilter = require('../models/TelemetryFilter');
    const clientIp = metadata.ipAddress || req.ip || '';
    const isBanned = await TelemetryFilter.findOne({
      active: true,
      $or: [
        { filterKey: clientIp, filterType: 'ip' },
        { filterKey: normalizedEmail, filterType: 'email' }
      ]
    });

    if (isBanned) {
      return res.status(403).json({ msg: 'Access restriction active. Connection suspended.' });
    }
    const adminUserId = `admin:${normalizedEmail || 'unknown'}`;

    // .env se verify karo
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASS) {
      await logAuthEvent({
        actorUserId: adminUserId,
        actorRole: 'admin',
        action: 'login_failed',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { reason: 'invalid_credentials' },
      });
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const { sessionId, jti } = generateSessionIdentifiers();
    const session = await createSessionOwnership({
      userId: adminUserId,
      role: 'admin',
      metadata: {
        ...metadata,
        operatorName: String(operatorName || 'System Admin').trim(),
      },
      providedSessionId: sessionId,
      providedJti: jti,
    });

    // JWT token generate
    const token = signSessionJwt({
      claims: { id: adminUserId, email, role: 'admin', operatorName: String(operatorName || 'System Admin').trim() },
      sessionId,
      jti,
      expiresIn: '7d',
    });

    await logAuthEvent({
      actorUserId: adminUserId,
      actorRole: 'admin',
      action: 'login_success',
      targetSessionId: sessionId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        deviceHash: metadata.deviceHash,
        deviceLabel: metadata.deviceLabel,
        operatorName: String(operatorName || 'System Admin').trim(),
      },
    });

    // Notify session-manager about the new session (best-effort)
    try {
      const sessionManager = require('../utils/sessionManagerClient');
      sessionManager.createSession({
        userId: adminUserId,
        role: 'admin',
        sessionId,
        jti,
        ip: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceHash: metadata.deviceHash,
        loginAt: new Date().toISOString(),
        metadata: {
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
    const institutes = await Institute.find()
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