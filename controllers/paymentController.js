const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const User = require("../models/User");
const generateQR = require("../utils/generateQR");
const sendEmail = require("../utils/sendEmail");

// Create Razorpay order
exports.createOrder = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const amount = user.amountPaid;
    if (!amount)
      return res.status(400).json({ msg: "Amount not set for this user" });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: userId,
    });

    user.orderId = order.id;
    await user.save();

    res.json(order);
  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const user = await User.findOne({ orderId: razorpay_order_id });
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Signature verify
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ msg: "Invalid payment signature" });
    }

    if (user.paymentStatus === "paid") {
      return res.status(400).json({ msg: "Already paid" });
    }

    // Mark paid & generate QR
    user.paymentStatus = "paid";
    user.paymentId = razorpay_payment_id;
    const qr = await generateQR(user.registrationId);
    user.qrCode = qr;
    await user.save();

    // Create activities list
    const activitiesList = user.subCategory && user.subCategory.length > 0
      ? user.subCategory.map(a => `• ${a}`).join('<br>')
      : 'Not specified';

    // Create team members list for hackathon
    let teamInfo = '';
    if (user.subCategory && user.subCategory.includes('Hackathon') && user.teamMembers && user.teamMembers.length > 0) {
      teamInfo = `
        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>👥 Team Members (Hackathon):</strong></p>
          ${user.teamMembers.map((member, idx) => `
            <p style="margin: 5px 0; padding-left: 15px;">
              ${idx === 0 ? '👑 Team Leader: ' : '• '}${member}
            </p>
          `).join('')}
        </div>
      `;
    }

    // Email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px; background: #f9f9f9;">
        <h1 style="color: #06b6d4; text-align: center;">🎟️ Zonex 2026 – Registration Confirmed</h1>
        <p style="font-size: 18px;">Hello <strong>${user.fullName}</strong>,</p>
        <p>Thank you for registering! Your payment was successful.</p>
        
        <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Registration ID:</strong></p>
          <p style="font-size: 28px; font-weight: bold; color: #06b6d4; letter-spacing: 2px;">${user.registrationId}</p>
          
          <p><strong>Event:</strong> Zonex 2026 | 7 March 2026 | Muzaffarnagar</p>
          <p><strong>Category:</strong> ${user.category}</p>
          <p><strong>Activities Selected:</strong><br> ${activitiesList}</p>
          
          ${teamInfo}
          
          <p><strong>Pass:</strong> ${user.passName || "Pro Participation"}</p>
          <p><strong>Amount Paid:</strong> ₹${user.amountPaid}</p>
        </div>


        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 14px; color: #555;">
          Please save this email. Show the registration ID at the registration desk on the day of the event.<br />
          For any queries, reply to this email.
        </p>
        <p style="font-size: 14px; color: #999;">– Team TechMNHub</p>
      </div>
    `;

    // Send email
    try {
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "✅ Zonex 2026 – Your Ticket ",
          html: emailHtml,
        });
        console.log(`📧 Ticket email sent to ${user.email}`);
      }
    } catch (emailErr) {
      console.error("❌ Email send failed:", emailErr);
    }

    res.json({
      msg: "Payment verified & ticket sent to email",
      registrationId: user.registrationId,
      qrCode: user.qrCode,
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};