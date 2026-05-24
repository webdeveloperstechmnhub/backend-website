const mongoose = require('mongoose')

const ambassadorSchoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    city: { type: String, default: '', trim: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AmbassadorSchool', ambassadorSchoolSchema)

