const mongoose = require('mongoose')

const sessionBookingSchema = new mongoose.Schema(
  {
    instituteName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    students: { type: Number, required: true, min: 1 },
    audience: { type: String, required: true, trim: true },
    mode: { type: String, required: true, trim: true },
    requirements: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled'],
      default: 'pending',
    },
    adminNotes: { type: String, default: '', trim: true },
    preferredContactTime: { type: String, default: '', trim: true },
  },
  { timestamps: true },
)

module.exports = mongoose.model('SessionBooking', sessionBookingSchema)
