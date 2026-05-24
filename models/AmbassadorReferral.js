const mongoose = require('mongoose')

const ambassadorReferralSchema = new mongoose.Schema(
  {
    ambassadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambassador', required: true, unique: true, index: true },

    referralCode: { type: String, required: true, unique: true, index: true },
    referralLink: { type: String, default: '' },

    referralCount: { type: Number, default: 0 },

    createdByAdmin: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AmbassadorReferral', ambassadorReferralSchema)

