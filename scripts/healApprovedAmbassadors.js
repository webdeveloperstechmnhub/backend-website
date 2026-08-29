/**
 * scripts/healApprovedAmbassadors.js
 *
 * Manual database restoration & synchronization script.
 * Scans the database for approved applications that lack active Ambassador accounts,
 * automatically recreates them, links their referral parameters, and credits welcome bonus points.
 *
 * Run: node scripts/healApprovedAmbassadors.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const xpService = require('../services/ambassadorXpService')

async function run() {
  console.log('⚡ Starting Approved Ambassador Database Healing Migration...')
  await mongoose.connect(process.env.MONGO_URI)
  console.log('✅ Connected to MongoDB successfully.')

  // Trigger self-healing
  await xpService.healDesyncedAmbassadors()

  console.log('\n✅ Database healing pass completed successfully.')
  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Database healing pass failed:', err)
  process.exit(1)
})
