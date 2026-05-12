const SessionBooking = require('../models/SessionBooking')

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
