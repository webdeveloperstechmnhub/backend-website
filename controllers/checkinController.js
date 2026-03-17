const User = require("../models/User");

// Verify ticket/registration
exports.verifyRegistration = async (req, res) => {
  try {
    const { registrationId } = req.body;

    if (!registrationId) {
      return res.status(400).json({ msg: "Registration ID required" });
    }

    const user = await User.findOne({ registrationId });

    if (!user) {
      return res.status(404).json({ msg: "Registration not found" });
    }

    if (user.checkedIn) {
      return res.status(200).json({
        msg: "Already checked in",
        user,
        alreadyCheckedIn: true,
      });
    }

    res.json({ msg: "Registration verified", user });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Check in participant
exports.checkInParticipant = async (req, res) => {
  try {
    const { registrationId, userId } = req.body;

    if (!registrationId && !userId) {
      return res.status(400).json({ msg: "Registration ID or User ID required" });
    }

    let user = userId
      ? await User.findById(userId)
      : await User.findOne({ registrationId });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.checkedIn) {
      return res.status(400).json({ msg: "Already checked in" });
    }

    user.checkedIn = true;
    user.checkInTime = new Date();
    await user.save();

    console.log(`✅ Check-in: ${user.fullName} (${user.registrationId})`);

    res.json({ msg: "Check-in successful", user, checkedInAt: user.checkInTime });

  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Get check-in statistics (optionally filtered by eventId query param)
exports.getCheckinStats = async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = eventId ? { eventId } : {};

    const total = await User.countDocuments(filter);
    const checkedIn = await User.countDocuments({ ...filter, checkedIn: true });
    const pending = total - checkedIn;

    res.json({
      total,
      checkedIn,
      pending,
      checkinPercentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
    });

  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ msg: err.message });
  }
};

module.exports = exports;
