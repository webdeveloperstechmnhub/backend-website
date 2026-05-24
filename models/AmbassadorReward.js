const mongoose = require('mongoose')

const ambassadorRewardSchema = new mongoose.Schema(
  {
    levelNumber: { type: Number, required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },

    badgeName: { type: String, default: '', trim: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AmbassadorReward', ambassadorRewardSchema)

