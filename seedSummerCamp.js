const mongoose = require('mongoose');
const Event = require('./models/Event');

const uri = MONGO_URI;

const eventData = {
  name: 'TechMNHub Future Skills Summer Camp 2026',
  title: 'TechMNHub Future Skills Summer Camp 2026',
  shortName: 'Future Skills Summer Camp 2026',
  slug: 'future-skills-summer-camp-2026',
  subtitle: 'Future-ready learning for students in Class 6th-12th',
  date: '1 June, 2026',
  day: 'Saturday',
  time: '09:00 AM - 02:00 PM',
  timings: '09:00 AM - 02:00 PM',
  location: 'TechMNHub Campus, Delhi NCR',
  venue: 'TechMNHub Campus',
  city: 'Delhi NCR',
  organizer: 'TechMNHub',
  expectedParticipants: '200+',
  skillZones: '5+',
  prizes: 'Certificates & Rewards',
  description: 'A premium summer camp for school students to learn AI, coding, public speaking and future-ready skills through live projects and mentor-led sessions.',
  shortDescription: 'A premium summer camp for future-ready students.',
  fullDescription: 'The TechMNHub Future Skills Summer Camp 2026 brings together young learners for hands-on AI, coding, communication and creativity workshops guided by expert mentors.',
  category: 'Summer Camp',
  eventType: 'summer_camp',
  highlights: ['Live AI & coding labs', 'Team challenges', 'Confidence-building sessions', 'Certificate on completion'],
  categories: ['Summer Camp', 'AI', 'Coding', 'Public Speaking', 'Creativity'],
  tags: ['Summer Camp', 'AI', 'Creative Learning', 'Future Skills'],
  registrationDeadline: '25 May, 2026',
  refundPolicy: 'Full refund available until camp start date.',
  registrationLink: '/summer-camp-registration',
  contact: { email: 'support@techmnhub.com', phone: '+91 98765 43210' },
  entryFee: { pro: 'Rs 399', visitor: 'Rs 399' },
  ticketInventory: { pro: { price: 399, total: 100 }, visitor: { price: 399, total: 0 } },
  ticketTypes: [
    { key: 'basic-pass', name: 'Basic Pass', price: 399, total: 100, remainingSeats: 100, appliesTo: 'All', features: ['Camp access', 'Mentor-led sessions'], description: 'Core camp access with guided sessions.' },
    { key: 'smart-pass', name: 'Smart Pass', price: 599, total: 60, remainingSeats: 60, appliesTo: 'All', features: ['Camp access', 'Certificate', 'Extra coaching'], description: 'Includes extra project coaching and activities.' },
    { key: 'premium-pass', name: 'Premium Pass', price: 999, total: 30, remainingSeats: 30, appliesTo: 'All', features: ['Premium mentor clinics', 'Rewards kit'], description: 'Full premium experience with mentor clinics.' },
  ],
  registrationSettings: { enabled: true, deadline: new Date('2026-05-25'), maxRegistrations: 190, waitingList: true, autoConfirmation: true },
  displayOptions: { mediaTile: true, statsTile: true, eligibilityTile: true, highlightsTile: true, scheduleTile: true, passesTile: true, rewardsTile: true, seoTile: true, contactTile: true, registrationTile: true },
  eligibility: { minClass: '6th', maxClass: '12th', boardsAccepted: ['CBSE', 'ICSE', 'State Boards'], ageGroup: '10-18' },
  certificates: ['Participation Certificate'],
  awards: ['Best Learner Award'],
  gifts: ['Camp Kit'],
  rewardPrizes: ['Premium goodies'],
  seo: { metaTitle: 'TechMNHub Future Skills Summer Camp 2026', metaDescription: 'Join the premium Summer Camp for AI, coding, public speaking, and future-ready skills.', keywords: ['summer camp', 'future skills', 'AI camp', 'coding bootcamp'], openGraphImage: '' },
  featured: true,
  status: 'active',
  publishedAt: new Date(),
};

mongoose.connect(uri).then(async () => {
  const existing = await Event.findOne({ $or: [{ shortName: /future skills summer camp 2026/i }, { slug: 'future-skills-summer-camp-2026' }] });
  if (existing) {
    console.log('ALREADY_EXISTS');
    console.log({ _id: existing._id.toString(), shortName: existing.shortName, slug: existing.slug, status: existing.status, category: existing.category, eventType: existing.eventType, registrationLink: existing.registrationLink });
    process.exit(0);
  }

  const created = await Event.create(eventData);
  console.log('CREATED');
  console.log({ _id: created._id.toString(), shortName: created.shortName, slug: created.slug, status: created.status, category: created.category, eventType: created.eventType, registrationLink: created.registrationLink });
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
