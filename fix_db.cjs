require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./models/Event');

mongoose.connect(process.env.MONGO_URI, {
  
  
}).then(async () => {
  console.log('MongoDB connected');
  
  // Update all events to have registrationSettings.enabled = true
  const result = await Event.updateMany(
    {},
    { $set: { 'registrationSettings.enabled': true } }
  );
  
  console.log('Updated events:', result.modifiedCount);
  mongoose.disconnect();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});
