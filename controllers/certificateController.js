const Certificate = require("../models/Certificate");
const Employee = require("../models/Employee");
const sendEmail = require("../utils/sendEmail");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateToCertificate(input) {
  if (!input) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = MONTH_NAMES[now.getMonth()];
    const year = now.getFullYear();
    return `${day} ${month} ${year}`;
  }

  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    return String(input);
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function computeThreeMonthGap(startDateInput) {
  let startObj;
  if (!startDateInput) {
    startObj = new Date();
  } else if (startDateInput instanceof Date) {
    startObj = new Date(startDateInput.getTime());
  } else {
    const parsed = new Date(startDateInput);
    startObj = isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const startDay = startObj.getDate();
  const startMonthIndex = startObj.getMonth();
  const startYear = startObj.getFullYear();
  const formattedStartDate = `${String(startDay).padStart(2, "0")} ${MONTH_NAMES[startMonthIndex]} ${startYear}`;

  // 3-month duration math: Start Month + 2 (e.g. Feb -> Apr)
  const targetMonth = startMonthIndex + 2;
  const targetYear = startYear + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const endDay = Math.min(startDay, daysInTargetMonth);
  const formattedEndDate = `${String(endDay).padStart(2, "0")} ${MONTH_NAMES[normalizedMonth]} ${targetYear}`;

  return {
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    issueDate: formattedEndDate,
  };
}

// Issue or create/upload a certificate to database
exports.issueCertificate = async (req, res) => {
  try {
    const { name, email, role, startDate, endDate, certificateId, issueDate, empId, metadata } = req.body;

    if (!certificateId || !name || !role) {
      return res.status(400).json({ success: false, message: "Certificate ID, Name, and Role are required." });
    }

    const trimmedCertId = certificateId.trim();
    const targetEmpId = (empId || trimmedCertId).trim();

    // Verify employee exists in the employees database
    const employee = await Employee.findOne({
      $or: [
        { empId: targetEmpId },
        { empId: { $regex: `^${targetEmpId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        { empId: trimmedCertId },
      ],
    });

    const verificationUrl = req.body.verificationUrl || `https://techmnhub.com/verify/${trimmedCertId}`;
    const recipientEmail = email || employee?.email || "";

    let certificate = await Certificate.findOne({ certificateId: trimmedCertId });
    if (certificate) {
      certificate.name = name.trim();
      if (recipientEmail) certificate.email = recipientEmail.trim();
      certificate.role = role.trim();
      certificate.startDate = startDate || "";
      certificate.endDate = endDate || "";
      certificate.issueDate = issueDate || "";
      certificate.empId = employee ? employee.empId : targetEmpId;
      certificate.verificationUrl = verificationUrl;
      certificate.status = "valid";
      if (metadata) certificate.metadata = metadata;
      if (req.admin?.name || req.admin?.email) {
        certificate.issuedBy = req.admin.name || req.admin.email;
      }
      await certificate.save();

      return res.status(200).json({
        success: true,
        message: "Certificate updated and saved in database successfully.",
        data: certificate,
        employeeMatched: !!employee,
      });
    }

    certificate = new Certificate({
      certificateId: trimmedCertId,
      empId: employee ? employee.empId : targetEmpId,
      name: name.trim(),
      email: recipientEmail,
      role: role.trim(),
      startDate: startDate || "",
      endDate: endDate || "",
      issueDate: issueDate || "",
      verificationUrl,
      status: "valid",
      metadata: metadata || {},
      issuedBy: req.admin?.name || req.admin?.email || "Admin",
    });

    await certificate.save();

    res.status(201).json({
      success: true,
      message: "Certificate issued and uploaded to database successfully.",
      data: certificate,
      employeeMatched: !!employee,
    });
  } catch (error) {
    console.error("Issue Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// Update an existing certificate (Full editing even after issuance)
exports.updateCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, startDate, endDate, issueDate, status, empId, metadata, verificationUrl } = req.body;

    const certificate = await Certificate.findOne({
      $or: [{ certificateId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!certificate) {
      return res.status(404).json({ success: false, message: "Certificate not found in database." });
    }

    if (name !== undefined) certificate.name = name.trim();
    if (email !== undefined) certificate.email = email.trim();
    if (role !== undefined) certificate.role = role.trim();
    if (startDate !== undefined) certificate.startDate = startDate;
    if (endDate !== undefined) certificate.endDate = endDate;
    if (issueDate !== undefined) certificate.issueDate = issueDate;
    if (status !== undefined) certificate.status = status;
    if (empId !== undefined) certificate.empId = empId.trim();
    if (verificationUrl !== undefined) certificate.verificationUrl = verificationUrl;
    if (metadata !== undefined) certificate.metadata = metadata;

    if (req.admin?.name || req.admin?.email) {
      certificate.issuedBy = req.admin.name || req.admin.email;
    }

    await certificate.save();

    res.status(200).json({
      success: true,
      message: "Certificate updated successfully.",
      data: certificate,
    });
  } catch (error) {
    console.error("Update Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// Batch issue multiple certificates
exports.batchIssueCertificates = async (req, res) => {
  try {
    const { certificates } = req.body;

    if (!Array.isArray(certificates) || certificates.length === 0) {
      return res.status(400).json({ success: false, message: "Certificates array is required." });
    }

    const results = [];
    const issuedBy = req.admin?.name || req.admin?.email || "Admin";

    for (const certData of certificates) {
      const { certificateId, name, email, role, startDate, endDate, issueDate, empId, metadata } = certData;
      if (!certificateId || !name || !role) continue;

      const trimmedId = certificateId.trim();
      const targetEmpId = (empId || trimmedId).trim();
      const verificationUrl = certData.verificationUrl || `https://techmnhub.com/verify/${trimmedId}`;

      const employee = await Employee.findOne({
        $or: [
          { empId: targetEmpId },
          { empId: { $regex: `^${targetEmpId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
          { empId: trimmedId },
        ],
      });

      const recipientEmail = email || employee?.email || "";

      const updated = await Certificate.findOneAndUpdate(
        { certificateId: trimmedId },
        {
          $set: {
            certificateId: trimmedId,
            empId: employee ? employee.empId : targetEmpId,
            name: name.trim(),
            email: recipientEmail,
            role: role.trim(),
            startDate: startDate || "",
            endDate: endDate || "",
            issueDate: issueDate || "",
            verificationUrl,
            status: "valid",
            metadata: metadata || {},
            issuedBy,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      results.push(updated);
    }

    res.status(200).json({
      success: true,
      message: `Successfully issued/uploaded ${results.length} certificates to database.`,
      data: results,
    });
  } catch (error) {
    console.error("Batch Issue Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// Get list of issued certificates with search & pagination
exports.getCertificates = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const queryText = String(req.query.q || "").trim();
    const statusFilter = req.query.status ? String(req.query.status).trim() : null;

    const filter = {};
    if (statusFilter && statusFilter !== "all") {
      filter.status = statusFilter;
    }
    if (queryText) {
      filter.$or = [
        { certificateId: { $regex: queryText, $options: "i" } },
        { empId: { $regex: queryText, $options: "i" } },
        { name: { $regex: queryText, $options: "i" } },
        { role: { $regex: queryText, $options: "i" } },
        { email: { $regex: queryText, $options: "i" } },
      ];
    }

    const [certificates, total] = await Promise.all([
      Certificate.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Certificate.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: certificates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Get Certificates Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// Get single certificate by ID
exports.getCertificateById = async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findOne({
      $or: [{ certificateId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!certificate) {
      return res.status(404).json({ success: false, message: "Certificate not found." });
    }

    res.status(200).json({ success: true, data: certificate });
  } catch (error) {
    console.error("Get Certificate By ID Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// Delete certificate
exports.deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Certificate.findOneAndDelete({
      $or: [{ certificateId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Certificate not found." });
    }

    res.status(200).json({ success: true, message: "Certificate deleted successfully." });
  } catch (error) {
    console.error("Delete Certificate Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// Send Certificate via Email
exports.sendCertificateEmail = async (req, res) => {
  try {
    const {
      certificateId,
      recipientEmail,
      name,
      role,
      startDate,
      endDate,
      issueDate,
      verificationUrl,
      pdfBase64,
      imagePngBase64,
      customMessage,
    } = req.body;

    const certId = String(certificateId || req.params?.id || "").trim();
    if (!certId) {
      return res.status(400).json({ success: false, message: "Certificate ID is required." });
    }

    // Look up certificate from database
    const certRecord = await Certificate.findOne({
      $or: [{ certificateId: certId }, { _id: certId.match(/^[0-9a-fA-F]{24}$/) ? certId : null }],
    });

    // Look up employee record
    const empRecord = await Employee.findOne({
      $or: [
        { empId: certRecord?.empId || certId },
        { empId: { $regex: `^${(certRecord?.empId || certId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      ],
    });

    const targetEmail = recipientEmail || certRecord?.email || empRecord?.email;
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: "No email address found for recipient. Please provide a recipient email address.",
      });
    }

    const recipientName = name || certRecord?.name || empRecord?.name || "Intern";
    const recipientRole = role || certRecord?.role || empRecord?.designation || "Technology Intern";
    const durationStart = startDate || certRecord?.startDate || "Start Date";
    const durationEnd = endDate || certRecord?.endDate || "End Date";
    const certIssueDate = issueDate || certRecord?.issueDate || formatDateToCertificate(new Date());
    const verifyLink = verificationUrl || certRecord?.verificationUrl || `https://techmnhub.com/verify/${certId}`;

    // Prepare attachments if provided
    const attachments = [];
    if (pdfBase64) {
      let cleanBase64 = String(pdfBase64).trim();
      if (cleanBase64.includes(";base64,")) {
        cleanBase64 = cleanBase64.split(";base64,")[1];
      } else if (cleanBase64.startsWith("data:")) {
        cleanBase64 = cleanBase64.replace(/^data:[^,]+,/, "");
      }
      attachments.push({
        filename: `TechMNHub_Certificate_${certId}.pdf`,
        content: Buffer.from(cleanBase64, "base64"),
        contentType: "application/pdf",
        contentDisposition: "attachment",
      });
    } else if (imagePngBase64) {
      let cleanBase64 = String(imagePngBase64).trim();
      if (cleanBase64.includes(";base64,")) {
        cleanBase64 = cleanBase64.split(";base64,")[1];
      } else if (cleanBase64.startsWith("data:")) {
        cleanBase64 = cleanBase64.replace(/^data:[^,]+,/, "");
      }
      attachments.push({
        filename: `TechMNHub_Certificate_${certId}.png`,
        content: Buffer.from(cleanBase64, "base64"),
        contentType: "image/png",
        contentDisposition: "attachment",
      });
    }

    const emailSubject = `Official Certificate of Internship Completion - ${recipientName} (${certId})`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b0c10; color: #ffffff; padding: 40px 20px; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background: #12141c; border: 1px solid rgba(239, 195, 79, 0.3); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #181b26 0%, #0d0f15 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #efc34f;">
            <div style="font-size: 24px; font-weight: 800; color: #efc34f; letter-spacing: 2px; text-transform: uppercase;">
              TECHMNHUB
            </div>
            <div style="font-size: 11px; color: #a0aec0; letter-spacing: 3px; margin-top: 4px; text-transform: uppercase;">
              Empowering Future Innovators
            </div>
          </div>

          <!-- Body Content -->
          <div style="padding: 32px 28px;">
            <p style="font-size: 16px; color: #e2e8f0; margin-top: 0;">
              Dear <strong>${recipientName}</strong>,
            </p>
            
            <p style="color: #cbd5e1; font-size: 14px;">
              Congratulations on successfully completing your tenure with <strong>TechMNHub</strong>. We are proud to present your official, digitally verifiable <strong>Certificate of Internship Completion</strong>.
            </p>

            ${customMessage ? `<div style="background: rgba(239, 195, 79, 0.08); border-left: 3px solid #efc34f; padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #f1f5f9;">${customMessage}</div>` : ""}

            <!-- Certificate Summary Card -->
            <div style="background: #090a0f; border: 1px solid #232734; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8; width: 40%;">Certificate ID:</td>
                  <td style="padding: 6px 0; color: #38bdf8; font-family: monospace; font-weight: bold;">${certId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Designation:</td>
                  <td style="padding: 6px 0; color: #efc34f; font-weight: 600;">${recipientRole}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Internship Period:</td>
                  <td style="padding: 6px 0; color: #f8fafc;">${durationStart} to ${durationEnd}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Date of Issue:</td>
                  <td style="padding: 6px 0; color: #f8fafc;">${certIssueDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Status:</td>
                  <td style="padding: 6px 0; color: #10b981; font-weight: bold;">● Officially Verified</td>
                </tr>
              </table>
            </div>

            <!-- Verification Button -->
            <div style="text-align: center; margin: 30px 0 20px;">
              <a href="${verifyLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #dcb03d 0%, #efc34f 100%); color: #000000; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 15px rgba(239, 195, 79, 0.3);">
                View & Verify Certificate Online →
              </a>
            </div>

            <p style="text-align: center; font-size: 11px; color: #64748b; margin-top: 10px;">
              Direct Verification URL:<br/>
              <a href="${verifyLink}" style="color: #38bdf8; text-decoration: underline; word-break: break-all;">${verifyLink}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #090a0f; border-top: 1px solid #1e222d; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b;">
            <p style="margin: 0 0 6px 0;">This is an official automated document from TechMNHub Central Credential Services.</p>
            <p style="margin: 0;">© ${new Date().getFullYear()} TechMNHub. All rights reserved. • <a href="https://techmnhub.com" style="color: #efc34f; text-decoration: none;">techmnhub.com</a></p>
          </div>

        </div>
      </div>
    `;

    await sendEmail({
      to: targetEmail,
      subject: emailSubject,
      html: emailHtml,
      attachments,
    });

    res.status(200).json({
      success: true,
      message: `Certificate successfully sent to ${targetEmail}.`,
      data: {
        to: targetEmail,
        certificateId: certId,
        hasAttachment: attachments.length > 0,
      },
    });
  } catch (error) {
    console.error("Send Certificate Email Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send certificate email.",
    });
  }
};

// Verify a certificate (Public)
// REQUIREMENT: Must exist in Certificate collection (uploaded to DB) AND match Employee collection!
exports.verifyCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const searchId = String(id || "").trim();

    if (!searchId) {
      return res.status(400).json({
        success: false,
        isFake: true,
        message: "Fake Certificate: Missing or invalid intern / certificate ID.",
      });
    }

    const escapedId = searchId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // STEP 1: Check Certificate collection FIRST!
    // Must be officially issued / uploaded to the database!
    const certificate = await Certificate.findOne({
      $or: [
        { certificateId: searchId },
        { certificateId: { $regex: `^${escapedId}$`, $options: "i" } },
        { empId: searchId },
        { empId: { $regex: `^${escapedId}$`, $options: "i" } },
      ],
    }).lean();

    if (!certificate) {
      return res.status(404).json({
        success: false,
        isFake: true,
        message: "Fake Certificate: This certificate has not been officially generated, issued, or uploaded to the database.",
      });
    }

    // STEP 2: Check if certificate is revoked
    if (certificate.status === "revoked") {
      return res.status(400).json({
        success: false,
        isFake: true,
        message: "Fake / Revoked Certificate: This certificate has been officially revoked by TechMNHub administration.",
        data: certificate,
      });
    }

    // STEP 3: Check Employee collection!
    // Must match a registered intern/employee in the database
    const targetEmpId = certificate.empId || searchId;
    const employee = await Employee.findOne({
      $or: [
        { empId: targetEmpId },
        { empId: { $regex: `^${targetEmpId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        { empId: searchId },
      ],
    }).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        isFake: true,
        message: "Fake Certificate: Intern ID is not registered in the official TechMNHub employees database.",
        data: certificate,
      });
    }

    // STEP 4: Certificate is officially issued in DB, not revoked, and matches an employee!
    const verifiedData = {
      certificateId: certificate.certificateId,
      empId: employee.empId || certificate.empId,
      name: certificate.name || employee.name,
      email: certificate.email || employee.email,
      role: certificate.role || employee.designation || "Technology Intern",
      startDate: certificate.startDate,
      endDate: certificate.endDate,
      issueDate: certificate.issueDate,
      verificationUrl: certificate.verificationUrl || `https://techmnhub.com/verify/${certificate.certificateId}`,
      status: "valid",
      issuedBy: certificate.issuedBy || "TechMNHub Administration",
      createdAt: certificate.createdAt || employee.createdAt || new Date(),
      employeeMatched: true,
      employeeDetails: {
        empId: employee.empId,
        name: employee.name,
        designation: employee.designation,
        department: employee.department,
        employmentStatus: employee.employmentStatus,
      },
    };

    return res.status(200).json({
      success: true,
      isVerified: true,
      message: "Certificate officially verified against database and employee records.",
      data: verifiedData,
    });
  } catch (error) {
    console.error("Verify Certificate Error:", error);
    return res.status(500).json({
      success: false,
      isFake: true,
      message: "Fake Certificate: Verification error occurred.",
      error: error.message,
    });
  }
};

// Get list of active employees for certificate generation
exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ employmentStatus: { $ne: "terminated" } })
      .select("empId name email designation department joiningDate createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Get Certificate Employees Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
