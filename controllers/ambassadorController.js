const AmbassadorApplication = require('../models/AmbassadorApplication')
const Ambassador = require('../models/Ambassador')
const AmbassadorReferral = require('../models/AmbassadorReferral')
const AmbassadorActivity = require('../models/AmbassadorActivity')
const AmbassadorReward = require('../models/AmbassadorReward')
const AmbassadorSchool = require('../models/AmbassadorSchool')
const sendEmail = require('../utils/sendEmail')
const xpService = require('../services/ambassadorXpService')

// Helpers
const normalizeInstagram = (v) => String(v || '').trim().replace(/^@/, '')

// ---------------------------------------------------------------------------
// POST /api/ambassador/apply
// ---------------------------------------------------------------------------

exports.applyAmbassador = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim()
    const schoolName = String(req.body?.schoolName || '').trim()
    const className = String(req.body?.className || '').trim()
    const city = String(req.body?.city || '').trim()
    const mobileNumber = String(req.body?.mobileNumber || '').trim()
    const parentNumber = String(req.body?.parentNumber || '').trim()
    const instagramId = normalizeInstagram(req.body?.instagramId)
    const email = String(req.body?.email || '').trim().toLowerCase()
    const why = String(req.body?.why || '').trim()
    const skills = String(req.body?.skills || '').trim()
    const referredByCode = String(req.body?.referredByCode || '').trim().toUpperCase()

    if (!fullName || !schoolName || !className || !city || !mobileNumber || !parentNumber || !instagramId || !email || !why || !skills) {
      return res.status(400).json({ msg: 'Please fill all required fields.' })
    }

    if (!/^[0-9]{10,13}$/.test(mobileNumber)) return res.status(400).json({ msg: 'Invalid mobile number.' })
    if (!/^[0-9]{10,13}$/.test(parentNumber)) return res.status(400).json({ msg: 'Invalid parent number.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ msg: 'Invalid email address.' })
    if (why.length < 20) return res.status(400).json({ msg: 'Why do you want to join? (min 20 chars)' })
    if (skills.length < 10) return res.status(400).json({ msg: 'Skills/Interests (min 10 chars)' })

    const existing = await AmbassadorApplication.findOne({
      $or: [{ mobileNumber }, { instagramId }, { email }],
      status: { $in: ['pending', 'approved'] },
    })

    if (existing) {
      return res.status(409).json({ msg: 'An application already exists for this student.' })
    }

    let school = await AmbassadorSchool.findOne({ name: schoolName })
    if (!school) {
      school = await AmbassadorSchool.create({ name: schoolName, city })
    }

    // Ensure level definitions exist (idempotent)
    await xpService.ensureLevelsSeeded()

    const photo = String(req.body?.photo || '').trim()
    const avatar = String(req.body?.avatar || '').trim()

    // Validate referral code if provided
    let validatedReferredByCode = ''
    if (referredByCode) {
      const refRecord = await AmbassadorReferral.findOne({ referralCode: referredByCode })
      if (refRecord) {
        validatedReferredByCode = referredByCode
      }
    }

    const application = await AmbassadorApplication.create({
      fullName,
      schoolId: school._id,
      className,
      city,
      mobileNumber,
      parentNumber,
      instagramId,
      email,
      why,
      skills,
      photo,
      avatar,
      referredByCode: validatedReferredByCode,
      status: 'pending',
    })

    // Dispatch notification email to core support team
    try {
      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #D4AF37; border-radius: 12px; background-color: #0c0c0c; color: #ffffff;">
          <h2 style="color: #D4AF37; text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 12px; margin-top: 0; font-weight: 800; letter-spacing: 1px;">
            NEW STUDENT AMBASSADOR APPLICATION 🚀
          </h2>
          <p style="font-size: 15px; line-height: 1.6; color: #cccccc; text-align: center;">
            A student has submitted an application to join the <strong>TechMNHub Student Ambassador Program</strong>. Below are their registration details:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background-color: #121212; border-radius: 8px; overflow: hidden;">
            <tr style="border-bottom: 1px solid #222;"><td style="padding: 12px; font-weight: bold; color: #D4AF37; width: 35%;">Full Name:</td><td style="padding: 12px; color: #fff;">${fullName}</td></tr>
            <tr style="border-bottom: 1px solid #222;"><td style="padding: 12px; font-weight: bold; color: #D4AF37;">School Name:</td><td style="padding: 12px; color: #fff;">${schoolName}</td></tr>
            <tr style="border-bottom: 1px solid #222;"><td style="padding: 12px; font-weight: bold; color: #D4AF37;">Class/Year:</td><td style="padding: 12px; color: #fff;">${className}</td></tr>
            <tr style="border-bottom: 1px solid #222;"><td style="padding: 12px; font-weight: bold; color: #D4AF37;">City:</td><td style="padding: 12px; color: #fff;">${city}</td></tr>
            <tr style="border-bottom: 1px solid #222;"><td style="padding: 12px; font-weight: bold; color: #D4AF37;">Student Email:</td><td style="padding: 12px; color: #00E5FF;"><a href="mailto:${email}" style="color: #00E5FF; text-decoration: none;">${email}</a></td></tr>
            <tr style="border-bottom: 1px solid #222;"><td style="padding: 12px; font-weight: bold; color: #D4AF37;">Mobile Number:</td><td style="padding: 12px; color: #fff;">${mobileNumber}</td></tr>
            <tr style="border-bottom: 1px solid #222;"><td style="padding: 12px; font-weight: bold; color: #D4AF37;">Parent Number:</td><td style="padding: 12px; color: #fff;">${parentNumber}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #D4AF37;">Instagram ID:</td><td style="padding: 12px; color: #fff;"><a href="https://instagram.com/${instagramId}" style="color: #D4AF37; text-decoration: none;">@${instagramId}</a></td></tr>
          </table>
          <div style="background-color: #121212; padding: 18px; border-left: 4px solid #D4AF37; border-radius: 4px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #D4AF37; font-size: 14px; text-transform: uppercase;">Why do you want to join?</h4>
            <p style="margin: 0; font-style: italic; color: #dddddd; font-size: 14px; line-height: 1.6;">"${why}"</p>
          </div>
          <div style="background-color: #121212; padding: 18px; border-left: 4px solid #00E5FF; border-radius: 4px; margin-bottom: 25px;">
            <h4 style="margin: 0 0 8px 0; color: #00E5FF; font-size: 14px; text-transform: uppercase;">Skills & Interests:</h4>
            <p style="margin: 0; color: #dddddd; font-size: 14px; line-height: 1.6;">${skills}</p>
          </div>
          ${validatedReferredByCode ? `<p style="font-size: 12px; color: #D4AF37; text-align: center;">🔗 Referred by ambassador: <strong>${validatedReferredByCode}</strong></p>` : ''}
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5173'}/admin"
               style="background: linear-gradient(135deg, #D4AF37 0%, #F0DB92 100%); color: #000000; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 14px; text-transform: uppercase;">
              Review in Admin Panel
            </a>
          </div>
          <p style="font-size: 11px; color: #666666; text-align: center; margin-top: 35px; border-top: 1px solid #222; padding-top: 15px; margin-bottom: 0;">
            This is an automated notification sent from the TechMNHub Portal.
          </p>
        </div>
      `
      await sendEmail({
        to: 'techmnhub.team@gmail.com',
        subject: `New Student Ambassador Application: ${fullName} 🚀`,
        html: emailHtml,
      })
    } catch (e) {
      console.error('Failed to dispatch support alert email:', e)
    }

    return res.status(201).json({ msg: 'Application submitted successfully.', application })
  } catch (err) {
    console.error('applyAmbassador error:', err)
    return res.status(500).json({ msg: 'Server error while submitting application.' })
  }
}

// ---------------------------------------------------------------------------
// GET /api/ambassador/leaderboard?category=...
// ---------------------------------------------------------------------------

exports.getAmbassadorLeaderboard = async (req, res) => {
  try {
    const category = String(req.query?.category || 'top_ambassadors').trim()

    const ambassadors = await Ambassador.find({ approved: true })
      .populate('schoolId', 'name')
      .sort({ points: -1 })
      .limit(200)

    let ranked = ambassadors.map((a, idx) => ({
      rank: idx + 1,
      id: a._id,
      name: a.fullName,
      schoolName: a.schoolId?.name || '',
      points: a.points,
      badges: a.badges || [],
    }))

    if (category === 'top_schools') {
      const schoolAgg = new Map()
      for (const row of ranked) {
        const key = row.schoolName || 'Unknown'
        const prev = schoolAgg.get(key) || { schoolName: key, points: 0 }
        prev.points += row.points
        schoolAgg.set(key, prev)
      }
      ranked = Array.from(schoolAgg.values())
        .sort((a, b) => b.points - a.points)
        .slice(0, 30)
        .map((x, idx) => ({ rank: idx + 1, id: `${x.schoolName}-${idx}`, name: x.schoolName, schoolName: x.schoolName, points: x.points, badges: [] }))
    }

    if (category === 'weekly_leaders' || category === 'top_creators') {
      ranked = ranked.slice(0, 50)
    }

    return res.json({ entries: ranked.slice(0, 100) })
  } catch (err) {
    console.error('getAmbassadorLeaderboard error:', err)
    return res.status(500).json({ msg: 'Server error while loading leaderboard.' })
  }
}

// ---------------------------------------------------------------------------
// GET /api/ambassador/dashboard
// ---------------------------------------------------------------------------

exports.getAmbassadorDashboard = async (req, res) => {
  try {
    const referralCode = String(req.query?.code || req.query?.referralCode || req.headers['x-ambassador-code'] || '').trim().toUpperCase()
    const sessionEmail = String(req.studentUser?.email || '').trim().toLowerCase()
    const email = sessionEmail || String(req.query?.email || '').trim().toLowerCase()

    // No credentials → return a safe demo/preview payload (no 401)
    if (!referralCode && !email) {
      return res.json({
        totalPoints: 0,
        level: { name: 'Starter', pointsNeeded: 0, nextName: 'Rising Ambassador', nextPoints: 50 },
        referralCount: 0,
        referralCode: 'TMH-DEMO-XXXX',
        referralLink: '',
        rewardsUnlocked: 0,
        leaderboardRank: 0,
        badges: [],
        recentActivities: [],
        upcomingEvents: [],
        isDemo: true,
      })
    }

    let ambassador = null
    if (referralCode) {
      ambassador = await Ambassador.findOne({ referralCode, approved: true }).populate('schoolId', 'name')
    } else if (email) {
      ambassador = await Ambassador.findOne({ email, approved: true }).populate('schoolId', 'name')
    }

    if (!ambassador) {
      return res.status(404).json({ msg: 'No approved ambassador found with this unique referral code.' })
    }

    // ── Resolve current level and next level using XP service ────────────────
    await xpService.ensureLevelsSeeded()
    const currentLevel = await xpService.resolveLevel(ambassador.points)
    const nextLevel = await xpService.resolveNextLevel(currentLevel)

    // ── Referral data ─────────────────────────────────────────────────────────
    const referral = await AmbassadorReferral.findOne({ ambassadorId: ambassador._id })

    // ── Recent activities ─────────────────────────────────────────────────────
    const recentActivities = await AmbassadorActivity.find({ ambassadorId: ambassador._id })
      .sort({ createdAt: -1 })
      .limit(8)

    // ── Rewards unlocked ──────────────────────────────────────────────────────
    const allRewards = await AmbassadorReward.find({ levelNumber: { $lte: currentLevel.levelNumber } })

    // ── Leaderboard rank ──────────────────────────────────────────────────────
    const all = await Ambassador.find({ approved: true }).sort({ points: -1 }).select('_id')
    const leaderboardRank = all.findIndex((x) => String(x._id) === String(ambassador._id)) + 1

    return res.json({
      totalPoints: ambassador.points,
      level: {
        name: currentLevel.name,
        pointsNeeded: currentLevel.pointsNeeded,
        nextName: nextLevel?.name || null,
        nextPoints: nextLevel?.pointsNeeded ?? null,
      },
      referralCount: referral?.referralCount || 0,
      referralCode: referral?.referralCode || ambassador.referralCode || '',
      referralLink: referral?.referralLink || '',
      rewardsUnlocked: allRewards.length,
      leaderboardRank: leaderboardRank || 1,
      badges: ambassador.badges || [],
      welcomeBonusAwarded: ambassador.welcomeBonusAwarded,
      recentActivities: recentActivities.map((a) => ({
        title: a.title,
        type: a.type,
        points: a.points,
        createdAt: a.createdAt,
      })),
      upcomingEvents: [],
    })
  } catch (err) {
    console.error('getAmbassadorDashboard error:', err)
    return res.status(500).json({ msg: 'Server error while loading dashboard.' })
  }
}

// ---------------------------------------------------------------------------
// POST /api/ambassador/referrals/track
// ---------------------------------------------------------------------------

exports.trackReferral = async (req, res) => {
  try {
    const referralCode = String(req.body?.referralCode || '').trim()
    const referredMobile = String(req.body?.referredMobileNumber || '').trim()
    const referredInstagramId = normalizeInstagram(req.body?.referredInstagramId)

    if (!referralCode) return res.status(400).json({ msg: 'referralCode is required.' })

    const referral = await AmbassadorReferral.findOne({ referralCode })
    if (!referral) return res.status(404).json({ msg: 'Referral code not found.' })

    // Build an idempotency key from whatever identifier we have
    const iKey = `referral_track_${referralCode}_${referredMobile || referredInstagramId}`

    const result = await xpService.awardXp({
      ambassadorId: referral.ambassadorId,
      title: 'Referral joined',
      type: 'referral_join',
      xp: 30,
      referralCode,
      mobileNumber: referredMobile,
      instagramId: referredInstagramId,
      idempotencyKey: iKey,
    })

    if (!result.awarded) {
      return res.status(200).json({ msg: 'Referral already tracked.' })
    }

    // Increment referral count only if XP was actually awarded
    await AmbassadorReferral.updateOne(
      { referralCode },
      { $inc: { referralCount: 1 } }
    )

    return res.json({ msg: 'Referral tracked successfully.', xpAwarded: result.xp, totalXp: result.totalPoints })
  } catch (err) {
    console.error('trackReferral error:', err)
    return res.status(500).json({ msg: 'Server error while tracking referral.' })
  }
}
