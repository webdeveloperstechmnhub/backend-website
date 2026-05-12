const mongoose = require("mongoose");

const instituteSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "AccountUser", required: true, index: true },
    instituteName: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["School", "College", "Coaching", "Academy"],
      required: true,
    },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    verified: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Institute", instituteSchema);
