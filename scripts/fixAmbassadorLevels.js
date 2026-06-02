/**
 * scripts/fixAmbassadorLevels.js
 *
 * One-time migration: fixes the AmbassadorLevel collection so that
 * "Starter" begins at pointsNeeded: 0, not 50.
 *
 * Old (broken) thresholds:
 *   Level 1 Starter          → pointsNeeded: 50   ← WRONG
 *   Level 2 Rising Ambassador → pointsNeeded: 150
 *   Level 3 Elite Ambassador  → pointsNeeded: 300
 *   Level 4 Future Leader     → pointsNeeded: 500
 *
 * Correct thresholds:
 *   Level 1 Starter          → pointsNeeded: 0
 *   Level 2 Rising Ambassador → pointsNeeded: 50
 *   Level 3 Elite Ambassador  → pointsNeeded: 150
 *   Level 4 Future Leader     → pointsNeeded: 300
 *
 * Run: node scripts/fixAmbassadorLevels.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const AmbassadorLevel = require('../models/AmbassadorLevel')

const CORRECT_LEVELS = [
  { levelNumber: 1, name: 'Starter',           pointsNeeded: 0   },
  { levelNumber: 2, name: 'Rising Ambassador',  pointsNeeded: 50  },
  { levelNumber: 3, name: 'Elite Ambassador',   pointsNeeded: 150 },
  { levelNumber: 4, name: 'Future Leader',      pointsNeeded: 300 },
]

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('✅ MongoDB connected')

  for (const lvl of CORRECT_LEVELS) {
    const result = await AmbassadorLevel.findOneAndUpdate(
      { levelNumber: lvl.levelNumber },
      { $set: { name: lvl.name, pointsNeeded: lvl.pointsNeeded } },
      { upsert: true, new: true }
    )
    console.log(`  Level ${lvl.levelNumber}: "${result.name}" → pointsNeeded=${result.pointsNeeded}`)
  }

  console.log('\n✅ AmbassadorLevel documents corrected.')
  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
