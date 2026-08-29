/**
 * ambassadorXpService.js
 *
 * Centralised, idempotent service for all ambassador XP operations.
 * Every function is safe to call multiple times — it will never double-award.
 *
 * Rank thresholds (matches frontend BADGE_TEMPLATES and dashboard levelProgress):
 *   Starter        : 0  – 49  XP
 *   Rising Ambassador: 50 – 149 XP
 *   Elite Ambassador : 150 – 299 XP
 *   Future Leader   : 300+ XP
 */

const Ambassador = require('../models/Ambassador')
const AmbassadorActivity = require('../models/AmbassadorActivity')
const AmbassadorLevel = require('../models/AmbassadorLevel')
const AmbassadorApplication = require('../models/AmbassadorApplication')
const AmbassadorReferral = require('../models/AmbassadorReferral')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WELCOME_BONUS_XP = 20
const WELCOME_BONUS_TYPE = 'WELCOME_BONUS'

/**
 * Default level definitions.
 * pointsNeeded = minimum XP to ENTER that rank.
 * Starter starts at 0 — every new ambassador is a Starter immediately.
 */
const DEFAULT_LEVELS = [
  { levelNumber: 1, name: 'Starter',          pointsNeeded: 0   },
  { levelNumber: 2, name: 'Rising Ambassador', pointsNeeded: 50  },
  { levelNumber: 3, name: 'Elite Ambassador',  pointsNeeded: 150 },
  { levelNumber: 4, name: 'Future Leader',     pointsNeeded: 300 },
]

// ---------------------------------------------------------------------------
// Level bootstrap — call once at startup or on first approval
// ---------------------------------------------------------------------------

/**
 * Ensures the correct level documents exist in the DB.
 * Safe to call multiple times — uses upsert per levelNumber.
 */
async function ensureLevelsSeeded() {
  for (const lvl of DEFAULT_LEVELS) {
    await AmbassadorLevel.findOneAndUpdate(
      { levelNumber: lvl.levelNumber },
      { $setOnInsert: lvl },
      { upsert: true }
    )
  }
}

// ---------------------------------------------------------------------------
// Level resolution
// ---------------------------------------------------------------------------

/**
 * Returns the current level object for a given XP amount.
 * Always returns a valid level (falls back to Starter at minimum).
 * @param {number} xp
 * @returns {{ levelNumber, name, pointsNeeded }}
 */
async function resolveLevel(xp) {
  await ensureLevelsSeeded()
  const levels = await AmbassadorLevel.find({}).sort({ pointsNeeded: -1 })

  // Find highest level the ambassador qualifies for
  const match = levels.find((l) => xp >= l.pointsNeeded)
  if (match) return match

  // Fallback: return the lowest level (Starter at 0)
  const starter = levels[levels.length - 1]
  return starter
}

/**
 * Returns the next level object (the one above current), or null if maxed out.
 * @param {object} currentLevel
 * @returns {{ levelNumber, name, pointsNeeded } | null}
 */
async function resolveNextLevel(currentLevel) {
  const levels = await AmbassadorLevel.find({}).sort({ pointsNeeded: 1 })
  const nextIdx = levels.findIndex((l) => l.levelNumber === currentLevel.levelNumber) + 1
  return nextIdx < levels.length ? levels[nextIdx] : null
}

// ---------------------------------------------------------------------------
// Badge sync
// ---------------------------------------------------------------------------

/**
 * Returns the array of badge names the ambassador has earned based on XP.
 * Mirrors the BADGE_TEMPLATES in AmbassadorDashboard.jsx.
 * @param {number} xp
 * @returns {string[]}
 */
function resolveBadges(xp) {
  const earned = []
  if (xp >= 0)   earned.push('Cyber Pioneer')
  if (xp >= 150) earned.push('Growth Hacker')
  if (xp >= 300) earned.push('Buzz Maker')
  if (xp >= 500) earned.push('Future Leader')
  return earned
}

// ---------------------------------------------------------------------------
// Welcome bonus — IDEMPOTENT
// ---------------------------------------------------------------------------

/**
 * Awards the one-time welcome bonus to a newly approved ambassador.
 *
 * IDEMPOTENCY: checks `ambassador.welcomeBonusAwarded` flag AND
 * whether a WELCOME_BONUS activity already exists for this ambassador.
 * Absolutely safe to call more than once — will not double-award.
 *
 * @param {ObjectId|string} ambassadorId
 * @returns {{ awarded: boolean, xp: number, totalPoints: number }}
 */
async function awardWelcomeBonus(ambassadorId) {
  const ambassador = await Ambassador.findById(ambassadorId)
  if (!ambassador) throw new Error(`Ambassador not found: ${ambassadorId}`)

  // Primary guard: flag on the document
  if (ambassador.welcomeBonusAwarded) {
    return { awarded: false, xp: 0, totalPoints: ambassador.points }
  }

  // Secondary guard: check if activity already exists (handles crash-restart scenarios)
  const existingActivity = await AmbassadorActivity.findOne({
    ambassadorId: ambassador._id,
    type: WELCOME_BONUS_TYPE,
  })

  if (existingActivity) {
    // Activity exists but flag wasn't set — fix the flag and return
    await Ambassador.updateOne(
      { _id: ambassador._id },
      { $set: { welcomeBonusAwarded: true } }
    )
    return { awarded: false, xp: 0, totalPoints: ambassador.points }
  }

  // Award the bonus atomically
  const updatedAmbassador = await Ambassador.findOneAndUpdate(
    {
      _id: ambassador._id,
      welcomeBonusAwarded: { $ne: true }, // atomic guard — prevents race condition
    },
    {
      $inc: { points: WELCOME_BONUS_XP },
      $set: { welcomeBonusAwarded: true },
    },
    { new: true }
  )

  if (!updatedAmbassador) {
    // Another process won the race — bonus already awarded
    const fresh = await Ambassador.findById(ambassadorId)
    return { awarded: false, xp: 0, totalPoints: fresh?.points ?? 0 }
  }

  // Create the transaction record
  await AmbassadorActivity.create({
    ambassadorId: ambassador._id,
    title: 'New Ambassador Welcome Bonus',
    type: WELCOME_BONUS_TYPE,
    points: WELCOME_BONUS_XP,
    pointsAwarded: true,
    referralCode: '',
    instagramId: ambassador.instagramId,
    mobileNumber: ambassador.mobileNumber,
  })

  // Sync badges based on new XP total
  const newXp = updatedAmbassador.points
  const badges = resolveBadges(newXp)
  await Ambassador.updateOne(
    { _id: ambassador._id },
    { $set: { badges } }
  )

  return {
    awarded: true,
    xp: WELCOME_BONUS_XP,
    totalPoints: updatedAmbassador.points,
  }
}

// ---------------------------------------------------------------------------
// Generic XP award — with idempotency key
// ---------------------------------------------------------------------------

/**
 * Awards XP for any activity type.
 * Pass an idempotencyKey (e.g. referralCode + mobileNumber) to prevent duplicates.
 *
 * @param {object} opts
 * @param {ObjectId|string} opts.ambassadorId
 * @param {string} opts.title
 * @param {string} opts.type
 * @param {number} opts.xp
 * @param {string} [opts.referralCode]
 * @param {string} [opts.mobileNumber]
 * @param {string} [opts.instagramId]
 * @param {string} [opts.idempotencyKey]  — unique string that makes this event unique
 * @returns {{ awarded: boolean, xp: number, totalPoints: number }}
 */
async function awardXp(opts) {
  const {
    ambassadorId,
    title,
    type,
    xp,
    referralCode = '',
    mobileNumber = '',
    instagramId = '',
    idempotencyKey = '',
  } = opts

  // Check duplicate
  const query = { ambassadorId, type }
  if (idempotencyKey) query.idempotencyKey = idempotencyKey

  const existing = await AmbassadorActivity.findOne(query)
  if (existing) {
    const amb = await Ambassador.findById(ambassadorId)
    return { awarded: false, xp: 0, totalPoints: amb?.points ?? 0 }
  }

  const updatedAmbassador = await Ambassador.findByIdAndUpdate(
    ambassadorId,
    { $inc: { points: xp } },
    { new: true }
  )

  if (!updatedAmbassador) throw new Error(`Ambassador not found: ${ambassadorId}`)

  await AmbassadorActivity.create({
    ambassadorId,
    title,
    type,
    points: xp,
    pointsAwarded: true,
    referralCode,
    mobileNumber,
    instagramId,
    idempotencyKey,
  })

  // Sync badges
  const badges = resolveBadges(updatedAmbassador.points)
  await Ambassador.updateOne({ _id: ambassadorId }, { $set: { badges } })

  return { awarded: true, xp, totalPoints: updatedAmbassador.points }
}

// ---------------------------------------------------------------------------
// Self-Healing & Data Synchronization
// ---------------------------------------------------------------------------

/**
 * Scans for approved applications that do not have a corresponding Ambassador record,
 * and creates them along with their referral code and welcome bonus.
 */
async function healDesyncedAmbassadors() {
  try {
    // Find all approved applications
    const approvedApplications = await AmbassadorApplication.find({ status: 'approved' })
    if (approvedApplications.length === 0) return

    for (const app of approvedApplications) {
      // Check if an Ambassador record already exists for this application
      const existingAmb = await Ambassador.findOne({
        $or: [
          { applicationId: app._id },
          { email: app.email },
          { mobileNumber: app.mobileNumber },
        ]
      })

      if (!existingAmb) {
        console.log(`[Self-Healing] Detected desynced approved application: ${app.fullName} (${app.email || 'No Email'}). Recreating Ambassador account...`)

        // Generate referral code
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
        const digits = '23456789'
        const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase()
        const part1 = alphabet[Math.floor(Math.random() * alphabet.length)] + alphabet[Math.floor(Math.random() * alphabet.length)]
        const part2 = digits[Math.floor(Math.random() * digits.length)] + digits[Math.floor(Math.random() * digits.length)]
        const referralCode = `TMH-${part1}${part2}-${rand()}`

        // Create Ambassador record
        const ambassador = await Ambassador.create({
          applicationId: app._id,
          fullName: app.fullName,
          schoolId: app.schoolId,
          className: app.className,
          city: app.city,
          mobileNumber: app.mobileNumber,
          instagramId: app.instagramId,
          email: app.email || `healed_${app._id}@school.com`, // Email fallback if undefined
          photo: app.photo || '',
          avatar: app.avatar || '',
          approved: true,
          points: 0,
          badges: [],
          welcomeBonusAwarded: false,
          referralCode,
          createdByAdmin: app.reviewedByAdmin || 'System Healer',
        })

        // Persist referral link record
        await AmbassadorReferral.findOneAndUpdate(
          { ambassadorId: ambassador._id },
          {
            $setOnInsert: {
              ambassadorId: ambassador._id,
              referralCode,
              referralLink: '',
              createdByAdmin: app.reviewedByAdmin || 'System Healer',
            },
          },
          { upsert: true }
        )

        // Award welcome bonus
        await awardWelcomeBonus(ambassador._id)

        console.log(`[Self-Healing] Successfully healed ambassador record for: ${app.fullName}`)
      } else if (!existingAmb.applicationId) {
        // Just sync the applicationId if it was missing
        await Ambassador.updateOne({ _id: existingAmb._id }, { $set: { applicationId: app._id } })
      }
    }
  } catch (err) {
    console.error('[Self-Healing] Error running desynced ambassador healing:', err)
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  WELCOME_BONUS_XP,
  WELCOME_BONUS_TYPE,
  DEFAULT_LEVELS,
  ensureLevelsSeeded,
  resolveLevel,
  resolveNextLevel,
  resolveBadges,
  awardWelcomeBonus,
  awardXp,
  healDesyncedAmbassadors,
}
