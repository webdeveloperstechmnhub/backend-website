const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    details: { type: String, required: true, trim: true },
    source: { type: String, enum: ['contact', 'join', 'website'], default: 'website' },
    emailStatus: { type: String, enum: ['sent', 'failed', 'pending'], default: 'pending' },
    emailProvider: { type: String, trim: true },
    emailError: { type: String, trim: true },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
