const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const User = require("../models/User");
const generateQR = require("../utils/generateQR");
const sendEmail = require("../utils/sendEmail");
const buildQrEmailAttachment = require("../utils/qrEmailAttachment");
const { generateTicketPDF } = require("../utils/generateTicketPDF");

const buildSummerEmail = (user) => {
  const subject = '🚀 Welcome To TechMNHub Future Skills Summer Camp 2026';
  const passColorMap = {
    'Basic Pass': '#1E90FF',
    'basic-pass': '#1E90FF',
    'Smart Pass': '#D4AF37',
    'smart-pass': '#D4AF37',
    'Premium Pass': '#111111',
    'premium-pass': '#111111',
  };
  const passColor = passColorMap[user.passName] || passColorMap[user.passType] || '#1E90FF';
  const heroImageUrl = process.env.SUMMER_HERO_IMAGE || '';
  const verificationUrl = (process.env.SITE_URL || 'https://www.techmnhub.com') + `/registration/${encodeURIComponent(user.registrationId)}`;

  const emailHtml = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>TechMNHub Summer Camp Ticket</title>
  </head>
  <body style="margin:0;background:#06060a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e7e7e7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-width:320px;">
      <tr><td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-radius:14px;overflow:hidden;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.18));box-shadow:0 10px 30px rgba(0,0,0,0.6);">

          <tr>
            <td style="padding:28px 28px 8px; background:linear-gradient(90deg,#0b0f1a 0%, #08111a 60%);">
              <div style="display:flex;align-items:center;gap:16px;">
                <div style="flex:1;">
                  <p style="margin:0;font-size:12px;letter-spacing:0.18em;color:#ffd966;text-transform:uppercase;">Premium Summer Camp</p>
                  <h1 style="margin:8px 0 6px;font-size:22px;line-height:1.05;color:#fff;font-weight:800;">Welcome To TechMNHub Future Skills Summer Camp 2026 🚀</h1>
                  <p style="margin:0;color:#d7d7d7;font-size:14px;">Garmi Ki Chutti, AI Ke Saath!</p>
                </div>
                <div style="flex:0 0 84px;text-align:right;">
                  <div style="display:inline-block;padding:8px 12px;border-radius:12px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.12);color:#ffd966;font-weight:700;">${user.passName || user.passType || ''}</div>
                </div>
              </div>
              <div style="margin-top:14px;">
                <img src="${heroImageUrl}" alt="" width="100%" style="width:100%;max-height:140px;object-fit:cover;border-radius:12px;margin-top:12px;display:block;" />
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 20px;background:linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.22));">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;background:rgba(255,255,255,0.02);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.04);">
                <tr>
                  <td style="padding:16px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;width:62%;">
                          <div style="border-radius:10px;padding:14px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.08));">
                            <p style="margin:0;font-size:12px;color:#ffd966;font-weight:700;letter-spacing:0.08em;">DIGITAL PASS</p>
                            <h2 style="margin:8px 0 6px;font-size:18px;color:#fff;">${user.fullName || ''}</h2>
                            <p style="margin:0;color:#cfcfcf;font-size:13px;">Pass: <strong style="color:#fff">${user.passName || user.passType || ''}</strong></p>

                            <div style="margin-top:12px;padding:10px;border-radius:8px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.02);">
                              <p style="margin:0;font-size:12px;color:#aeb2b8;">Registration ID</p>
                              <p style="margin:6px 0 0;font-size:16px;font-weight:800;color:#fff;">${user.registrationId}</p>
                            </div>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                              <tr>
                                <td style="padding-right:8px;font-size:13px;color:#cfcfcf;">Venue</td>
                                <td style="text-align:right;color:#fff;font-weight:700;">${user.venue || process.env.SUMMER_VENUE || 'SD College of Engineering & Technology'}</td>
                              </tr>
                              <tr>
                                <td style="padding-top:6px;font-size:13px;color:#cfcfcf;">Timing</td>
                                <td style="padding-top:6px;text-align:right;color:#fff;font-weight:700;">${user.timing || process.env.SUMMER_TIMING || '10:00 AM – 2:00 PM'}</td>
                              </tr>
                              <tr>
                                <td style="padding-top:6px;font-size:13px;color:#cfcfcf;">Reporting</td>
                                <td style="padding-top:6px;text-align:right;color:#fff;font-weight:700;">${user.reportingDate || process.env.SUMMER_REPORTING || ''}</td>
                              </tr>
                            </table>

                          </div>
                        </td>

                        <td style="vertical-align:top;width:38%;text-align:center;">
                          <div style="display:inline-block;padding:12px;border-radius:12px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.08));border:1px solid rgba(255,255,255,0.04);">
                            <img src="cid:ticketqr@techmnhub" alt="QR Code" width="140" height="140" style="display:block;border-radius:10px;border:6px solid rgba(212,175,55,0.08);background:#fff;" />
                          </div>
                          <p style="margin:10px 0 0;font-size:12px;color:#cfcfcf;">Scan at entry</p>
                          <div style="margin-top:8px;padding:6px 10px;border-radius:999px;display:inline-block;background:${passColor};color:#0b0b0c;font-weight:800;font-size:12px;">${user.passName || user.passType || ''}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 20px;">
              <h3 style="margin:0 0 10px;color:#ffd966;font-size:16px;">Event Details</h3>
              <p style="margin:0 0 14px;color:#cfcfcf;font-size:14px;">Venue: <strong style="color:#fff">${user.venue || process.env.SUMMER_VENUE || 'SD College of Engineering & Technology'}</strong> • Timing: <strong style="color:#fff">${user.timing || process.env.SUMMER_TIMING || '10:00 AM – 2:00 PM'}</strong> • Duration: <strong style="color:#fff">10 Days</strong></p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  <td style="padding:10px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid rgba(255,255,255,0.02);">
                    <p style="margin:0;font-weight:700;color:#fff;">What Students Will Experience</p>
                    <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">AI Learning</span>
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">AI Games</span>
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">Coding Fun</span>
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">Public Speaking</span>
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">Team Challenges</span>
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">Quiz Competitions</span>
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">Smart Campus Experience</span>
                      <span style="display:inline-block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);color:#ffd966;font-weight:700;font-size:13px;">Surprise Gifts</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 20px;background:linear-gradient(180deg, transparent, rgba(255,255,255,0.01));">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;padding-right:10px;">
                    <h4 style="margin:0 0 8px;color:#ffd966;font-size:14px;">What To Bring</h4>
                    <ul style="margin:0;padding-left:18px;color:#cfcfcf;font-size:14px;line-height:1.5;">
                      <li>Notebook & Pen</li>
                      <li>Water Bottle</li>
                      <li>Mobile Phone (optional)</li>
                      <li>Positive Energy 😄</li>
                    </ul>
                  </td>
                  <td style="vertical-align:top;padding-left:10px;">
                    <h4 style="margin:0 0 8px;color:#ffd966;font-size:14px;">Important Notice</h4>
                    <p style="margin:0;color:#cfcfcf;font-size:13px;">Students may be featured in TechMNHub social media activities, reels, and event highlights.</p>
                    <div style="margin-top:12px;padding:10px;border-radius:8px;background:rgba(212,175,55,0.06);color:#fff;font-weight:700;font-size:13px;">Top performers will receive special recognition & surprise rewards.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 20px;text-align:center;">
              <div style="padding:18px;border-radius:10px;background:linear-gradient(90deg, rgba(255,255,255,0.01), rgba(0,0,0,0.18));border:1px solid rgba(255,255,255,0.02);">
                <h3 style="margin:0 0 6px;color:#fff;font-size:18px;">Your Future Skills Journey Starts Soon… 🚀</h3>
                <p style="margin:0;color:#cfcfcf;font-size:13px;">Get ready — exciting learning, prizes & surprises await.</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 20px;border-top:1px solid rgba(255,255,255,0.02);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <p style="margin:0 0 6px;font-size:13px;color:#cfcfcf;">Contact us</p>
                    <p style="margin:0;font-size:14px;color:#fff;">📞 9259586175 &nbsp; • &nbsp; 📧 <a href="mailto:techmnhub.team@gmail.com" style="color:#ffd966;text-decoration:none;">techmnhub.team@gmail.com</a> &nbsp; • &nbsp; 🌐 <a href="http://www.techmnhub.com" style="color:#ffd966;text-decoration:none;">www.techmnhub.com</a></p>
                  </td>
                  <td style="vertical-align:top;text-align:right;">
                    <p style="margin:0;font-size:12px;color:#9aa0a6;">Need help? Reply to this email or call us.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 20px 26px;color:#8f9498;font-size:12px;text-align:center;">
              <p style="margin:0;">– Team TechMNHub</p>
              <p style="margin:6px 0 0;">This email contains your digital pass. Keep it for entry.</p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
    <style type="text/css">
      @media screen and (max-width:480px) {
        h1 { font-size:18px !important; }
        h2 { font-size:16px !important; }
        table[role=presentation] img { max-width:100% !important; height:auto !important; }
        td { padding-left:12px !important; padding-right:12px !important; }
      }
    </style>
  </body>
  </html>`;

  return { subject, emailHtml };
};

exports.buildSummerEmail = buildSummerEmail;

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

    // Email HTML — choose template based on event
    const eventName = String(user.eventShortName || user.eventShortName || '').toLowerCase();
    const isSummer = eventName.includes('summer') || eventName.includes('future skills') || (user.eventShortName && String(user.eventShortName).toLowerCase().includes('summer'));

    let emailHtml = '';
    let subject = '';
    let qrBuffer = null;  // PNG Buffer for CID inline attachment

    // Generate QR as Buffer (works correctly as CID attachment in all clients)
    try {
      const QRCode = require('qrcode');
      qrBuffer = await QRCode.toBuffer(user.registrationId, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
      });
      console.log('🔲 Email QR buffer generated:', qrBuffer.length, 'bytes');
    } catch (qrErr) {
      console.error('⚠️ Email QR generation failed:', qrErr.message);
    }

    if (isSummer) {
      const built = buildSummerEmail(user);
      subject = built.subject;
      emailHtml = built.emailHtml;
    } else {
      subject = '✅ TechMNHub – Your Ticket';
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px; background: #f9f9f9;">
          <h1 style="color: #06b6d4; text-align: center;">🎟️ TechMNHub – Registration Confirmed</h1>
          <p style="font-size: 18px;">Hello <strong>${user.fullName}</strong>,</p>
          <p>Thank you for registering! Your payment was successful.</p>

          <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Registration ID:</strong></p>
            <p style="font-size: 28px; font-weight: bold; color: #06b6d4; letter-spacing: 2px;">${user.registrationId}</p>

            ${qrBuffer ? `
            <div style="text-align: center; margin: 24px 0; padding: 16px; background: #f0f9ff; border-radius: 12px; border: 2px dashed #06b6d4;">
              <p style="font-size: 11px; color: #0891b2; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: bold;">🔍 Scan to Check In</p>
              <img
                src="cid:ticketqr@techmnhub"
                alt="QR Code"
                width="180"
                height="180"
                style="display:block;margin:0 auto;border-radius:10px;border:3px solid #06b6d4;background:#fff;"
              />
              <p style="font-size: 11px; color: #999; margin-top: 10px;">Show this at the registration desk</p>
            </div>` : ''}

            <p><strong>Event:</strong> TechMNHub | 7 March 2026 | Muzaffarnagar</p>
            <p><strong>Category:</strong> ${user.category}</p>
            <p><strong>Activities Selected:</strong><br> ${activitiesList}</p>

            ${teamInfo}

            <p><strong>Pass:</strong> ${user.passName || "Pro Participation"}</p>
            <p><strong>Amount Paid:</strong> ₹${user.amountPaid}</p>
          </div>

          <hr style="border: none; border-top: 1px solid #ddd;" />
          <p style="font-size: 14px; color: #555;">
            Please save this email. Show the QR code at the registration desk on the day of the event.<br />
            For any queries, reply to this email.
          </p>
          <p style="font-size: 14px; color: #999;">– Team TechMNHub</p>
        </div>
      `;
    }

    // Send email with QR code and PDF ticket attachments
    try {
      if (user.email) {
        let emailAttachments = [];
        
        // Attachments: QR inline CID + QR downloadable PNG + PDF ticket
        if (qrBuffer) {
          // 1. Inline — cid:ticketqr@techmnhub renders inside email body
          emailAttachments.push({
            filename: `${user.registrationId}-qr.png`,
            content: qrBuffer,
            contentType: 'image/png',
            contentId: 'ticketqr@techmnhub',
            contentDisposition: 'inline',
          });
          // 2. Downloadable PNG — separate file attachment
          emailAttachments.push({
            filename: `${user.registrationId}-qr.png`,
            content: qrBuffer,
            contentType: 'image/png',
            contentDisposition: 'attachment',
          });
        }

        // Add PDF ticket attachment
        try {
          const pdfTicket = await generateTicketPDF(user, { name: user.eventShortName || 'TechMNHub Event', date: user.eventDate, city: user.city }, user.registrationId);
          if (pdfTicket) {
            emailAttachments.push(pdfTicket);
          }
        } catch (pdfErr) {
          console.error("⚠️ PDF ticket generation failed, continuing with email:", pdfErr.message);
        }

        await sendEmail({
          to: user.email,
          subject,
          html: emailHtml,
          attachments: emailAttachments,
        });
        console.log(`📧 Ticket email sent to ${user.email} with ${emailAttachments.length} attachments`);
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