const mongoose = require('mongoose')

const ambassadorLevelSchema = new mongoose.Schema(
  {
    levelNumber: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    pointsNeeded: { type: Number, required: true, index: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AmbassadorLevel', ambassadorLevelSchema)

