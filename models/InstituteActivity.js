const mongoose = require('mongoose');

const instituteActivitySchema = new mongoose.Schema(
  {
    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institute',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    skill: {
      type: String,
      required: true,
      trim: true,
    },
    points: {
      type: Number,
      required: true,
      min: 1,
      default: 100,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountUser',
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('InstituteActivity', instituteActivitySchema);
