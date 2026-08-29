require('dotenv').config();
const mongoose = require('mongoose');

async function clear() {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.collection('sessionrecords').deleteMany({});
  console.log('cleared');
  process.exit(0);
}
clear();
