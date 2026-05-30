const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

systemSettingSchema.statics.get = async function (key) {
  const doc = await this.findOne({ key });
  return doc ? doc.value : null;
};

systemSettingSchema.statics.set = async function (key, value) {
  const doc = await this.findOneAndUpdate({ key }, { $set: { value, updatedAt: new Date() } }, { upsert: true, returnDocument: 'after' });
  return doc.value;
};

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
