const AmbassadorApplication = require('../models/AmbassadorApplication')
const Ambassador = require('../models/Ambassador')
const AmbassadorReferral = require('../models/AmbassadorReferral')
const AmbassadorActivity = require('../models/AmbassadorActivity')
const sendEmail = require('../utils/sendEmail')

// Simple referral code generator (scalable: replace with proper sequence/slug if needed)
const generateReferralCode = async () => {
  // Keep it deterministic enough for MVP
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  const part1 = alphabet[Math.floor(Math.random() * alphabet.length)] + alphabet[Math.floor(Math.random() * alphabet.length)]
  const part2 = digits[Math.floor(Math.random() * digits.length)] + digits[Math.floor(Math.random() * digits.length)]
  return `TMH-${part1}${part2}-${rand()}`
}

exports.listAmbassadorApplications = async (req, res) => {
  try {
    const items = await AmbassadorApplication.find({ status: 'pending' })
      .populate('schoolId', 'name')
      .sort({ createdAt: -1 })
      .limit(500)

    res.json({ applications: items })
  } catch (err) {
    console.error('listAmbassadorApplications error:', err)
    res.status(500).json({ msg: 'Server error while loading applications.' })
  }
}

exports.approveAmbassadorApplication = async (req, res) => {
  try {
    const applicationId = String(req.body?.applicationId || '').trim()
    if (!applicationId) return res.status(400).json({ msg: 'applicationId is required.' })

    const application = await AmbassadorApplication.findById(applicationId)
    if (!application) return res.status(404).json({ msg: 'Application not found.' })
    if (application.status !== 'pending') return res.status(400).json({ msg: 'Application is not pending.' })

    // Create/ensure Ambassador record
    // Use instagramId + mobileNumber uniqueness constraints from model
    const ambassador = await Ambassador.create({
      applicationId: application._id,
      fullName: application.fullName,
      schoolId: application.schoolId,
      className: application.className,
      city: application.city,
      mobileNumber: application.mobileNumber,
      instagramId: application.instagramId,
      email: application.email,
      photo: application.photo || '',
      avatar: application.avatar || '',
      approved: true,
      points: 0,
      badges: [],
      createdByAdmin: req.admin?.email || '',
    }).catch(async (e) => {
      // If Ambassador already exists, fetch it (handle duplicate approval gracefully)
      const existing = await Ambassador.findOne({
        $or: [{ instagramId: application.instagramId }, { mobileNumber: application.mobileNumber }],
      })
      if (!existing) throw e
      return existing
    })

    const referralCode = ambassador.referralCode || (await generateReferralCode())
    // Create referral row if missing
    await AmbassadorReferral.findOneAndUpdate(
      { ambassadorId: ambassador._id },
      {
        $setOnInsert: {
          ambassadorId: ambassador._id,
          referralCode,
          referralLink: '',
          createdByAdmin: req.admin?.email || '',
        },
      },
      { upsert: true, returnDocument: 'after' }
    )

    // Update Ambassador points/referralCode if model supports it
    // (MVP: referralCode lives on AmbassadorReferral; keep ambassador field for convenience)
    ambassador.referralCode = referralCode
    await ambassador.save().catch(() => {})

    application.status = 'approved'
    application.reviewedByAdmin = req.admin?.email || ''
    application.reviewedAt = new Date()
    await application.save()

    await AmbassadorActivity.create({
      ambassadorId: ambassador._id,
      title: 'Ambassador approved',
      type: 'application_approved',
      points: 20,
      pointsAwarded: true,
      referralCode: referralCode,
      instagramId: application.instagramId,
      mobileNumber: application.mobileNumber,
    })

    // Send beautiful acceptance letter email to the approved student
    try {
      const congratsHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #D4AF37; border-radius: 16px; background-color: #0c0c0c; color: #ffffff; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9);">
          <div style="text-align: center; margin-bottom: 25px;">
            <span style="font-size: 40px;">🏆</span>
            <h1 style="color: #D4AF37; margin: 10px 0 5px 0; font-size: 24px; font-weight: 800; tracking-wide: 1px; text-transform: uppercase;">
              OFFICIAL ACCEPTANCE LETTER
            </h1>
            <p style="color: #00E5FF; font-size: 13px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 2px;">
              TechMNHub Student Ambassador Program
            </p>
          </div>
          
          <p style="font-size: 15px; line-height: 1.6; color: #dddddd;">
            Dear <strong>${application.fullName}</strong>,
          </p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #cccccc; text-align: justify;">
            On behalf of the admissions and leadership committee at <strong>TechMNHub</strong>, we are absolutely thrilled to inform you that your application has been officially <strong>APPROVED</strong>! Welcome to the premium elite circle of <strong>TechMNHub Student Ambassadors</strong>.
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #cccccc; text-align: justify;">
            Out of numerous competitive applications nationwide, your skills, interests, and demonstrated drive for technology leadership stood out. As a Student Ambassador, you will spearhead community hackathons, lead campus workshops, grow our peer networks, and enjoy prime entry to internships, exclusive goodies, and professional tech credentials.
          </p>

          <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(0, 229, 255, 0.08) 100%); border: 1px dashed #D4AF37; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.05);">
            <span style="font-size: 11px; font-weight: 900; color: #A0A0A0; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 6px;">Your Private Ambassador Access Key</span>
            <span style="font-size: 22px; font-weight: 900; color: #F0DB92; letter-spacing: 1.5px; display: block;">${referralCode}</span>
            <span style="font-size: 11px; color: #00E5FF; display: block; margin-top: 6px; font-weight: 700;">Use this code to invite peers and log into your console</span>
          </div>

          <h3 style="color: #D4AF37; font-size: 16px; border-bottom: 1px solid #222; padding-bottom: 8px; margin-top: 30px;">🚀 Next Steps To Activate Your Workspace</h3>
          <ol style="font-size: 13px; line-height: 1.7; color: #cccccc; padding-left: 20px;">
            <li style="margin-bottom: 8px;"><strong>Access Your Terminal</strong>: Navigate to the <a href="https://www.techmnhub.com/ambassador/dashboard" style="color: #00E5FF; text-decoration: none; font-weight: bold;">Ambassador Console 💻</a> and enter your Unique Referral Code (Key) above.</li>
            <li style="margin-bottom: 8px;"><strong>Share Your Code</strong>: Encourage classmate registrations. Each validated sign-up instantly grants you +30 XP points on your live leaderboard.</li>
            <li style="margin-bottom: 8px;"><strong>Unlock Visual merit Credentials</strong>: Boost your XP balance to dynamically earn the <strong>Growth Hacker</strong> and <strong>Future Leader</strong> digital badges!</li>
          </ol>

          <p style="font-size: 14px; line-height: 1.6; color: #cccccc; margin-top: 30px;">
            We are incredibly excited to build the future of tech education with you. Welcome aboard!
          </p>

          <div style="margin-top: 35px; border-top: 1px solid #222; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="margin: 0; font-size: 13px; font-weight: bold; color: #F0DB92;">Team TechMNHub</p>
              <p style="margin: 0; font-size: 11px; color: #888888;">Community Admissions Director</p>
            </div>
            <div style="font-size: 22px;">🛡️</div>
          </div>
        </div>
      `
      await sendEmail({
        to: application.email,
        subject: `Accepted! Welcome to TechMNHub Student Ambassador Program 🚀`,
        html: congratsHtml,
      })
    } catch (e) {
      console.error('Failed to send student congrats email:', e)
    }

    res.json({ msg: 'Application approved successfully.' })
  } catch (err) {
    console.error('approveAmbassadorApplication error:', err)
    res.status(500).json({ msg: 'Server error while approving application.' })
  }
}

exports.rejectAmbassadorApplication = async (req, res) => {
  try {
    const applicationId = String(req.body?.applicationId || '').trim()
    if (!applicationId) return res.status(400).json({ msg: 'applicationId is required.' })

    const application = await AmbassadorApplication.findById(applicationId)
    if (!application) return res.status(404).json({ msg: 'Application not found.' })

    application.status = 'rejected'
    application.reviewedByAdmin = req.admin?.email || ''
    application.reviewedAt = new Date()
    await application.save()

    res.json({ msg: 'Application rejected successfully.' })
  } catch (err) {
    console.error('rejectAmbassadorApplication error:', err)
    res.status(500).json({ msg: 'Server error while rejecting application.' })
  }
}

exports.listActiveAmbassadors = async (req, res) => {
  try {
    const items = await Ambassador.find({ approved: true })
      .populate('schoolId', 'name')
      .sort({ points: -1 })
    res.json({ ambassadors: items })
  } catch (err) {
    console.error('listActiveAmbassadors error:', err)
    res.status(500).json({ msg: 'Server error while loading active ambassadors.' })
  }
}

exports.terminateAmbassador = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ msg: 'Ambassador ID is required.' })

    const ambassador = await Ambassador.findById(id)
    if (!ambassador) return res.status(404).json({ msg: 'Ambassador not found.' })

    // Delete active ambassador document
    await Ambassador.findByIdAndDelete(id)

    // Revert the application status back to rejected
    if (ambassador.applicationId) {
      await AmbassadorApplication.findByIdAndUpdate(ambassador.applicationId, {
        status: 'rejected',
        reviewedByAdmin: req.admin?.email || 'System Termination',
        reviewedAt: new Date(),
      })
    }

    res.json({ msg: 'Ambassador terminated successfully.' })
  } catch (err) {
    console.error('terminateAmbassador error:', err)
    res.status(500).json({ msg: 'Server error while terminating ambassador.' })
  }
}


