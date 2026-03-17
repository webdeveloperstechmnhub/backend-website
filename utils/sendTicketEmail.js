const User = require("../models/User");
const generateQR = require("./generateQR");
const buildQrEmailAttachment = require("./qrEmailAttachment");
const sendEmail = require("./sendEmail");

/**
 * Send ticket email to a user (by userId or user object)
 * @param {string|object} userInput - userId (string) or user object
 * @returns {Promise<{success: boolean, provider: string, email: string, registrationId: string}>}
 */
const sendTicketEmail = async (userInput) => {
  try {
    let user;

    if (typeof userInput === "string") {
      user = await User.findById(userInput);
      if (!user) {
        throw new Error(`User not found with ID: ${userInput}`);
      }
    } else if (typeof userInput === "object" && userInput._id) {
      user = userInput;
    } else {
      throw new Error("Invalid input: pass userId (string) or user object");
    }

    console.log(`🎫 Sending ticket email to ${user.fullName} (${user.email})`);

    if (!user.email) {
      throw new Error(`User ${user._id} has no email address`);
    }

    if (!user.registrationId) {
      throw new Error(`User ${user._id} has no registrationId`);
    }

    if (!user.qrCode) {
      console.log(`⚠️  User has no stored QR code, regenerating...`);
      user.qrCode = await generateQR(user.registrationId);
      await user.save();
    }

    const qrAttachment = buildQrEmailAttachment(
      user.qrCode,
      `${user.registrationId}-qr.png`,
    );

    const qrBlock = qrAttachment
      ? `
        <div style="margin: 20px 0; text-align: center;">
          <img src="cid:${qrAttachment.contentId}" alt="QR Code" style="width: 220px; height: 220px; border-radius: 10px; border: 2px solid #06b6d4;" />
          <p style="font-size: 12px; color: #999; margin-top: 10px;">Scan this QR at venue entrance</p>
        </div>
      `
      : "";

    const activitiesList =
      user.subCategory && user.subCategory.length > 0
        ? user.subCategory.map((a) => `• ${a}`).join("<br>")
        : "Not specified";

    let teamInfo = "";
    if (
      user.teamMembers &&
      user.teamMembers.length > 0 &&
      user.subCategory &&
      user.subCategory.includes("Hackathon")
    ) {
      teamInfo = `
        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>👥 Team Members (Hackathon):</strong></p>
          ${user.teamMembers
            .map(
              (member, idx) => `
            <p style="margin: 5px 0; padding-left: 15px;">
              ${idx === 0 ? "👑 Team Leader: " : "• "}${member}
            </p>
          `,
            )
            .join("")}
        </div>
      `;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 30px; background: #f9f9f9;">
        <h1 style="color: #06b6d4; text-align: center;">🎟️ Zonex 2026 – Registration Confirmed</h1>
        <p style="font-size: 18px;">Hello <strong>${user.fullName}</strong>,</p>
        <p>Thank you for registering! Your payment was successful.</p>
        
        <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Registration ID:</strong></p>
          <p style="font-size: 28px; font-weight: bold; color: #06b6d4; letter-spacing: 2px;">${user.registrationId}</p>

          ${qrBlock}
          
          <p><strong>Event:</strong> Zonex 2026 | 7 March 2026 | Muzaffarnagar</p>
          <p><strong>Category:</strong> ${user.category || "Not specified"}</p>
          <p><strong>Activities Selected:</strong><br> ${activitiesList}</p>
          
          ${teamInfo}
          
          <p><strong>Pass:</strong> ${user.passName || "Pro Participation"}</p>
          <p><strong>Amount Paid:</strong> ₹${user.amountPaid || 0}</p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 14px; color: #555;">
          Please save this email. Show the QR code or Registration ID at the registration desk on the day of the event.<br />
          For any queries, reply to this email.
        </p>
        <p style="font-size: 14px; color: #999;">– Team TechMNHub</p>
      </div>
    `;

    const attachments = qrAttachment ? [qrAttachment] : [];
    const result = await sendEmail({
      to: user.email,
      subject: "✅ Zonex 2026 – Your Ticket",
      html: emailHtml,
      attachments,
    });

    console.log(`✅ Ticket email sent to ${user.email} via ${result.provider}`);

    return {
      success: true,
      provider: result.provider,
      email: user.email,
      registrationId: user.registrationId,
    };
  } catch (err) {
    console.error(`❌ Failed to send ticket email:`, err.message || err);
    throw err;
  }
};

module.exports = sendTicketEmail;
