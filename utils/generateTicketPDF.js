const { generatePdf } = require("html-pdf-node");
const QRCode = require("qrcode");

/**
 * Generate a Base64 QR code image for the ticket.
 * Falls back to null if generation fails — PDF still renders without it.
 */
async function generateTicketQR(user, event, registrationId) {
  try {
    // Encode ONLY the registrationId — this is what verifyRegistration() searches
    // in the DB: User.findOne({ registrationId })
    // Do NOT encode JSON or a URL — the check-in scanner sends this value directly.
    const qrImage = await QRCode.toDataURL(registrationId, {
      errorCorrectionLevel: "H",  // high — best scan reliability
      margin: 2,
      width: 280,
      color: { dark: "#0891b2", light: "#ffffff" },
    });

    console.log(`🔲 PDF QR generated for ${registrationId}:`, qrImage.substring(0, 30));
    return qrImage;
  } catch (err) {
    console.error("⚠️ QR code generation failed (PDF will continue without it):", err.message);
    return null;
  }
}

/**
 * Generate ticket HTML template with embedded QR code.
 */
function generateTicketHTML(user, event, registrationId, qrDataUrl) {
  const eventName = event?.name || "TechMNHub Event";
  const eventDate = event?.date
    ? new Date(event.date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date TBD";
  const eventCity = event?.city || "Venue TBD";
  const eventDetails = [eventDate, eventCity].filter(Boolean).join(" • ");

  const activitiesList =
    user.subCategory && user.subCategory.length > 0
      ? user.subCategory.map((a) => `<li>${a}</li>`).join("")
      : "<li>Not specified</li>";

  let teamInfo = "";
  if (user.teamMembers && user.teamMembers.length > 0) {
    teamInfo = `
      <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">👥 Team Members:</p>
        ${user.teamMembers
          .map(
            (member, idx) =>
              `<p style="margin: 5px 0; padding-left: 15px;">${idx === 0 ? "👑 " : "• "}${member}</p>`,
          )
          .join("")}
      </div>
    `;
  }

  // QR section — shown only when a valid data URL is available
  const qrSection = qrDataUrl
    ? `
      <div style="
        text-align: center;
        margin: 30px 0;
        padding: 24px 20px;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-radius: 12px;
        border: 2px dashed #06b6d4;
      ">
        <p style="
          font-size: 11px;
          color: #0891b2;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 700;
          margin-bottom: 16px;
        ">🔍 Scan to Verify Ticket</p>

        <img
          src="${qrDataUrl}"
          alt="Ticket QR Code"
          style="
            width: 160px;
            height: 160px;
            border-radius: 10px;
            border: 3px solid #06b6d4;
            display: block;
            margin: 0 auto;
          "
        />

        <p style="
          font-size: 10px;
          color: #64748b;
          margin-top: 12px;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.5px;
        ">${registrationId}</p>

        <p style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
          Present this QR at the check-in desk
        </p>
      </div>
    `
    : `
      <div style="
        text-align: center;
        padding: 20px;
        background: #f0f9ff;
        border-radius: 8px;
        border-left: 4px solid #06b6d4;
        margin: 20px 0;
      ">
        <p style="font-size: 20px; font-weight: bold; color: #06b6d4; letter-spacing: 2px; font-family: 'Courier New', monospace;">
          ${registrationId}
        </p>
        <p style="font-size: 11px; color: #999; margin-top: 6px;">Registration ID — present at check-in</p>
      </div>
    `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
          padding: 20px;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        }
        .header {
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; font-weight: 600; }
        .header p { font-size: 14px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .info-section { margin-bottom: 25px; }
        .info-section h3 {
          font-size: 14px;
          color: #0891b2;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          border-bottom: 2px solid #06b6d4;
          padding-bottom: 8px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .info-row label { color: #666; font-weight: 500; }
        .info-row value { color: #333; font-weight: 600; }
        .activities-list { list-style: none; padding-left: 0; }
        .activities-list li {
          padding: 8px 0;
          color: #333;
          font-size: 14px;
          border-bottom: 1px solid #e5e7eb;
        }
        .activities-list li:last-child { border-bottom: none; }
        .activities-list li:before {
          content: "✓ ";
          color: #06b6d4;
          font-weight: bold;
          margin-right: 8px;
        }
        .footer {
          background: #f9f9f9;
          padding: 20px 30px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .footer p { margin: 5px 0; }
        .highlight {
          background: #fef3c7;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #f59e0b;
        }
        .highlight p { font-size: 13px; color: #333; margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎟️ Event Registration Confirmed</h1>
          <p>${eventName}</p>
        </div>

        <div class="content">
          <div style="font-size: 16px; margin-bottom: 20px;">
            Hello <strong>${user.fullName}</strong>,
          </div>
          <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            Your registration for ${eventName} has been confirmed. Please find your ticket details below.
          </p>

          <!-- QR Code Section -->
          ${qrSection}

          <div class="info-section">
            <h3>📍 Event Information</h3>
            <div class="info-row">
              <label>Event:</label>
              <value>${eventName}</value>
            </div>
            <div class="info-row">
              <label>Date &amp; Location:</label>
              <value>${eventDetails}</value>
            </div>
          </div>

          <div class="info-section">
            <h3>👤 Your Details</h3>
            <div class="info-row">
              <label>Full Name:</label>
              <value>${user.fullName}</value>
            </div>
            <div class="info-row">
              <label>Email:</label>
              <value>${user.email}</value>
            </div>
            <div class="info-row">
              <label>Mobile:</label>
              <value>${user.mobile}</value>
            </div>
            <div class="info-row">
              <label>City:</label>
              <value>${user.city || "Not specified"}</value>
            </div>
            <div class="info-row">
              <label>College:</label>
              <value>${user.college || "Not specified"}</value>
            </div>
            ${user.courseYear ? `<div class="info-row"><label>Year:</label><value>${user.courseYear}</value></div>` : ""}
          </div>

          <div class="info-section">
            <h3>🎯 Activities Selected</h3>
            <ul class="activities-list">
              ${activitiesList}
            </ul>
          </div>

          ${teamInfo}

          <div class="info-section">
            <h3>💳 Payment Information</h3>
            <div class="info-row">
              <label>Pass Type:</label>
              <value>${user.ticketDescription || user.passName || "Standard Pass"}</value>
            </div>
            <div class="info-row">
              <label>Amount Paid:</label>
              <value>₹${user.amountPaid}</value>
            </div>
            <div class="info-row">
              <label>Payment Status:</label>
              <value style="color: #10b981; font-weight: bold;">✓ PAID</value>
            </div>
          </div>

          <div class="highlight">
            <p><strong>⚠️ Important:</strong> Please bring this ticket to the event. Present the QR code or Registration ID at the check-in desk.</p>
          </div>
        </div>

        <div class="footer">
          <p><strong>TechMNHub</strong></p>
          <p>Thank you for registering! We look forward to seeing you at the event.</p>
          <p style="margin-top: 10px; color: #999;">For queries, contact: support@techmnhub.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate PDF from ticket HTML with embedded QR code.
 */
async function generateTicketPDF(user, event, registrationId) {
  try {
    // Generate QR first (non-blocking — null on failure)
    const qrDataUrl = await generateTicketQR(user, event, registrationId);

    const htmlContent = generateTicketHTML(user, event, registrationId, qrDataUrl);

    const options = {
      format: "A4",
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      displayHeaderFooter: false,
      headerTemplate: "",
      footerTemplate: "",
      printBackground: true,
    };

    const file = { content: htmlContent };
    const pdfBuffer = await generatePdf(file, options);

    return {
      filename: `${registrationId}-ticket.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    };
  } catch (err) {
    console.error("❌ PDF generation error:", err);
    return null;
  }
}

module.exports = { generateTicketPDF, generateTicketHTML };
