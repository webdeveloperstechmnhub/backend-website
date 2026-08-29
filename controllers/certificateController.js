const Certificate = require("../models/Certificate");
const Employee = require("../models/Employee");

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

// Issue or update a certificate
exports.issueCertificate = async (req, res) => {
  try {
    const { name, role, startDate, endDate, certificateId, issueDate, empId, metadata } = req.body;

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

    let certificate = await Certificate.findOne({ certificateId: trimmedCertId });
    if (certificate) {
      certificate.name = name.trim();
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
        message: "Certificate updated successfully.",
        data: certificate,
        employeeMatched: !!employee,
      });
    }

    certificate = new Certificate({
      certificateId: trimmedCertId,
      empId: employee ? employee.empId : targetEmpId,
      name: name.trim(),
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
      message: "Certificate issued successfully.",
      data: certificate,
      employeeMatched: !!employee,
    });
  } catch (error) {
    console.error("Issue Certificate Error:", error);
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
      const { certificateId, name, role, startDate, endDate, issueDate, empId, metadata } = certData;
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

      const updated = await Certificate.findOneAndUpdate(
        { certificateId: trimmedId },
        {
          $set: {
            certificateId: trimmedId,
            empId: employee ? employee.empId : targetEmpId,
            name: name.trim(),
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
      message: `Successfully issued/updated ${results.length} certificates.`,
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
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const queryText = String(req.query.q || "").trim();
    const statusFilter = req.query.status ? String(req.query.status).trim() : null;

    const filter = {};
    if (statusFilter) {
      filter.status = statusFilter;
    }
    if (queryText) {
      filter.$or = [
        { certificateId: { $regex: queryText, $options: "i" } },
        { empId: { $regex: queryText, $options: "i" } },
        { name: { $regex: queryText, $options: "i" } },
        { role: { $regex: queryText, $options: "i" } },
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

// Delete or revoke certificate
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

// Verify a certificate (Public)
// MATCHES INTERN ID FIRST AGAINST EMPLOYEES DATABASE
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

    // STEP 1: Check Employee Collection FIRST!
    const employee = await Employee.findOne({
      $or: [
        { empId: searchId },
        { empId: { $regex: `^${escapedId}$`, $options: "i" } },
        { _id: searchId.match(/^[0-9a-fA-F]{24}$/) ? searchId : null },
      ],
    }).lean();

    // Check if there is an explicit certificate record in Certificate collection
    const certificate = await Certificate.findOne({
      $or: [
        { certificateId: searchId },
        { certificateId: { $regex: `^${escapedId}$`, $options: "i" } },
        { empId: searchId },
        { empId: employee ? employee.empId : searchId },
      ],
    }).lean();

    // If Certificate exists and is revoked
    if (certificate && certificate.status === "revoked") {
      return res.status(400).json({
        success: false,
        isFake: true,
        message: "Fake / Revoked Certificate: This certificate has been officially revoked by TechMNHub.",
        data: certificate,
      });
    }

    // STEP 2: If NO matching employee found in Employee database
    if (!employee) {
      return res.status(404).json({
        success: false,
        isFake: true,
        message: "Fake Certificate: Intern ID does not exist in the official TechMNHub employees database.",
      });
    }

    // STEP 3: Employee IS matched in the Employee database!
    // Compute or fetch verified dates with 3-month gap
    const defaultDates = computeThreeMonthGap(employee.joiningDate || employee.createdAt);

    const verifiedData = {
      certificateId: certificate?.certificateId || employee.empId,
      empId: employee.empId,
      name: certificate?.name || employee.name,
      role: certificate?.role || employee.designation || "Technology Intern",
      startDate: certificate?.startDate || defaultDates.startDate,
      endDate: certificate?.endDate || defaultDates.endDate,
      issueDate: certificate?.issueDate || defaultDates.issueDate,
      verificationUrl: certificate?.verificationUrl || `https://techmnhub.com/verify/${employee.empId}`,
      status: "valid",
      issuedBy: certificate?.issuedBy || "TechMNHub Administration",
      createdAt: certificate?.createdAt || employee.createdAt || new Date(),
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
      message: "Certificate verified successfully against employee database.",
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
      .select("empId name designation department joiningDate createdAt")
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
