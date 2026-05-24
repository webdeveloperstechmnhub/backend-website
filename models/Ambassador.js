const mongoose = require('mongoose')

const ambassadorSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'AmbassadorApplication', index: true },

    fullName: { type: String, required: true, trim: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'AmbassadorSchool', required: true, index: true },

    className: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },

    mobileNumber: { type: String, required: true, trim: true },
    instagramId: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },

    approved: { type: Boolean, default: true, index: true },

    points: { type: Number, default: 0, index: true },
    referralCode: { type: String, index: true },
    badges: { type: [String], default: [] },
    photo: { type: String, default: '' },
    avatar: { type: String, default: '' },

    createdByAdmin: { type: String, default: '' },
  },
  { timestamps: true }
)

ambassadorSchema.index({ instagramId: 1 }, { unique: true, sparse: true })
ambassadorSchema.index({ mobileNumber: 1 }, { unique: true, sparse: true })

module.exports = mongoose.model('Ambassador', ambassadorSchema)

