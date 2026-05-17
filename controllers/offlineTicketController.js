const User = require("../models/User");
const Event = require("../models/Event");
const generateQR = require("../utils/generateQR");
const sendEmail = require("../utils/sendEmail");

// Generate unique registration ID with event-specific prefix
function generateRegistrationId(eventShortName) {
  const slug = (eventShortName || "EVT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${slug}-${random}`;
}

// Generate ticket for offline registration
exports.generateOfflineTicket = async (req, res) => {
  try {
    const {
      fullName,
      mobile,
      email,
      city,
      college,
      courseYear,
      ticketDescription,
      subCategory,
      teamMembers,
      passName,
      passType,
      amountPaid,
      paymentMode,
      portfolio,
      github,
      instagram,
      eventId,
      eventShortName,
    } = req.body;

    // Validation
    if (!fullName || !mobile || !email || !ticketDescription || !passName) {
      return res.status(400).json({ msg: "Please fill all required fields" });
    }

    if (mobile.length !== 10) {
      return res.status(400).json({ msg: "Invalid mobile number" });
    }

    if (!subCategory || subCategory.length === 0) {
      return res.status(400).json({ msg: "Please select at least one activity" });
    }

    // Load event if provided, for prefix and email branding
    let event = null;
    let resolvedEventShortName = eventShortName || "EVT";
    if (eventId) {
      event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ msg: "Event not found" });
      if (event.status === "closed") return res.status(400).json({ msg: "Event is closed. No new registrations allowed." });
      resolvedEventShortName = event.shortName || event.name || resolvedEventShortName;
    }

    // Check if email already exists (scope by event if provided)
    const emailQuery = eventId ? { email, eventId } : { email };
    const existingUser = await User.findOne(emailQuery);
    if (existingUser) {
      return res.status(400).json({
        msg: "This email is already registered for this event. Registration ID: " + existingUser.registrationId,
      });
    }

    // Generate unique registration ID
    let registrationId;
    let isUnique = false;
    while (!isUnique) {
      registrationId = generateRegistrationId(resolvedEventShortName);
      const existing = await User.findOne({ registrationId });
      if (!existing) isUnique = true;
    }

    // Generate QR Code
    const qrCode = await generateQR(registrationId);

    // Create user in database
    const newUser = new User({
      fullName,
      mobile,
      email,
      city,
      college,
      courseYear,
      ticketDescription,
      subCategory,
      teamMembers: teamMembers || [],
      passName,
      passType: passType || passName,
      amountPaid: amountPaid || 0,
      paymentMode,
      portfolio,
      github,
      instagram,
      registrationId,
      qrCode,
      paymentStatus: "paid",
      paymentId: `OFFLINE_${Date.now()}`,
      ...(eventId && { eventId }),
      ...(resolvedEventShortName && { eventShortName: resolvedEventShortName }),
    });

    await newUser.save();

    console.log(`✅ Offline ticket generated: ${registrationId} for ${email}`);

    res.json({
      msg: "Ticket generated successfully",
      registrationId,
      qrCode,
      user: newUser,
      eventName: event ? (event.name || resolvedEventShortName) : resolvedEventShortName,
    });

  } catch (err) {
    console.error("❌ Offline ticket generation error:", err);
    res.status(500).json({ msg: err.message || "Server error" });
  }
};

// Send ticket email (separate endpoint for offline tickets)
exports.sendOfflineTicketEmail = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Load event for branding
    let eventName = "TechMNHub Event";
    let eventDetails = "Check the official website for event details.";
    if (user.eventId) {
      const event = await Event.findById(user.eventId);
      if (event) {
        eventName = event.name || eventName;
        const eventDate = event.date ? new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
        const eventCity = event.city || "";
        if (eventDate || eventCity) eventDetails = [eventDate, eventCity].filter(Boolean).join(" | ");
      }
    }

    // Create activities list
    const activitiesList = user.subCategory && user.subCategory.length > 0
      ? user.subCategory.map(a => `• ${a}`).join('<br>')
      : 'Not specified';

    // Create team members list
    let teamInfo = '';
    if (user.teamMembers && user.teamMembers.length > 0) {
      teamInfo = `
        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>👥 Team Members:</strong></p>
          ${user.teamMembers.map((member, idx) => `
            <p style="margin: 5px 0; padding-left: 15px;">
              ${idx === 0 ? '👑 ' : '• '}${member}
            </p>
          `).join('')}
        </div>
      `;
    }

    // Email HTML with QR code
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px; background: #f9f9f9;">
        <h1 style="color: #06b6d4; text-align: center;">🎟️ ${eventName} – Registration Confirmed</h1>
        <p style="font-size: 18px;">Hello <strong>${user.fullName}</strong>,</p>
        <p>Welcome to ${eventName}! Your offline registration has been confirmed.</p>
        
        <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p><strong>Registration ID:</strong></p>
          <p style="font-size: 28px; font-weight: bold; color: #06b6d4; letter-spacing: 2px;">${user.registrationId}</p>
          
          <div style="margin: 20px 0;">
            <img src="${user.qrCode}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 10px; border: 2px solid #06b6d4;" />
            <p style="font-size: 12px; color: #999; margin-top: 10px;">Scan this at venue entrance</p>
          </div>
        </div>

        <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Event:</strong> ${eventName} | ${eventDetails}</p>
          <p><strong>Ticket Description:</strong> ${user.ticketDescription}</p>
          <p><strong>Activities Selected:</strong><br> ${activitiesList}</p>
          
          ${teamInfo}
          
          <p><strong>Pass:</strong> ${user.passName || "Pro Participation"}</p>
          <p><strong>Amount Paid:</strong> ₹${user.amountPaid}</p>
          <p><strong>Payment Mode:</strong> ${user.paymentMode || "Offline"}</p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 14px; color: #555;">
          Please save this email. Show the QR code or Registration ID at the registration desk on the day of the event.<br />
          For any queries, reply to this email.
        </p>
        <p style="font-size: 14px; color: #999;">– Team TechMNHub</p>
      </div>
    `;

    // Send email
    await sendEmail({
      to: user.email,
      subject: `✅ ${eventName} – Your Ticket (Offline Registration)`,
      html: emailHtml,
    });

    console.log(`📧 Offline ticket email sent to ${user.email}`);

    res.json({
      msg: "Email sent successfully",
      email: user.email,
    });

  } catch (err) {
    console.error("❌ Email send error:", err);
    res.status(500).json({ msg: err.message || "Failed to send email" });
  }
};

module.exports = exports;
