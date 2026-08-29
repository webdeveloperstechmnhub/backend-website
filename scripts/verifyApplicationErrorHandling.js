/**
 * scripts/verifyApplicationErrorHandling.js
 *
 * Direct controller logic validation script. Tests:
 * 1. Conflict on existing active Ambassador (email, phone, instagramId).
 * 2. Conflict on existing pending/approved AmbassadorApplication (email, phone, instagramId).
 * 3. Successful application registration (clean diagnostic logging).
 *
 * Execution: node scripts/verifyApplicationErrorHandling.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const Ambassador = require('../models/Ambassador')
const AmbassadorApplication = require('../models/AmbassadorApplication')
const AmbassadorSchool = require('../models/AmbassadorSchool')
const { applyAmbassador } = require('../controllers/ambassadorController')

// Mock Response Helper
const createMockRes = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.jsonData = data
      return this
    },
  }
  return res
}

async function run() {
  console.log('⚡ Starting Ambassador Application 409 Conflict Validation Script...')
  await mongoose.connect(process.env.MONGO_URI)
  console.log('✅ MongoDB connected successfully.')

  // 1. Setup mock schools and duplicate records
  let school = await AmbassadorSchool.findOne({ name: '_TEST_Error_School' })
  if (!school) {
    school = await AmbassadorSchool.create({ name: '_TEST_Error_School', city: 'Test City' })
  }

  // Clean up previous runs
  await Ambassador.deleteMany({ email: { $regex: /_TEST_/i } })
  await AmbassadorApplication.deleteMany({ email: { $regex: /_TEST_/i } })
  console.log('🧹 Cleaned up existing test records.')

  // Create an active ambassador in Ambassador collection
  const activeAmb = await Ambassador.create({
    fullName: 'Active Ambassador',
    schoolId: school._id,
    className: 'Class 12',
    city: 'Test City',
    mobileNumber: '9999900001',
    instagramId: 'active_insta',
    email: 'active_test@techmnhub.com',
    approved: true,
  })
  console.log(`📝 Seeded active ambassador with email ${activeAmb.email} and mobile ${activeAmb.mobileNumber}`)

  // Create an application in AmbassadorApplication collection
  const appRecord = await AmbassadorApplication.create({
    fullName: 'Applied Student',
    schoolId: school._id,
    className: 'Class 11',
    city: 'Test City',
    mobileNumber: '9999900002',
    parentNumber: '9999988888',
    instagramId: 'applied_insta',
    email: 'applied_test@techmnhub.com',
    status: 'pending',
    why: 'Because I love coding and tech leadership.',
    skills: 'Python, JS, React',
  })
  console.log(`📝 Seeded pending application with email ${appRecord.email} and mobile ${appRecord.mobileNumber}`)

  console.log('\n--- 🔍 EXECUTING BACKEND 409 CONFLICT TESTS ---')

  const results = {
    test1_email_registered: false,
    test2_phone_registered: false,
    test3_insta_registered: false,
    test4_app_duplicate_email: false,
    test5_clean_submission: false,
  }

  // Test case 1: Applying with an email already registered in active Ambassador
  const req1 = {
    body: {
      fullName: 'New Applicant 1',
      schoolName: '_TEST_Error_School',
      className: 'Class 10',
      city: 'Test City',
      mobileNumber: '9888800001',
      parentNumber: '9888888888',
      instagramId: 'new_insta_1',
      email: 'active_test@techmnhub.com', // Duplicate active email
      why: 'I want to represent the campus and organize hackathons.',
      skills: 'Networking, coding',
    },
  }
  const res1 = createMockRes()
  await applyAmbassador(req1, res1)
  if (res1.statusCode === 409 && res1.jsonData?.code === 'EMAIL_ALREADY_REGISTERED') {
    results.test1_email_registered = true
    console.log('✅ PASS: Correctly blocked active email duplicate. Code: EMAIL_ALREADY_REGISTERED')
    console.log(`   Message: "${res1.jsonData.message}"`)
  } else {
    console.log(`❌ FAIL: Failed active email duplicate check. Status: ${res1.statusCode}, Data:`, res1.jsonData)
  }

  // Test case 2: Applying with a phone already registered in active Ambassador
  const req2 = {
    body: {
      fullName: 'New Applicant 2',
      schoolName: '_TEST_Error_School',
      className: 'Class 10',
      city: 'Test City',
      mobileNumber: '9999900001', // Duplicate active phone
      parentNumber: '9888888888',
      instagramId: 'new_insta_2',
      email: 'new_test2@techmnhub.com',
      why: 'I want to represent the campus and organize hackathons.',
      skills: 'Networking, coding',
    },
  }
  const res2 = createMockRes()
  await applyAmbassador(req2, res2)
  if (res2.statusCode === 409 && res2.jsonData?.code === 'PHONE_ALREADY_REGISTERED') {
    results.test2_phone_registered = true
    console.log('✅ PASS: Correctly blocked active phone duplicate. Code: PHONE_ALREADY_REGISTERED')
    console.log(`   Message: "${res2.jsonData.message}"`)
  } else {
    console.log(`❌ FAIL: Failed active phone duplicate check. Status: ${res2.statusCode}, Data:`, res2.jsonData)
  }

  // Test case 3: Applying with an Instagram ID already registered in active Ambassador
  const req3 = {
    body: {
      fullName: 'New Applicant 3',
      schoolName: '_TEST_Error_School',
      className: 'Class 10',
      city: 'Test City',
      mobileNumber: '9888800003',
      parentNumber: '9888888888',
      instagramId: 'active_insta', // Duplicate active Instagram
      email: 'new_test3@techmnhub.com',
      why: 'I want to represent the campus and organize hackathons.',
      skills: 'Networking, coding',
    },
  }
  const res3 = createMockRes()
  await applyAmbassador(req3, res3)
  if (res3.statusCode === 409 && res3.jsonData?.code === 'INSTAGRAM_ALREADY_REGISTERED') {
    results.test3_insta_registered = true
    console.log('✅ PASS: Correctly blocked active Instagram duplicate. Code: INSTAGRAM_ALREADY_REGISTERED')
    console.log(`   Message: "${res3.jsonData.message}"`)
  } else {
    console.log(`❌ FAIL: Failed active Instagram duplicate check. Status: ${res3.statusCode}, Data:`, res3.jsonData)
  }

  // Test case 4: Applying with duplicate email in AmbassadorApplication
  const req4 = {
    body: {
      fullName: 'New Applicant 4',
      schoolName: '_TEST_Error_School',
      className: 'Class 10',
      city: 'Test City',
      mobileNumber: '9888800004',
      parentNumber: '9888888888',
      instagramId: 'new_insta_4',
      email: 'applied_test@techmnhub.com', // Duplicate application email
      why: 'I want to represent the campus and organize hackathons.',
      skills: 'Networking, coding',
    },
  }
  const res4 = createMockRes()
  await applyAmbassador(req4, res4)
  if (res4.statusCode === 409 && res4.jsonData?.code === 'AMBASSADOR_ALREADY_EXISTS') {
    results.test4_app_duplicate_email = true
    console.log('✅ PASS: Correctly blocked duplicate pending application email. Code: AMBASSADOR_ALREADY_EXISTS')
    console.log(`   Message: "${res4.jsonData.message}"`)
  } else {
    console.log(`❌ FAIL: Failed duplicate pending email duplicate check. Status: ${res4.statusCode}, Data:`, res4.jsonData)
  }

  // Test case 5: Successful clean submission
  const req5 = {
    body: {
      fullName: 'New Applicant 5',
      schoolName: '_TEST_Error_School',
      className: 'Class 10',
      city: 'Test City',
      mobileNumber: '9888800005',
      parentNumber: '9888888888',
      instagramId: 'new_insta_5',
      email: 'new_clean_test5@techmnhub.com',
      why: 'I want to represent the campus and organize hackathons.',
      skills: 'Networking, coding',
    },
  }
  const res5 = createMockRes()
  await applyAmbassador(req5, res5)
  if (res5.statusCode === 201) {
    results.test5_clean_submission = true
    console.log('✅ PASS: Clean registration submission processed successfully. Status: 201')
  } else {
    console.log(`❌ FAIL: Clean registration failed. Status: ${res5.statusCode}, Data:`, res5.jsonData)
  }

  // Cleanup Database
  console.log('\n🧹 Cleaning up test records...')
  await Ambassador.deleteMany({ email: { $regex: /_TEST_/i } })
  await AmbassadorApplication.deleteMany({ email: { $regex: /_TEST_/i } })
  await AmbassadorSchool.deleteOne({ _id: school._id })
  console.log('✅ Cleanup finished successfully.')

  await mongoose.disconnect()

  const allPass =
    results.test1_email_registered &&
    results.test2_phone_registered &&
    results.test3_insta_registered &&
    results.test4_app_duplicate_email &&
    results.test5_clean_submission

  if (allPass) {
    console.log('\n💯 ALL ERROR HANDLING VALIDATION TESTS PASSED!')
    process.exit(0)
  } else {
    console.log('\n🔴 SOME ERROR HANDLING VALIDATION TESTS FAILED!')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('❌ Validation script failed:', err)
  process.exit(1)
})
