const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AccountUser = require('../models/AccountUser');
const Institute = require('../models/Institute');
const User = require('../models/User');
const InstituteActivity = require('../models/InstituteActivity');

const normalizePoints = (user, fallback = 0) => {
  const base = Number(user.amountPaid || 0);
  const checkInBonus = user.checkedIn ? 80 : 0;
  const quantityBonus = Number(user.ticketQuantity || 1) * 20;
  const computed = base + checkInBonus + quantityBonus;
  return computed > 0 ? computed : fallback;
};

// @desc    Institute account login
exports.loginInstitute = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ msg: 'Email and password are required.' });
    }

    const user = await AccountUser.findOne({ email, role: 'institute' });
    if (!user) {
      return res.status(401).json({ msg: 'Invalid credentials.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ msg: 'Invalid credentials.' });
    }

    if (!user.verified) {
      return res.status(403).json({ msg: 'Institute account is not verified yet.' });
    }

    const institute = await Institute.findOne({ user_id: user._id }).select(
      'instituteName type city contactPerson phone verified',
    );

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: 'institute' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return res.json({
      msg: 'Institute login successful.',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      institute,
    });
  } catch (err) {
    console.error('Institute login error:', err);
    return res.status(500).json({ msg: 'Server error while logging in.' });
  }
};

// @desc    Institute profile from token
exports.getInstituteProfile = async (req, res) => {
  try {
    const userId = req.instituteUser?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized institute request.' });
    }

    const institute = await Institute.findOne({ user_id: userId }).select(
      'instituteName type city contactPerson phone verified createdAt',
    );

    if (!institute) {
      return res.status(404).json({ msg: 'Institute profile not found.' });
    }

    return res.json({ institute });
  } catch (err) {
    console.error('Institute profile error:', err);
    return res.status(500).json({ msg: 'Server error while loading institute profile.' });
  }
};

// @desc    Institute dashboard summary
exports.getInstituteSummary = async (req, res) => {
  try {
    const userId = req.instituteUser?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized institute request.' });
    }

    const institute = await Institute.findOne({ user_id: userId }).select('instituteName type city');
    if (!institute) {
      return res.status(404).json({ msg: 'Institute profile not found.' });
    }

    const collegeRegex = new RegExp(institute.instituteName, 'i');
    let matchedStudents = await User.find({ college: collegeRegex }).sort({ createdAt: -1 }).limit(10);

    if (matchedStudents.length === 0) {
      matchedStudents = await User.find().sort({ createdAt: -1 }).limit(10);
    }

    const totalStudents = matchedStudents.length;
    const activeStudents = matchedStudents.filter((item) => item.paymentStatus === 'paid').length;
    const checkedIn = matchedStudents.filter((item) => item.checkedIn).length;
    const participationRate = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;

    const recentFeed = matchedStudents.slice(0, 6).map((item) => ({
      id: item._id,
      student: item.fullName,
      action: item.checkedIn
        ? 'Checked in at event'
        : item.paymentStatus === 'paid'
          ? 'Completed registration payment'
          : 'Started registration process',
      createdAt: item.createdAt,
    }));

    const now = new Date();
    const trend = await Promise.all(
      Array.from({ length: 5 }).map(async (_, index) => {
        const from = new Date(now);
        from.setDate(now.getDate() - (5 - index) * 7);
        const to = new Date(now);
        to.setDate(now.getDate() - (4 - index) * 7);

        const count = await User.countDocuments({
          createdAt: { $gte: from, $lt: to },
          college: collegeRegex,
        });

        return count;
      }),
    );

    const fallbackTrend = [40, 55, 62, 74, 83];

    return res.json({
      institute,
      stats: {
        totalStudents,
        activeStudents,
        checkedIn,
        participationRate,
      },
      recentFeed,
      trend: trend.some((value) => value > 0) ? trend : fallbackTrend,
    });
  } catch (err) {
    console.error('Institute summary error:', err);
    return res.status(500).json({ msg: 'Server error while loading institute summary.' });
  }
};

// @desc    Institute students listing
exports.getInstituteStudents = async (req, res) => {
  try {
    const userId = req.instituteUser?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized institute request.' });
    }

    const institute = await Institute.findOne({ user_id: userId }).select('instituteName');
    if (!institute) {
      return res.status(404).json({ msg: 'Institute profile not found.' });
    }

    const collegeRegex = new RegExp(institute.instituteName, 'i');
    let students = await User.find({ college: collegeRegex }).sort({ createdAt: -1 }).limit(80);

    if (students.length === 0) {
      students = await User.find().sort({ createdAt: -1 }).limit(80);
    }

    const rows = students.map((item, index) => ({
      id: item._id,
      name: item.fullName,
      className: item.courseYear || item.category || 'General',
      points: normalizePoints(item, Math.max(240, 800 - index * 18)),
      status: item.paymentStatus === 'paid' ? 'Active' : 'Inactive',
    }));

    return res.json({ students: rows });
  } catch (err) {
    console.error('Institute students error:', err);
    return res.status(500).json({ msg: 'Server error while loading students.' });
  }
};

// @desc    Public leaderboard data
exports.getLeaderboard = async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(120);

    const ranked = users
      .map((item, index) => ({
        id: item._id,
        name: item.fullName,
        points: normalizePoints(item, Math.max(300, 1200 - index * 12)),
      }))
      .sort((a, b) => b.points - a.points)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    return res.json({ entries: ranked.slice(0, 20) });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ msg: 'Server error while loading leaderboard.' });
  }
};

// @desc    Public activities list
exports.getActivities = async (_req, res) => {
  try {
    const activities = await InstituteActivity.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('title description skill points createdAt');

    return res.json({ activities });
  } catch (err) {
    console.error('Activities fetch error:', err);
    return res.status(500).json({ msg: 'Server error while loading activities.' });
  }
};

// @desc    Institute creates activity
exports.createInstituteActivity = async (req, res) => {
  try {
    const userId = req.instituteUser?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized institute request.' });
    }

    const institute = await Institute.findOne({ user_id: userId }).select('_id');
    if (!institute) {
      return res.status(404).json({ msg: 'Institute profile not found.' });
    }

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const skill = String(req.body?.skill || '').trim();
    const points = Number(req.body?.points || 0);

    if (!title || !description || !skill || !points) {
      return res.status(400).json({ msg: 'Please fill title, description, skill and points.' });
    }

    const activity = await InstituteActivity.create({
      instituteId: institute._id,
      title,
      description,
      skill,
      points,
      createdBy: userId,
    });

    return res.status(201).json({ msg: 'Activity created successfully.', activity });
  } catch (err) {
    console.error('Create activity error:', err);
    return res.status(500).json({ msg: 'Server error while creating activity.' });
  }
};
