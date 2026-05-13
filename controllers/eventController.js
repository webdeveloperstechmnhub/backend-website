const Event = require("../models/Event");
const User = require("../models/User");

const EVENT_CATEGORIES = new Set([
  "Summer Camp",
  "Workshop",
  "Bootcamp",
  "Competition",
  "AI Training",
  "Seminar",
  "Webinar",
  "",
]);

const LEGACY_EVENT_DATA = {
  name: "ZONEX 2026 - Where Talent Takes Shape",
  title: "ZONEX 2026 - Where Talent Takes Shape",
  shortName: "Zonex 2026",
  slug: "zonex-2026",
  subtitle: "Where Talent Takes Shape",
  date: "7 March, 2026",
  day: "Saturday",
  time: "9:00 AM - 5:00 PM",
  timings: "9:00 AM - 5:00 PM",
  location: "S.D. College of Engineering and Technology, Jansath Road, Muzaffarnagar",
  venue: "S.D. College of Engineering and Technology, Jansath Road",
  city: "Muzaffarnagar",
  organizer: "TechMNHub",
  expectedParticipants: "800+",
  skillZones: "10+",
  prizes: "Cash Rewards",
  description:
    "ZONEX is a one-day skill discovery and opportunity festival bringing together students from multiple colleges and schools.",
  shortDescription: "A one-day skill discovery and opportunity festival.",
  fullDescription:
    "ZONEX is a one-day skill discovery and opportunity festival bringing together students from multiple colleges and schools to showcase talent in technology, creativity, leadership, performance, and innovation.",
  highlights: ["800+ Expected Participants", "10+ Skill Zones", "Hackathon with Cash Prizes"],
  categories: ["Performance", "Hackathon", "Startup Pitch", "Creative Arts", "Communication", "Visitor"],
  tags: ["Festival", "Talent Show", "Hackathon", "Networking"],
  registrationDeadline: "3 March, 2026",
  refundPolicy: "No refund after confirmation",
  registrationLink: "/registration-form",
  contact: {
    email: "techmnhub.team@gmail.com",
    phone: "+91 9259586175",
  },
  entryFee: {
    pro: "Rs 150",
    visitor: "Rs 150",
  },
  ticketInventory: {
    pro: { price: 150, total: 0 },
    visitor: { price: 150, total: 0 },
  },
  ticketTypes: [
    {
      key: "pro-participation",
      name: "Pro Participation",
      price: 150,
      total: 0,
      remainingSeats: 0,
      appliesTo: "Participation",
      features: ["Entry to 2-3 skill zones", "Event access"],
      description: "Entry to 2-3 skill zones with event access.",
    },
    {
      key: "visitor-pass",
      name: "Visitor Pass",
      price: 150,
      total: 0,
      remainingSeats: 0,
      appliesTo: "Visitor",
      features: ["Venue access"],
      description: "Venue access for visitors.",
    },
  ],
  status: "published",
  publishedAt: new Date(),
};

const toTrimmedString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const normalizeStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => toTrimmedString(item)).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parsePositiveNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const slugify = (value, fallback = "event") => {
  const normalized = toTrimmedString(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizePasses = (ticketTypes = [], entryFee = {}, ticketInventory = {}) => {
  const source = Array.isArray(ticketTypes) ? ticketTypes : [];
  const seen = new Set();
  const normalized = source
    .map((pass, index) => {
      const name = toTrimmedString(pass?.name);
      if (!name) return null;
      let key = slugify(pass?.key || name, `pass-${index + 1}`);
      while (seen.has(key)) key = `${key}-${index + 1}`;
      seen.add(key);
      const total = parsePositiveNumber(pass?.total ?? pass?.seatLimit, 0);
      const remainingSeats = parsePositiveNumber(pass?.remainingSeats, total);
      return {
        key,
        name,
        price: parsePositiveNumber(pass?.price, 0),
        features: normalizeStringArray(pass?.features),
        highlighted: Boolean(pass?.highlighted),
        total,
        remainingSeats,
        appliesTo: ["Participation", "Visitor", "All"].includes(pass?.appliesTo) ? pass.appliesTo : "All",
        description: toTrimmedString(pass?.description),
      };
    })
    .filter(Boolean);

  if (normalized.length) return normalized;

  const proPrice = parsePositiveNumber(ticketInventory?.pro?.price, parsePositiveNumber(String(entryFee?.pro || "").match(/\d+/)?.[0], 150));
  const visitorPrice = parsePositiveNumber(ticketInventory?.visitor?.price, parsePositiveNumber(String(entryFee?.visitor || "").match(/\d+/)?.[0], 150));
  return [
    { key: "basic-pass", name: "Basic Pass", price: proPrice, features: [], highlighted: false, total: 0, remainingSeats: 0, appliesTo: "All", description: "" },
    { key: "smart-pass", name: "Smart Pass", price: visitorPrice, features: [], highlighted: true, total: 0, remainingSeats: 0, appliesTo: "All", description: "" },
  ];
};

const normalizeReferralCodes = (value, existingCodes = []) => {
  const source = Array.isArray(value) ? value : existingCodes;
  const seen = new Set();
  return source
    .map((item) => {
      const code = toTrimmedString(item?.code).toUpperCase();
      if (!code || seen.has(code)) return null;
      seen.add(code);
      return {
        code,
        discountType: item?.discountType === "percent" ? "percent" : "flat",
        discountValue: parsePositiveNumber(item?.discountValue, 0),
        active: item?.active !== false,
        maxUses: parsePositiveNumber(item?.maxUses, 0),
        usedCount: parsePositiveNumber(item?.usedCount, 0),
      };
    })
    .filter(Boolean);
};

const normalizeDisplayOptions = (value = {}, existingOptions = {}) => {
  const keys = [
    "mediaTile",
    "statsTile",
    "eligibilityTile",
    "highlightsTile",
    "scheduleTile",
    "passesTile",
    "rewardsTile",
    "seoTile",
    "contactTile",
    "registrationTile",
  ];

  return keys.reduce((options, key) => {
    options[key] = value[key] ?? existingOptions?.[key] ?? true;
    return options;
  }, {});
};

const normalizeEventPayload = (body, existingEvent = null, adminEmail = "") => {
  const title = toTrimmedString(body.title || body.name, existingEvent?.title || existingEvent?.name || "");
  const shortName = toTrimmedString(body.shortName || title, existingEvent?.shortName || title);
  const slug = slugify(body.slug || title || shortName, existingEvent?.slug || "event");
  const startDate = normalizeDate(body.startDate) || existingEvent?.startDate || null;
  const endDate = normalizeDate(body.endDate) || existingEvent?.endDate || startDate || null;
  const deadline = normalizeDate(body.registrationSettings?.deadline || body.registrationDeadline);
  const passes = normalizePasses(body.ticketTypes || body.passes, body.entryFee, body.ticketInventory);
  const firstPass = passes[0] || { price: 0, total: 0 };
  const secondPass = passes[1] || firstPass;
  const dateLabel = toTrimmedString(body.dateLabel || body.date || body.startDate, existingEvent?.dateLabel || existingEvent?.date || "To be announced");
  const comingSoon = Boolean(body.comingSoon) || /coming\s*soon/i.test(dateLabel);
  const registrationEnabled = comingSoon
    ? false
    : body.registrationSettings?.enabled ?? existingEvent?.registrationSettings?.enabled ?? true;

  return {
    name: title || shortName,
    title: title || shortName,
    subtitle: toTrimmedString(body.subtitle, existingEvent?.subtitle || ""),
    slug,
    shortName,
    dateLabel,
    comingSoon,
    tagline: toTrimmedString(body.tagline, existingEvent?.tagline || ""),
    shortDescription: toTrimmedString(body.shortDescription, existingEvent?.shortDescription || ""),
    fullDescription: toTrimmedString(body.fullDescription, existingEvent?.fullDescription || body.description || ""),
    description: toTrimmedString(body.description || body.fullDescription, existingEvent?.description || ""),
    bannerImage: toTrimmedString(body.bannerImage, existingEvent?.bannerImage || ""),
    thumbnailImage: toTrimmedString(body.thumbnailImage, existingEvent?.thumbnailImage || ""),
    gallery: Array.isArray(body.gallery)
      ? body.gallery.map((item) => (typeof item === "string" ? { url: item, alt: "" } : { url: toTrimmedString(item?.url), alt: toTrimmedString(item?.alt) })).filter((item) => item.url)
      : existingEvent?.gallery || [],
    promoVideoUrl: toTrimmedString(body.promoVideoUrl, existingEvent?.promoVideoUrl || ""),
    date: dateLabel,
    startDate,
    endDate,
    day: toTrimmedString(body.day, existingEvent?.day || ""),
    time: toTrimmedString(body.time || body.timings, existingEvent?.time || "To be announced"),
    timings: toTrimmedString(body.timings || body.time, existingEvent?.timings || ""),
    location: toTrimmedString(body.location || body.venue, existingEvent?.location || ""),
    venue: toTrimmedString(body.venue, existingEvent?.venue || "To be announced"),
    city: toTrimmedString(body.city, existingEvent?.city || ""),
    googleMapsLink: toTrimmedString(body.googleMapsLink, existingEvent?.googleMapsLink || ""),
    organizer: toTrimmedString(body.organizer, existingEvent?.organizer || "TechMNHub"),
    expectedParticipants: toTrimmedString(body.expectedParticipants, existingEvent?.expectedParticipants || ""),
    skillZones: toTrimmedString(body.skillZones, existingEvent?.skillZones || ""),
    prizes: toTrimmedString(body.prizes, existingEvent?.prizes || ""),
    category: EVENT_CATEGORIES.has(body.category) ? body.category : existingEvent?.category || "",
    highlights: normalizeStringArray(body.highlights ?? existingEvent?.highlights),
    categories: normalizeStringArray(body.categories ?? existingEvent?.categories),
    tags: normalizeStringArray(body.tags ?? existingEvent?.tags),
    eligibility: {
      minClass: toTrimmedString(body.eligibility?.minClass, existingEvent?.eligibility?.minClass || ""),
      maxClass: toTrimmedString(body.eligibility?.maxClass, existingEvent?.eligibility?.maxClass || ""),
      boardsAccepted: normalizeStringArray(body.eligibility?.boardsAccepted ?? existingEvent?.eligibility?.boardsAccepted),
      ageGroup: toTrimmedString(body.eligibility?.ageGroup, existingEvent?.eligibility?.ageGroup || ""),
    },
    dailySchedules: Array.isArray(body.dailySchedules)
      ? body.dailySchedules.map((item) => ({
          dayTitle: toTrimmedString(item.dayTitle),
          activities: normalizeStringArray(item.activities),
          sessionTimings: toTrimmedString(item.sessionTimings),
          speakers: normalizeStringArray(item.speakers),
        })).filter((item) => item.dayTitle || item.activities.length || item.sessionTimings || item.speakers.length)
      : existingEvent?.dailySchedules || [],
    certificates: normalizeStringArray(body.certificates ?? existingEvent?.certificates),
    awards: normalizeStringArray(body.awards ?? existingEvent?.awards),
    gifts: normalizeStringArray(body.gifts ?? existingEvent?.gifts),
    rewardPrizes: normalizeStringArray(body.rewardPrizes ?? existingEvent?.rewardPrizes),
    registrationSettings: {
      enabled: registrationEnabled,
      deadline,
      maxRegistrations: parsePositiveNumber(body.registrationSettings?.maxRegistrations, existingEvent?.registrationSettings?.maxRegistrations || 0),
      waitingList: Boolean(body.registrationSettings?.waitingList ?? existingEvent?.registrationSettings?.waitingList),
      autoConfirmation: body.registrationSettings?.autoConfirmation ?? existingEvent?.registrationSettings?.autoConfirmation ?? true,
    },
    referralCodes: normalizeReferralCodes(body.referralCodes, existingEvent?.referralCodes),
    displayOptions: normalizeDisplayOptions(body.displayOptions, existingEvent?.displayOptions),
    registrationDeadline: deadline ? deadline.toISOString().slice(0, 10) : toTrimmedString(body.registrationDeadline, existingEvent?.registrationDeadline || ""),
    registrationLink: toTrimmedString(body.registrationLink, existingEvent?.registrationLink || ""),
    refundPolicy: toTrimmedString(body.refundPolicy, existingEvent?.refundPolicy || ""),
    contact: {
      email: toTrimmedString(body.contact?.email || body.email, existingEvent?.contact?.email || ""),
      phone: toTrimmedString(body.contact?.phone || body.contactNumber, existingEvent?.contact?.phone || ""),
    },
    seo: {
      metaTitle: toTrimmedString(body.seo?.metaTitle, existingEvent?.seo?.metaTitle || title),
      metaDescription: toTrimmedString(body.seo?.metaDescription, existingEvent?.seo?.metaDescription || ""),
      keywords: normalizeStringArray(body.seo?.keywords ?? existingEvent?.seo?.keywords),
      openGraphImage: toTrimmedString(body.seo?.openGraphImage, existingEvent?.seo?.openGraphImage || body.bannerImage || ""),
    },
    entryFee: {
      pro: `Rs ${firstPass.price || 0}`,
      visitor: `Rs ${secondPass.price || firstPass.price || 0}`,
    },
    ticketInventory: {
      pro: { price: firstPass.price || 0, total: firstPass.total || 0 },
      visitor: { price: secondPass.price || firstPass.price || 0, total: secondPass.total || firstPass.total || 0 },
    },
    ticketTypes: passes,
    status: ["draft", "published", "active", "closed", "archived"].includes(body.status) ? body.status : existingEvent?.status || "draft",
    featured: Boolean(body.featured ?? existingEvent?.featured),
    updatedByAdminEmail: adminEmail,
    createdByAdminEmail: existingEvent?.createdByAdminEmail || adminEmail,
  };
};

const getEventEntriesQuery = (event) => {
  const query = { $or: [{ eventId: String(event._id) }, { eventShortName: event.shortName }] };
  if ((event?.shortName || "").toLowerCase().includes("zonex")) {
    query.$or.push({ eventId: { $exists: false } }, { eventId: null }, { eventId: "" });
  }
  return query;
};

const getRegistrationQuery = async (query) => {
  const filters = {};
  if (query.eventId) {
    const event = await Event.findById(query.eventId);
    if (event) Object.assign(filters, getEventEntriesQuery(event));
  }
  if (query.pass && query.pass !== "all") filters.passName = { $regex: new RegExp(escapeRegex(query.pass), "i") };
  if (query.paymentStatus && query.paymentStatus !== "all") filters.paymentStatus = query.paymentStatus;
  if (query.status && query.status !== "all") filters.registrationStatus = query.status;
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");
    filters.$and = filters.$and || [];
    filters.$and.push({ $or: [{ fullName: regex }, { email: regex }, { mobile: regex }, { school: regex }, { city: regex }] });
  }
  return filters;
};

const buildAnalytics = async (event = null) => {
  const scope = event ? getEventEntriesQuery(event) : {};
  const [totalRegistrations, paidRegistrations, checkedIn, revenueAgg, passAgg, daily] = await Promise.all([
    User.countDocuments(scope),
    User.countDocuments({ ...scope, paymentStatus: "paid" }),
    User.countDocuments({ ...scope, checkedIn: true }),
    User.aggregate([{ $match: { ...scope, paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$amountPaid" } } }]),
    User.aggregate([{ $match: scope }, { $group: { _id: "$passName", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
    User.aggregate([
      { $match: scope },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, registrations: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]),
  ]);
  const seatLimit = event?.registrationSettings?.maxRegistrations || event?.ticketTypes?.reduce((sum, pass) => sum + (pass.total || 0), 0) || 0;
  const revenue = revenueAgg[0]?.total || 0;
  return {
    totalRegistrations,
    revenue,
    mostPopularPass: passAgg[0]?._id || "N/A",
    seatOccupancy: seatLimit ? Math.round((totalRegistrations / seatLimit) * 100) : 0,
    attendanceRate: totalRegistrations ? Math.round((checkedIn / totalRegistrations) * 100) : 0,
    conversionRate: totalRegistrations ? Math.round((paidRegistrations / totalRegistrations) * 100) : 0,
    checkedIn,
    paidRegistrations,
    dailyRegistrations: daily.map((item) => ({ date: item._id, registrations: item.registrations })),
  };
};

const ensureLegacyEventIfEmpty = async () => {
  const legacyExists = await Event.findOne({ shortName: { $regex: /^zonex 2026$/i } });
  if (!legacyExists) await Event.create(LEGACY_EVENT_DATA);
};

exports.getActiveEvents = async (_req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const events = await Event.find({ status: { $in: ["published", "active"] } }).sort({ featured: -1, startDate: 1, createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getPublicEvents = async (_req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const events = await Event.find({ status: { $ne: "draft" } }).sort({ featured: -1, createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const filters = {};
    if (req.query.status && req.query.status !== "all") filters.status = req.query.status;
    if (req.query.category && req.query.category !== "all") filters.category = req.query.category;
    if (req.query.featured === "true") filters.featured = true;
    if (req.query.q) {
      const regex = new RegExp(escapeRegex(req.query.q), "i");
      filters.$or = [{ name: regex }, { title: regex }, { shortName: regex }, { slug: regex }, { category: regex }];
    }
    const [items, total] = await Promise.all([
      Event.find(filters).sort({ featured: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Event.countDocuments(filters),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getEventById = async (req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    const analytics = await buildAnalytics(event);
    res.json({ ...event.toObject(), analytics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const payload = normalizeEventPayload(req.body, null, req.admin?.email || "");
    if (!payload.title || !payload.shortName) return res.status(400).json({ msg: "Event title is required" });
    const duplicateSlug = await Event.findOne({ slug: payload.slug });
    if (duplicateSlug) payload.slug = `${payload.slug}-${Date.now()}`;
    if (payload.status === "published" || payload.status === "active") payload.publishedAt = new Date();
    const event = await Event.create(payload);
    if (!event.registrationLink) {
      event.registrationLink = `/registration-form/${event._id}`;
      await event.save();
    }
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    const payload = normalizeEventPayload(req.body, event, req.admin?.email || "");
    if (payload.status !== "draft" && !event.publishedAt) payload.publishedAt = new Date();
    Object.assign(event, payload);
    if (!event.registrationLink) event.registrationLink = `/registration-form/${event._id}`;
    await event.save();
    res.json({ msg: "Event updated successfully", event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    await event.deleteOne();
    res.json({ msg: "Event deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.duplicateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ msg: "Event not found" });
    delete event._id;
    event.name = `${event.name} Copy`;
    event.title = `${event.title || event.name} Copy`;
    event.shortName = `${event.shortName} Copy`;
    event.slug = `${event.slug || slugify(event.shortName)}-copy-${Date.now()}`;
    event.status = "draft";
    event.featured = false;
    event.publishedAt = null;
    event.createdByAdminEmail = req.admin?.email || "";
    event.updatedByAdminEmail = req.admin?.email || "";
    const created = await Event.create(event);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.publishEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    event.status = "published";
    event.publishedAt = event.publishedAt || new Date();
    await event.save();
    res.json({ msg: "Event published", event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.unpublishEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    event.status = "draft";
    await event.save();
    res.json({ msg: "Event moved to draft", event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.closeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    event.status = "closed";
    event.closedAt = new Date();
    await event.save();
    res.json({ msg: "Event closed successfully", event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.reopenEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    event.status = "published";
    event.closedAt = null;
    event.publishedAt = event.publishedAt || new Date();
    await event.save();
    res.json({ msg: "Event reopened successfully", event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getEventEntries = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    const entries = await User.find(getEventEntriesQuery(event)).sort({ createdAt: -1 });
    res.json({ event, totalEntries: entries.length, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getRegistrations = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const filters = await getRegistrationQuery(req.query);
    const [items, total] = await Promise.all([
      User.find(filters).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filters),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.updateRegistration = async (req, res) => {
  try {
    const registration = await User.findById(req.params.id);
    if (!registration) return res.status(404).json({ msg: "Registration not found" });
    if (["pending", "approved", "rejected", "waitlisted"].includes(req.body.registrationStatus)) {
      registration.registrationStatus = req.body.registrationStatus;
      if (req.body.registrationStatus === "approved") registration.approvedAt = new Date();
      if (req.body.registrationStatus === "rejected") registration.rejectedAt = new Date();
    }
    if (typeof req.body.checkedIn === "boolean") {
      registration.checkedIn = req.body.checkedIn;
      registration.checkInTime = req.body.checkedIn ? new Date() : null;
      registration.attendanceMarkedBy = req.admin?.email || "";
    }
    if (["pending", "paid", "failed", "refunded"].includes(req.body.paymentStatus)) registration.paymentStatus = req.body.paymentStatus;
    await registration.save();
    res.json({ msg: "Registration updated", registration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const event = req.query.eventId ? await Event.findById(req.query.eventId) : null;
    res.json(await buildAnalytics(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.exportRegistrations = async (req, res) => {
  try {
    const filters = await getRegistrationQuery(req.query);
    const rows = await User.find(filters).sort({ createdAt: -1 }).lean();
    const format = req.query.format === "pdf" ? "pdf" : "csv";
    const headers = ["Student name", "Parent name", "Phone", "Email", "School", "Class", "City", "Selected pass", "Payment status", "Registration date"];
    const body = rows.map((item) => [
      item.fullName || "",
      item.parentName || "",
      item.mobile || "",
      item.email || "",
      item.school || item.college || "",
      item.className || item.courseYear || "",
      item.city || "",
      item.passName || "",
      item.paymentStatus || "",
      item.createdAt ? new Date(item.createdAt).toISOString() : "",
    ]);
    const csv = [headers, ...body].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=event-registrations.${format}`);
    res.send(format === "pdf" ? Buffer.from(csv, "utf8") : csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.uploadMedia = async (req, res) => {
  try {
    const fileName = slugify(req.body.fileName || "event-media");
    const url = toTrimmedString(req.body.url || req.body.dataUrl);
    if (!url) return res.status(400).json({ msg: "Media url or dataUrl is required" });
    res.status(201).json({ fileName, url, secure: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
