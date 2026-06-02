/**
 * scripts/backfillWelcomeBonus.js
 *
 * One-time migration: awards the welcome bonus to all existing approved
 * ambassadors who never received it (welcomeBonusAwarded = false or missing).
 *
 * Safe to re-run — uses the idempotent awardWelcomeBonus() from the XP service.
 *
 * Run: node scripts/backfillWelcomeBonus.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const Ambassador = require('../models/Ambassador')
const xpService = require('../services/ambassadorXpService')

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('✅ MongoDB connected')

  await xpService.ensureLevelsSeeded()

  const ambassadors = await Ambassador.find({
    approved: true,
    $or: [{ welcomeBonusAwarded: false }, { welcomeBonusAwarded: { $exists: false } }],
  })

  console.log(`Found ${ambassadors.length} ambassador(s) missing welcome bonus.\n`)

  let awarded = 0
  let skipped = 0

  for (const amb of ambassadors) {
    const result = await xpService.awardWelcomeBonus(amb._id)
    if (result.awarded) {
      awarded++
      console.log(`  ✅ ${amb.fullName} (${amb.referralCode}) → +${result.xp} XP | Total: ${result.totalPoints}`)
    } else {
      skipped++
      console.log(`  ⏭  ${amb.fullName} (${amb.referralCode}) → already awarded, skipped`)
    }
  }

  console.log(`\n✅ Backfill complete — awarded: ${awarded}, skipped: ${skipped}`)
  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Backfill failed:', err)
  process.exit(1)
})
