/**
 * scripts/diagnosticAudit.js
 *
 * Diagnostic script to search for the specific student across all database collections:
 * Email: tpriyansh973@gmail.com
 * Phone: 9058145767
 * Instagram: xx._.priyanshhh
 *
 * Run: node scripts/diagnosticAudit.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')

// Models
const Ambassador = require('../models/Ambassador')
const AmbassadorApplication = require('../models/AmbassadorApplication')
const AmbassadorReferral = require('../models/AmbassadorReferral')
const AmbassadorSchool = require('../models/AmbassadorSchool')
const User = require('../models/User')
const StudentSignup = require('../models/StudentSignup')
const AccountUser = require('../models/AccountUser')

async function run() {
  console.log('🔍 Executing Diagnostic Database Audit...')
  await mongoose.connect(process.env.MONGO_URI)
  console.log('✅ Connected to MongoDB.')

  const targetEmail = 'tpriyansh973@gmail.com'
  const targetPhone = '9058145767'
  const targetInsta = 'xx._.priyanshhh'

  console.log('\n--- 📞 TARGET SEARCH CRITERIA ---')
  console.log(`Email: ${targetEmail}`)
  console.log(`Phone: ${targetPhone}`)
  console.log(`Instagram: @${targetInsta}`)

  // Search AmbassadorApplication
  console.log('\n--- 🔎 SEARCHING AmbassadorApplication ---')
  const apps = await AmbassadorApplication.find({
    $or: [{ email: targetEmail }, { mobileNumber: targetPhone }, { instagramId: targetInsta }]
  }).populate('schoolId', 'name')
  
  if (apps.length === 0) {
    console.log('❌ No AmbassadorApplication records found.')
  } else {
    apps.forEach((app, idx) => {
      console.log(`Record #${idx + 1}:`)
      console.log(`  _id: ${app._id}`)
      console.log(`  fullName: ${app.fullName}`)
      console.log(`  status: ${app.status}`)
      console.log(`  email: ${app.email}`)
      console.log(`  mobileNumber: ${app.mobileNumber}`)
      console.log(`  instagramId: @${app.instagramId}`)
      console.log(`  schoolId: ${app.schoolId?._id} (${app.schoolId?.name})`)
      console.log(`  reviewedByAdmin: ${app.reviewedByAdmin}`)
      console.log(`  reviewedAt: ${app.reviewedAt}`)
      console.log(`  createdAt: ${app.createdAt}`)
    })
  }

  // Search Ambassador
  console.log('\n--- 🔎 SEARCHING Ambassador ---')
  const ambs = await Ambassador.find({
    $or: [{ email: targetEmail }, { mobileNumber: targetPhone }, { instagramId: targetInsta }]
  }).populate('schoolId', 'name')

  if (ambs.length === 0) {
    console.log('❌ No Ambassador records found.')
  } else {
    ambs.forEach((amb, idx) => {
      console.log(`Record #${idx + 1}:`)
      console.log(`  _id: ${amb._id}`)
      console.log(`  applicationId: ${amb.applicationId}`)
      console.log(`  fullName: ${amb.fullName}`)
      console.log(`  approved: ${amb.approved}`)
      console.log(`  points: ${amb.points}`)
      console.log(`  referralCode: ${amb.referralCode}`)
      console.log(`  email: ${amb.email}`)
      console.log(`  mobileNumber: ${amb.mobileNumber}`)
      console.log(`  instagramId: @${amb.instagramId}`)
      console.log(`  schoolId: ${amb.schoolId?._id} (${amb.schoolId?.name})`)
      console.log(`  createdAt: ${amb.createdAt}`)
    })
  }

  // Search User
  console.log('\n--- 🔎 SEARCHING User ---')
  const users = await User.find({
    $or: [{ email: targetEmail }, { phone: targetPhone }]
  })

  if (users.length === 0) {
    console.log('❌ No User records found.')
  } else {
    users.forEach((user, idx) => {
      console.log(`Record #${idx + 1}:`)
      console.log(`  _id: ${user._id}`)
      console.log(`  fullName: ${user.fullName}`)
      console.log(`  email: ${user.email}`)
      console.log(`  phone: ${user.phone}`)
      console.log(`  role: ${user.role}`)
      console.log(`  checkedIn: ${user.checkedIn}`)
      console.log(`  paymentStatus: ${user.paymentStatus}`)
      console.log(`  createdAt: ${user.createdAt}`)
    })
  }

  // Search StudentSignup
  console.log('\n--- 🔎 SEARCHING StudentSignup ---')
  const signups = await StudentSignup.find({
    $or: [{ email: targetEmail }, { phone: targetPhone }]
  })

  if (signups.length === 0) {
    console.log('❌ No StudentSignup records found.')
  } else {
    signups.forEach((signup, idx) => {
      console.log(`Record #${idx + 1}:`)
      console.log(`  _id: ${signup._id}`)
      console.log(`  fullName: ${signup.fullName}`)
      console.log(`  email: ${signup.email}`)
      console.log(`  phone: ${signup.phone}`)
      console.log(`  status: ${signup.status}`)
      console.log(`  createdAt: ${signup.createdAt}`)
    })
  }

  // Search AccountUser
  console.log('\n--- 🔎 SEARCHING AccountUser ---')
  const accs = await AccountUser.find({
    email: targetEmail
  })

  if (accs.length === 0) {
    console.log('❌ No AccountUser records found.')
  } else {
    accs.forEach((acc, idx) => {
      console.log(`Record #${idx + 1}:`)
      console.log(`  _id: ${acc._id}`)
      console.log(`  email: ${acc.email}`)
      console.log(`  role: ${acc.role}`)
      console.log(`  verified: ${acc.verified}`)
      console.log(`  createdAt: ${acc.createdAt}`)
    })
  }

  await mongoose.disconnect()
  console.log('\n✅ Search completed.')
}

run().catch((err) => {
  console.error('❌ Diagnostic search failed:', err)
  process.exit(1)
})
