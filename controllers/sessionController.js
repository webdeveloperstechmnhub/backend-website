const SessionBooking = require('../models/SessionBooking')
const sendEmail = require('../utils/sendEmail')

const buildSessionPayload = (body) => ({
  instituteName: String(body?.instituteName || '').trim(),
  department: String(body?.department || '').trim(),
  city: String(body?.city || '').trim(),
  contactName: String(body?.contactName || '').trim(),
  email: String(body?.email || '').trim().toLowerCase(),
  phone: String(body?.phone || '').trim(),
  topic: String(body?.topic || '').trim(),
  type: String(body?.type || '').trim(),
  date: String(body?.date || '').trim(),
  time: String(body?.time || '').trim(),
  duration: String(body?.duration || '').trim(),
  students: Number(body?.students || 0),
  audience: String(body?.audience || '').trim(),
  mode: String(body?.mode || '').trim(),
  requirements: String(body?.requirements || '').trim(),
  preferredContactTime: String(body?.preferredContactTime || '').trim(),
})

exports.createSessionBooking = async (req, res) => {
  try {
    const payload = buildSessionPayload(req.body)

    const requiredFields = [
      'instituteName',
      'department',
      'city',
      'contactName',
      'email',
      'phone',
      'topic',
      'type',
      'date',
      'time',
      'duration',
      'audience',
      'mode',
    ]

    const missingField = requiredFields.find((field) => !String(payload[field] || '').trim())
    if (missingField || !Number.isFinite(payload.students) || payload.students < 1) {
      return res.status(400).json({ msg: 'Please complete all required session fields.' })
    }

    const booking = await SessionBooking.create({
      ...payload,
      status: 'pending',
    })

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@techmnhub.com'
    const adminSubject = `New Session Booking: ${payload.topic} by ${payload.contactName}`
    const adminHtml = `
      <h2>New Session Booking Request</h2>
      <p><strong>Event/Topic:</strong> ${payload.topic}</p>
      <p><strong>Sender:</strong> ${payload.contactName} (${payload.email})</p>
      <p><strong>Institute:</strong> ${payload.instituteName}</p>
      <p><strong>Department:</strong> ${payload.department}</p>
      <p><strong>City:</strong> ${payload.city}</p>
      <p><strong>Phone:</strong> ${payload.phone}</p>
      <p><strong>Session Type:</strong> ${payload.type}</p>
      <p><strong>Date & Time:</strong> ${payload.date} at ${payload.time}</p>
      <p><strong>Duration:</strong> ${payload.duration}</p>
      <p><strong>Students:</strong> ${payload.students}</p>
      <p><strong>Audience:</strong> ${payload.audience}</p>
      <p><strong>Mode:</strong> ${payload.mode}</p>
      <p><strong>Requirements:</strong> ${payload.requirements || 'None'}</p>
      <p><strong>Preferred Contact Time:</strong> ${payload.preferredContactTime || 'Not specified'}</p>
      <br>
      <p>Please review and respond to this booking request in the admin panel.</p>
    `
    sendEmail({
      to: adminEmail,
      subject: adminSubject,
      html: adminHtml
    })

    // Send confirmation email to user
    const userSubject = 'Session Booking Received'
    const userHtml = `
      <h2>Thank you for your session booking request!</h2>
      <p>We have received your request for:</p>
      <p><strong>Topic:</strong> ${payload.topic}</p>
      <p><strong>Date/Time:</strong> ${payload.date} ${payload.time}</p>
      <p><strong>Mode:</strong> ${payload.mode}</p>
      <p>Our team will review and contact you soon.</p>
    `
    sendEmail({
      to: payload.email,
      subject: userSubject,
      html: userHtml
    })

    return res.status(201).json({
      msg: 'Session booking created successfully.',
      booking,
    })
  } catch (error) {
    console.error('Create session booking error:', error)
    return res.status(500).json({ msg: 'Failed to create session booking.' })
  }
}

exports.getSessionBookings = async (req, res) => {
  try {
    const status = String(req.query?.status || '').trim()
    const query = status ? { status } : {}
    const bookings = await SessionBooking.find(query).sort({ createdAt: -1 })
    return res.json({ bookings })
  } catch (error) {
    console.error('Fetch session bookings error:', error)
    return res.status(500).json({ msg: 'Failed to load session bookings.' })
  }
}

exports.updateSessionBooking = async (req, res) => {
  try {
    const booking = await SessionBooking.findById(req.params.id)
    if (!booking) {
      return res.status(404).json({ msg: 'Session booking not found.' })
    }

    const nextStatus = String(req.body?.status || '').trim()
    const adminNotes = String(req.body?.adminNotes || '').trim()

    if (nextStatus) {
      const allowedStatuses = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled']
      if (!allowedStatuses.includes(nextStatus)) {
        return res.status(400).json({ msg: 'Invalid session status.' })
      }
      booking.status = nextStatus
    }

    if (adminNotes) {
      booking.adminNotes = adminNotes
    }

    await booking.save()
    return res.json({ msg: 'Session booking updated successfully.', booking })
  } catch (error) {
    console.error('Update session booking error:', error)
    return res.status(500).json({ msg: 'Failed to update session booking.' })
  }
}

exports.deleteSessionBooking = async (req, res) => {
  try {
    const booking = await SessionBooking.findByIdAndDelete(req.params.id)
    if (!booking) {
      return res.status(404).json({ msg: 'Session booking not found.' })
    }

    return res.json({ msg: 'Session booking deleted successfully.' })
  } catch (error) {
    console.error('Delete session booking error:', error)
    return res.status(500).json({ msg: 'Failed to delete session booking.' })
  }
}
