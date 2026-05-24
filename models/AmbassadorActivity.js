const mongoose = require('mongoose')

const ambassadorActivitySchema = new mongoose.Schema(
  {
    ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true, index: true },

    type: { type: String, default: 'generic', trim: true, index: true },
    title: { type: String, default: '', trim: true },

    points: { type: Number, default: 0 },
    pointsAwarded: { type: Boolean, default: false },

    referralCode: { type: String, default: '', index: true },
    instagramId: { type: String, default: '', index: true },
    mobileNumber: { type: String, default: '', index: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AmbassadorActivity', ambassadorActivitySchema)

