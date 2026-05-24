const mongoose = require('mongoose')

const ambassadorApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'AmbassadorSchool', required: true, index: true },
    className: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },

    mobileNumber: { type: String, required: true, trim: true, index: true },
    parentNumber: { type: String, required: true, trim: true },
    instagramId: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, trim: true, index: true },

    why: { type: String, required: true, trim: true },
    skills: { type: String, required: true, trim: true },
    photo: { type: String, default: '' },
    avatar: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    reviewedByAdmin: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
)

ambassadorApplicationSchema.index({ mobileNumber: 1, instagramId: 1, status: 1 })

module.exports = mongoose.model('AmbassadorApplication', ambassadorApplicationSchema)

