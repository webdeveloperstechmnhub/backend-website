const Event = require('../models/Event')
const User = require('../models/User')
const Institute = require('../models/Institute')
const SessionBooking = require('../models/SessionBooking')

const normalizeEvent = (event) => ({
  id: String(event._id),
  name: event.name || event.shortName || 'Upcoming Event',
  shortName: event.shortName || event.name || 'Event',
  date: event.date || 'Date to be announced',
  day: event.day || 'Upcoming',
  time: event.time || 'Time to be announced',
  location: event.location || `${event.venue || 'Venue'}, ${event.city || 'City'}`,
  venue: event.venue || 'Venue to be announced',
  city: event.city || 'TBA',
  organizer: event.organizer || 'TechMNHub',
  expectedParticipants: event.expectedParticipants || 'TBA',
  skillZones: event.skillZones || 'TBA',
  prizes: event.prizes || 'TBA',
  description: event.description || 'Details will be announced soon.',
  highlights: Array.isArray(event.highlights) ? event.highlights : [],
  categories: Array.isArray(event.categories) ? event.categories : [],
  tags: Array.isArray(event.tags) ? event.tags : [],
  status: event.status === 'closed' ? 'closed' : 'active',
  registrationDeadline: event.registrationDeadline || 'Not announced',
  registrationLink: event.registrationLink || '/registration-form',
})

exports.getHomepageContent = async (req, res) => {
  try {
    const [totalStudents, paidStudents, checkedInStudents, totalInstitutes, totalEvents, activeEvents, totalBookings, pendingBookings, confirmedBookings, events] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ paymentStatus: 'paid' }),
      User.countDocuments({ checkedIn: true }),
      Institute.countDocuments(),
      Event.countDocuments(),
      Event.countDocuments({ status: 'active' }),
      SessionBooking.countDocuments(),
      SessionBooking.countDocuments({ status: 'pending' }),
      SessionBooking.countDocuments({ status: 'confirmed' }),
      Event.find({ status: 'active' }).sort({ createdAt: -1 }).limit(6),
    ])

    return res.json({
      hero: {
        eyebrow: 'Empowering the next generation',
        title: 'TechMNHub',
        headline: 'Futuristic events, verified student growth, and institute operations in one premium system.',
        description:
          'We help students build credibility, help institutes manage engagement, and help event teams deliver polished experiences with clarity, speed, and confidence.',
        stats: [
          { label: 'Verified profiles', value: `${totalStudents}` },
          { label: 'Institutes onboarded', value: `${totalInstitutes}` },
          { label: 'Events managed', value: `${totalEvents}` },
        ],
        chips: ['Verified profiles', 'Event journeys', 'Institute dashboards'],
        builtFor: ['Students', 'Institutes', 'Coordinators', 'Event teams'],
      },
      whatIsTechMNHub: {
        badge: 'What is TechMNHub',
        title: 'A connected skill ecosystem for students and institutions.',
        subtitle:
          'TechMNHub brings learning records, event participation, institute management, and career-ready proof into a single experience designed to feel sharp, trustworthy, and easy to scan.',
        pillars: [
          {
            title: 'Student Identity',
            copy: 'Verified profiles, certificates, and skill records that make growth visible.',
          },
          {
            title: 'Institute Operations',
            copy: 'Dashboards for students, activities, analytics, and reporting in one place.',
          },
          {
            title: 'Event Journeys',
            copy: 'A polished flow for discovery, registration, participation, and recognition.',
          },
        ],
      },
      whoIsItFor: {
        title: 'Who Is It For?',
        users: [
          {
            title: 'Students',
            description: 'Build your verified skill profile, earn recognition, and unlock real opportunities.',
          },
          {
            title: 'Schools & Colleges',
            description: 'Showcase student achievements, activities and institutional impact in one unified platform.',
          },
          {
            title: 'Institutes / Coaching',
            description: 'Offer certifications, skill programs and gain verified student reach.',
          },
          {
            title: 'Event Organizers',
            description: 'Host competitions, hackathons and reward talent with verified credentials.',
          },
          {
            title: 'Vendors (Coming Soon)',
            description: 'Support student growth with tools, services and ecosystem partnerships.',
          },
        ],
      },
      skillEcosystem: {
        title: 'Skill Ecosystem Preview',
        subtitle: 'From activity to proof, the system turns student progress into something easy to verify and share.',
        steps: ['Skills', 'Activities', 'Proof Upload', 'Skill Points', 'Certificates', 'Rankings'],
      },
      upcomingEvents: {
        badge: "Don't Miss Out",
        title: 'Upcoming Events',
        subtitle: 'Events shown here are controlled directly from the TechMNHub admin panel.',
        events: events.map(normalizeEvent),
      },
      impactStats: {
        title: 'Momentum, you can measure.',
        subtitle:
          'Real outcomes across campuses and districts, built through student-led action and partner trust.',
        note:
          'Gemini-powered events: TechStars and TechFront were conducted to inspire, connect, and empower students with hands-on Gemini AI experiences, workshops, and real-world applications, showcasing innovation and collaboration across campuses.',
        trustLine: 'Trusted by educators, student leaders, and local partners.',
        trustRail: ['Verified cohorts', 'Community-driven', 'Outcomes tracked'],
        metrics: [
          { label: 'Students verified', value: totalStudents },
          { label: 'Students paid', value: paidStudents },
          { label: 'Students checked in', value: checkedInStudents },
          { label: 'Session bookings', value: totalBookings },
          { label: 'Pending sessions', value: pendingBookings },
          { label: 'Confirmed sessions', value: confirmedBookings },
          { label: 'Active events', value: activeEvents },
          { label: 'Institutes onboarded', value: totalInstitutes },
        ],
      },
      mediaAndRecognition: {
        title: 'Featured across the student innovation map.',
        subtitle: 'Press highlights, community spotlights, and the stories that push student talent into the mainstream.',
        logos: ['Campus Daily', 'STEM Spark', 'Youth Works', 'City Pulse', 'EdTech Wire', 'Local Lens'],
        gallery: [
          {
            src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
            alt: 'Students collaborating at a workshop',
            title: 'State summit showcase',
            className: 'tmh-gallery-image',
          },
          {
            src: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
            alt: 'Team presenting a project',
            title: 'Skill sprint finale',
            className: 'tmh-gallery-image tmh-gallery-image-alt',
          },
          {
            src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80',
            alt: 'Students networking at an event',
            title: 'District demo day',
            className: 'tmh-gallery-image',
          },
        ],
      },
      finalCta: {
        title: 'You are not joining a website. You are joining India\'s Student Skill Operating System.',
        subtitle: 'Build skills, lead chapters, and put student potential at the center of the ecosystem.',
        actions: [
          { label: 'Join TechMNHub', to: '/signup', variant: 'primary' },
          { label: 'Book a Session', to: '/book-session', variant: 'secondary' },
          { label: 'Contact Us', to: '/contact', variant: 'ghost' },
        ],
      },
    })
  } catch (error) {
    console.error('Homepage content error:', error)
    return res.status(500).json({ msg: 'Failed to load homepage content.' })
  }
}