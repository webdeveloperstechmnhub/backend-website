const Event = require("../models/Event");
const User = require("../models/User");

const LEGACY_EVENT_DATA = {
  name: "ZONEX 2026 - Where Talent Takes Shape",
  shortName: "Zonex 2026",
  date: "7 March, 2026",
  day: "Saturday",
  time: "9:00 AM - 5:00 PM",
  location: "S.D. College of Engineering and Technology, Jansath Road, Muzaffarnagar",
  venue: "S.D. College of Engineering and Technology, Jansath Road",
  city: "Muzaffarnagar",
  organizer: "TechMNHub",
  expectedParticipants: "800+",
  skillZones: "10+",
  prizes: "Cash Rewards",
  description:
    "ZONEX is a one-day skill discovery and opportunity festival bringing together students from multiple colleges and schools to showcase talent in technology, creativity, leadership, performance, and innovation.",
  highlights: [
    "800+ Expected Participants",
    "10+ Skill Zones",
    "Hackathon with Cash Prizes",
    "Influencer Meetup",
    "Food Carnival",
    "Live Performances",
    "Networking Sessions",
  ],
  categories: [
    "Performance",
    "Hackathon",
    "Startup Pitch",
    "Creative Arts",
    "Communication",
    "Visitor",
  ],
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
      appliesTo: "Participation",
      description: "Entry to 2-3 skill zones with event access.",
    },
    {
      key: "visitor-pass",
      name: "Visitor Pass",
      price: 150,
      total: 0,
      appliesTo: "Visitor",
      description: "Venue access for visitors.",
    },
  ],
  status: "active",
};

const normalizeStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeString = (value, fallback = "") => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const parsePositiveNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
};

const slugifyTicketKey = (value, fallback = "ticket") => {
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
};

const extractPriceFromString = (value, fallback = 150) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(value, 0);
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) {
      return Math.max(Number(match[0]), 0);
    }
  }

  return fallback;
};

const normalizeTicketInventory = (ticketInventory, entryFee, existingTicketInventory) => {
  const currentProPrice =
    existingTicketInventory?.pro?.price ?? extractPriceFromString(entryFee?.pro, 150);
  const currentVisitorPrice =
    existingTicketInventory?.visitor?.price ?? extractPriceFromString(entryFee?.visitor, 150);

  const proPrice = parsePositiveNumber(
    ticketInventory?.pro?.price,
    extractPriceFromString(entryFee?.pro, currentProPrice),
  );
  const visitorPrice = parsePositiveNumber(
    ticketInventory?.visitor?.price,
    extractPriceFromString(entryFee?.visitor, currentVisitorPrice),
  );

  const proTotal = parsePositiveNumber(
    ticketInventory?.pro?.total,
    parsePositiveNumber(existingTicketInventory?.pro?.total, 0),
  );
  const visitorTotal = parsePositiveNumber(
    ticketInventory?.visitor?.total,
    parsePositiveNumber(existingTicketInventory?.visitor?.total, 0),
  );

  return {
    pro: { price: proPrice || 0, total: proTotal },
    visitor: { price: visitorPrice || 0, total: visitorTotal },
  };
};

const deriveLegacyTicketTypes = (entryFee, ticketInventory) => {
  const inventory = normalizeTicketInventory(ticketInventory, entryFee, ticketInventory);

  return [
    {
      key: "pro-participation",
      name: "Pro Participation",
      price: inventory.pro.price,
      total: inventory.pro.total,
      appliesTo: "Participation",
      description: "Entry to 2-3 skill zones with event access.",
    },
    {
      key: "visitor-pass",
      name: "Visitor Pass",
      price: inventory.visitor.price,
      total: inventory.visitor.total,
      appliesTo: "Visitor",
      description: "Venue access for visitors.",
    },
  ];
};

const normalizeTicketTypes = (ticketTypes, entryFee, ticketInventory) => {
  const source = Array.isArray(ticketTypes) ? ticketTypes : [];
  const normalized = [];
  const seen = new Set();

  source.forEach((type, index) => {
    const name = normalizeString(type?.name);
    if (!name) return;

    let key = slugifyTicketKey(type?.key || name, `ticket-${index + 1}`);
    while (seen.has(key)) {
      key = `${key}-${index + 1}`;
    }
    seen.add(key);

    normalized.push({
      key,
      name,
      price: parsePositiveNumber(type?.price, 0),
      total: parsePositiveNumber(type?.total, 0),
      appliesTo: ["Participation", "Visitor", "All"].includes(type?.appliesTo)
        ? type.appliesTo
        : "All",
      description: normalizeString(type?.description),
    });
  });

  return normalized.length > 0
    ? normalized
    : deriveLegacyTicketTypes(entryFee, ticketInventory);
};

const deriveLegacyPricingFromTicketTypes = (ticketTypes, currentEntryFee, currentTicketInventory) => {
  const normalized = normalizeTicketTypes(ticketTypes, currentEntryFee, currentTicketInventory);
  const participationTicket =
    normalized.find((type) => type.appliesTo === "Participation" || type.appliesTo === "All")
    || normalized[0];
  const visitorTicket =
    normalized.find((type) => type.appliesTo === "Visitor")
    || normalized.find((type) => type.appliesTo === "All")
    || normalized[0];

  return {
    entryFee: {
      pro: `Rs ${participationTicket?.price || 0}`,
      visitor: `Rs ${visitorTicket?.price || participationTicket?.price || 0}`,
    },
    ticketInventory: {
      pro: {
        price: participationTicket?.price || 0,
        total: participationTicket?.total || 0,
      },
      visitor: {
        price: visitorTicket?.price || participationTicket?.price || 0,
        total: visitorTicket?.total || participationTicket?.total || 0,
      },
    },
  };
};

const getPassCountQuery = (ticketType) => {
  const escapedName = ticketType?.name
    ? ticketType.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : "";

  if (ticketType?.key === "visitor" || ticketType?.key === "visitor-pass") {
    return {
      $or: [
        { passType: ticketType.key },
        { passType: "visitor" },
        { passName: { $regex: /visitor/i } },
        { category: { $regex: /visitor/i } },
      ],
    };
  }

  if (ticketType?.key === "pro" || ticketType?.key === "pro-participation") {
    return {
      $or: [
        { passType: ticketType.key },
        { passType: "pro" },
        { passName: { $regex: /pro|participation/i } },
        { category: { $regex: /participation|individual|team/i } },
      ],
    };
  }

  return escapedName
    ? {
        $or: [
          { passType: ticketType.key },
          { passName: { $regex: new RegExp(`^${escapedName}$`, "i") } },
        ],
      }
    : { passType: ticketType?.key };
};

const getSoldTicketCount = async (eventScope, passScope) => {
  const result = await User.aggregate([
    {
      $match: {
        $and: [
          eventScope,
          { paymentStatus: { $in: ["pending", "paid"] } },
          passScope,
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $gt: ["$ticketQuantity", 0] },
              "$ticketQuantity",
              1,
            ],
          },
        },
      },
    },
  ]);

  return result[0]?.total || 0;
};

const getTicketAvailability = async (event) => {
  const ticketTypes = normalizeTicketTypes(event.ticketTypes, event.entryFee, event.ticketInventory);
  const eventScope = getEventEntriesQuery(event);

  const availability = await Promise.all(
    ticketTypes.map(async (ticketType) => {
      const sold = await getSoldTicketCount(eventScope, getPassCountQuery(ticketType));
      const total = parsePositiveNumber(ticketType.total, 0);
      const remaining = total > 0 ? Math.max(total - sold, 0) : null;

      return {
        ...ticketType,
        sold,
        remaining,
        soldOut: total > 0 ? sold >= total : false,
      };
    }),
  );

  return availability;
};

const isLegacyZonexEvent = (event) => {
  return (event?.shortName || "").toLowerCase().includes("zonex");
};

const getEventEntriesQuery = (event) => {
  const baseQuery = {
    $or: [
      { eventId: String(event._id) },
      { eventShortName: event.shortName },
    ],
  };

  // Old Zonex registrations may not have event fields.
  if (isLegacyZonexEvent(event)) {
    baseQuery.$or.push(
      { eventId: { $exists: false } },
      { eventId: null },
      { eventId: "" },
      { eventShortName: { $exists: false } },
      { eventShortName: null },
      { eventShortName: "" },
    );
  }

  return baseQuery;
};

const ensureLegacyEventIfEmpty = async () => {
  const legacyExists = await Event.findOne({ shortName: { $regex: /^zonex 2026$/i } });
  if (!legacyExists) {
    await Event.create(LEGACY_EVENT_DATA);
  }
};

exports.getActiveEvents = async (req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const events = await Event.find({ status: "active" }).sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getPublicEvents = async (req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const events = await Event.find().sort({ status: 1, createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getEventById = async (req, res) => {
  try {
    await ensureLegacyEventIfEmpty();
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const ticketAvailability = await getTicketAvailability(event);

    res.json({
      ...event.toObject(),
      ticketTypes: ticketAvailability,
      ticketAvailability,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const {
      name,
      shortName,
      date,
      day,
      time,
      location,
      venue,
      city,
      organizer,
      expectedParticipants,
      skillZones,
      prizes,
      description,
      highlights,
      categories,
      tags,
      registrationDeadline,
      refundPolicy,
      registrationLink,
      contact,
      entryFee,
      ticketInventory,
      ticketTypes,
    } = req.body;

    if (!shortName || !date) {
      return res.status(400).json({
        msg: "shortName and date are required",
      });
    }

    const normalizedTypes = normalizeTicketTypes(ticketTypes, entryFee, ticketInventory);
    const legacyPricing = deriveLegacyPricingFromTicketTypes(normalizedTypes, entryFee, ticketInventory);

    const event = await Event.create({
      name: name?.trim() || shortName.trim(),
      shortName: shortName.trim(),
      date: date.trim(),
      day: day?.trim() || "",
      time: time?.trim() || "To be announced",
      location: location?.trim() || "",
      venue: venue?.trim() || "To be announced",
      city: city?.trim() || "TBA",
      organizer: organizer?.trim() || "TechMNHub",
      expectedParticipants: expectedParticipants?.trim() || "",
      skillZones: skillZones?.trim() || "",
      prizes: prizes?.trim() || "",
      description: description?.trim() || "",
      highlights: normalizeStringArray(highlights),
      categories: normalizeStringArray(categories),
      tags: normalizeStringArray(tags),
      registrationDeadline: registrationDeadline?.trim() || "",
      refundPolicy: refundPolicy?.trim() || "",
      registrationLink: registrationLink?.trim() || "",
      contact: {
        email: contact?.email?.trim() || "",
        phone: contact?.phone?.trim() || "",
      },
      entryFee: legacyPricing.entryFee,
      ticketInventory: legacyPricing.ticketInventory,
      ticketTypes: normalizedTypes,
      status: "active",
      closedAt: null,
    });

    if (!event.registrationLink) {
      event.registrationLink = isLegacyZonexEvent(event)
        ? "/registration-form"
        : `/registration-form/${event._id}`;
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
    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const {
      name,
      shortName,
      date,
      day,
      time,
      location,
      venue,
      city,
      organizer,
      expectedParticipants,
      skillZones,
      prizes,
      description,
      highlights,
      categories,
      tags,
      registrationDeadline,
      refundPolicy,
      registrationLink,
      contact,
      entryFee,
      ticketInventory,
      ticketTypes,
      status,
    } = req.body;

    event.name = normalizeString(name, event.name) || event.name;
    event.shortName = normalizeString(shortName, event.shortName) || event.shortName;
    event.date = normalizeString(date, event.date) || event.date;
    event.day = normalizeString(day, event.day);
    event.time = normalizeString(time, event.time) || event.time;
    event.location = normalizeString(location, event.location);
    event.venue = normalizeString(venue, event.venue) || event.venue;
    event.city = normalizeString(city, event.city) || event.city;
    event.organizer = normalizeString(organizer, event.organizer) || event.organizer;
    event.expectedParticipants = normalizeString(expectedParticipants, event.expectedParticipants);
    event.skillZones = normalizeString(skillZones, event.skillZones);
    event.prizes = normalizeString(prizes, event.prizes);
    event.description = normalizeString(description, event.description);

    if (highlights !== undefined) {
      event.highlights = normalizeStringArray(highlights);
    }
    if (categories !== undefined) {
      event.categories = normalizeStringArray(categories);
    }
    if (tags !== undefined) {
      event.tags = normalizeStringArray(tags);
    }

    event.registrationDeadline = normalizeString(
      registrationDeadline,
      event.registrationDeadline,
    );
    event.refundPolicy = normalizeString(refundPolicy, event.refundPolicy);

    if (registrationLink !== undefined) {
      event.registrationLink = normalizeString(registrationLink);
    }

    if (!event.registrationLink) {
      event.registrationLink = isLegacyZonexEvent(event)
        ? "/registration-form"
        : `/registration-form/${event._id}`;
    }

    event.contact = {
      email: normalizeString(contact?.email, event.contact?.email),
      phone: normalizeString(contact?.phone, event.contact?.phone),
    };

    const normalizedTypes = normalizeTicketTypes(
      ticketTypes,
      {
        pro: normalizeString(entryFee?.pro, event.entryFee?.pro),
        visitor: normalizeString(entryFee?.visitor, event.entryFee?.visitor),
      },
      ticketInventory || event.ticketInventory,
    );
    const legacyPricing = deriveLegacyPricingFromTicketTypes(
      normalizedTypes,
      event.entryFee,
      event.ticketInventory,
    );

    event.entryFee = legacyPricing.entryFee;
    event.ticketInventory = legacyPricing.ticketInventory;
    event.ticketTypes = normalizedTypes;

    if (status && ["active", "closed"].includes(status)) {
      event.status = status;
      event.closedAt = status === "closed" ? event.closedAt || new Date() : null;
    }

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

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    if (isLegacyZonexEvent(event)) {
      return res.status(400).json({ msg: "Legacy Zonex event cannot be deleted" });
    }

    await event.deleteOne();
    res.json({ msg: "Event deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getEventEntries = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const entries = await User.find(getEventEntriesQuery(event)).sort({ createdAt: -1 });

    res.json({
      event: {
        _id: event._id,
        shortName: event.shortName,
        date: event.date,
        description: event.description,
      },
      totalEntries: entries.length,
      entries,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.closeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    if (event.status === "closed") {
      return res.status(400).json({ msg: "Event is already closed" });
    }

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

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    if (event.status === "active") {
      return res.status(400).json({ msg: "Event is already active" });
    }

    event.status = "active";
    event.closedAt = null;
    await event.save();

    res.json({ msg: "Event reopened successfully", event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
