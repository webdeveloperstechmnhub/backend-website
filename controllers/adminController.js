const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { cloneDatabaseBetweenUris, exportDatabaseData, inferDbName } = require('../utils/databaseCloner');
const { listDatabaseOverview, getCollectionPreview } = require('../utils/databaseInspector');

// @desc    Admin Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // .env se verify karo
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASS) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    // JWT token generate
    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, msg: 'Login successful' });
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