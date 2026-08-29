/**
 * scripts/verifyLeaderboardLogic.js
 *
 * Runs database level validation tests for:
 * 1. XP rankings (points DESC)
 * 2. Primary tie-breaker (createdAt ASC)
 * 3. Deterministic tie-breaker (_id ASC)
 *
 * Execution: node scripts/verifyLeaderboardLogic.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const Ambassador = require('../models/Ambassador')
const AmbassadorSchool = require('../models/AmbassadorSchool')

async function run() {
  console.log('⚡ Starting Ambassador Leaderboard Auditing and Test Script...')
  await mongoose.connect(process.env.MONGO_URI)
  console.log('✅ MongoDB connected successfully.')

  // 1. Create a dummy school for test ambassadors
  let school = await AmbassadorSchool.findOne({ name: '_TEST_Leaderboard_School' })
  if (!school) {
    school = await AmbassadorSchool.create({ name: '_TEST_Leaderboard_School', city: 'Test City' })
  }

  // 2. Clean up any previous test ambassadors
  await Ambassador.deleteMany({ fullName: { $regex: /^(_TEST_|Rahul|Priya|Aman|Neha)/ } })
  console.log('🧹 Cleaned up existing test records.')

  // 3. Define test ambassadors
  const testData = [
    {
      fullName: '_TEST_Rahul Sharma',
      points: 50,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      email: 'rahul.test@techmnhub.com',
      instagramId: 'rahul_test',
      mobileNumber: '9999999991',
      className: 'Class 10',
      city: 'Test City',
    },
    {
      fullName: '_TEST_Priya Singh',
      points: 50,
      createdAt: new Date('2026-02-01T10:00:00Z'),
      email: 'priya.test@techmnhub.com',
      instagramId: 'priya_test',
      mobileNumber: '9999999992',
      className: 'Class 10',
      city: 'Test City',
    },
    {
      fullName: '_TEST_Aman Gupta',
      points: 20,
      createdAt: new Date('2026-01-05T10:00:00Z'),
      email: 'aman.test@techmnhub.com',
      instagramId: 'aman_test',
      mobileNumber: '9999999993',
      className: 'Class 10',
      city: 'Test City',
    },
    {
      fullName: '_TEST_Neha Verma',
      points: 20,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      email: 'neha.test@techmnhub.com',
      instagramId: 'neha_test',
      mobileNumber: '9999999994',
      className: 'Class 10',
      city: 'Test City',
    },
    // Bulk tie-breakers: Same XP (20), same createdAt (Jan 1, 2026)
    {
      fullName: '_TEST_Bulk_Rahul',
      points: 20,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      email: 'bulk.rahul.test@techmnhub.com',
      instagramId: 'bulk_rahul_test',
      mobileNumber: '9999999995',
      className: 'Class 10',
      city: 'Test City',
    },
    {
      fullName: '_TEST_Bulk_Priya',
      points: 20,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      email: 'bulk.priya.test@techmnhub.com',
      instagramId: 'bulk_priya_test',
      mobileNumber: '9999999996',
      className: 'Class 10',
      city: 'Test City',
    },
    {
      fullName: '_TEST_Bulk_Aman',
      points: 20,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      email: 'bulk.aman.test@techmnhub.com',
      instagramId: 'bulk_aman_test',
      mobileNumber: '9999999997',
      className: 'Class 10',
      city: 'Test City',
    },
  ]

  // 4. Insert each record manually to preserve exact timestamps
  console.log('📝 Seeding test ambassadors...')
  const inserted = []
  for (const item of testData) {
    const amb = new Ambassador({
      ...item,
      schoolId: school._id,
      approved: true,
    })
    // Bypass timestamps option to inject raw createdAt
    amb.createdAt = item.createdAt
    await amb.save()
    inserted.push(amb)
  }
  console.log(`✅ Successfully seeded ${inserted.length} test ambassadors.`)

  // 5. Query and verify order
  const getLeaderboardList = async () => {
    return await Ambassador.find({ fullName: { $regex: /^_TEST_/ } })
      .populate('schoolId', 'name')
      .sort({ points: -1, createdAt: 1, _id: 1 })
  }

  const list1 = await getLeaderboardList()

  console.log('\n--- 📊 LEADERBOARD QUERY RESULTS ---')
  list1.forEach((amb, idx) => {
    console.log(
      `Rank #${idx + 1}: ${amb.fullName.padEnd(25)} | XP: ${String(amb.points).padEnd(4)} | Joined: ${amb.createdAt.toISOString()} | ID: ${amb._id}`
    )
  })

  // 6. Validations
  console.log('\n--- 🔍 VALIDATION CHECKS ---')

  const results = {
    test1_rahul_priya: false,
    test2_aman_neha: false,
    test3_bulk_stable: true,
  }

  // Check 1: Rahul Sharma (50 XP, Jan 1) ranks above Priya Singh (50 XP, Feb 1)
  const idxRahul = list1.findIndex((x) => x.fullName === '_TEST_Rahul Sharma')
  const idxPriya = list1.findIndex((x) => x.fullName === '_TEST_Priya Singh')
  if (idxRahul !== -1 && idxPriya !== -1 && idxRahul < idxPriya) {
    results.test1_rahul_priya = true
    console.log('✅ PASS: Rahul Sharma (older account age) ranked above Priya Singh.')
  } else {
    console.log('❌ FAIL: Rahul Sharma did not rank above Priya Singh.')
  }

  // Check 2: Aman Gupta (20 XP, Jan 5) ranks above Neha Verma (20 XP, Mar 1)
  const idxAman = list1.findIndex((x) => x.fullName === '_TEST_Aman Gupta')
  const idxNeha = list1.findIndex((x) => x.fullName === '_TEST_Neha Verma')
  if (idxAman !== -1 && idxNeha !== -1 && idxAman < idxNeha) {
    results.test2_aman_neha = true
    console.log('✅ PASS: Aman Gupta ranked above Neha Verma.')
  } else {
    console.log('❌ FAIL: Aman Gupta did not rank above Neha Verma.')
  }

  // Check 3: Bulk tie-breakers resolved stable across multiple calls
  const bulkAman = list1.find((x) => x.fullName === '_TEST_Bulk_Aman')
  const bulkPriya = list1.find((x) => x.fullName === '_TEST_Bulk_Priya')
  const bulkRahul = list1.find((x) => x.fullName === '_TEST_Bulk_Rahul')

  const expectedBulkSort = [bulkAman, bulkPriya, bulkRahul].sort((a, b) =>
    String(a._id).localeCompare(String(b._id))
  )

  // Verify list1 order for bulk items matches String ID localeCompare
  const bulkNamesInList = list1
    .filter((x) => x.fullName.includes('_TEST_Bulk_'))
    .map((x) => x.fullName)
  const expectedBulkNames = expectedBulkSort.map((x) => x.fullName)

  const isBulkSortedCorrectly = JSON.stringify(bulkNamesInList) === JSON.stringify(expectedBulkNames)

  if (isBulkSortedCorrectly) {
    console.log('✅ PASS: Bulk same-day tie-breaker resolved strictly by deterministic _id order.')
    console.log(`   Order of bulk resolved items: ${bulkNamesInList.join(' -> ')}`)
  } else {
    results.test3_bulk_stable = false
    console.log('❌ FAIL: Bulk same-day tie-breaker did not resolve by _id order.')
  }

  // Re-fetch multiple times to verify 100% stable determinism
  console.log('\n🔄 Re-fetching to test stability across 5 successive runs...')
  let isStable = true
  const list1Ids = list1.map((x) => String(x._id))

  for (let runIdx = 1; runIdx <= 5; runIdx++) {
    const listN = await getLeaderboardList()
    const listNIds = listN.map((x) => String(x._id))
    if (JSON.stringify(list1Ids) !== JSON.stringify(listNIds)) {
      isStable = false
      console.log(`❌ Run #${runIdx}: unstable ordering detected!`)
    }
  }

  if (isStable) {
    console.log('✅ PASS: Order is 100% deterministic and stable across multiple refetches.')
  } else {
    console.log('❌ FAIL: Ordering is not stable across refetches.')
  }

  // 7. Cleaning up test data
  console.log('\n🧹 Cleaning up test data...')
  await Ambassador.deleteMany({ fullName: { $regex: /^_TEST_/ } })
  await AmbassadorSchool.deleteOne({ _id: school._id })
  console.log('✅ Cleanup finished successfully.')

  await mongoose.disconnect()

  const allPass = results.test1_rahul_priya && results.test2_aman_neha && results.test3_bulk_stable && isStable
  if (allPass) {
    console.log('\n💯 ALL TESTS PASSED! Student Ambassador Leaderboard tie-breaker system is production-ready!')
    process.exit(0)
  } else {
    console.log('\n🔴 SOME TESTS FAILED! Review ranking sorts.')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('❌ Verification failed:', err)
  process.exit(1)
})
