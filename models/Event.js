const mongoose = require("mongoose");

const stringArray = {
  type: [String],
  default: [],
};

const eventPassSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0, min: 0 },
    features: stringArray,
    highlighted: { type: Boolean, default: false },
    total: { type: Number, default: 0, min: 0 },
    remainingSeats: { type: Number, default: 0, min: 0 },
    appliesTo: {
      type: String,
      enum: ["Participation", "Visitor", "All"],
      default: "All",
    },
    description: { type: String, default: "" },
  },
  { _id: false },
);

const referralCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    discountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    discountValue: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    maxUses: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const eventFormFieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    type: {
      type: String,
      enum: ["text", "email", "number", "textarea", "select", "checkbox", "radio", "date", "url", "file"],
      default: "text",
    },
    required: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    options: { type: [String], default: [] },
    defaultValue: { type: mongoose.Schema.Types.Mixed, default: "" },
  },
  { _id: false },
);

const DEFAULT_EVENT_FORM_FIELDS = [
  { id: "fullName", label: "Full Name", placeholder: "Enter your full name", type: "text", required: true, enabled: true, options: [], defaultValue: "" },
  { id: "mobile", label: "Mobile Number", placeholder: "Enter your mobile number", type: "text", required: true, enabled: true, options: [], defaultValue: "" },
  { id: "email", label: "Email Address", placeholder: "Enter your email address", type: "email", required: true, enabled: true, options: [], defaultValue: "" },
  { id: "college", label: "College/School", placeholder: "Enter your college or school", type: "text", required: true, enabled: true, options: [], defaultValue: "" },
  { id: "courseYear", label: "Course & Year", placeholder: "Enter your course and year", type: "text", required: true, enabled: true, options: [], defaultValue: "" },
  { id: "city", label: "City", placeholder: "Enter your city", type: "text", required: true, enabled: true, options: [], defaultValue: "" },
  { id: "portfolio", label: "Portfolio URL", placeholder: "Enter portfolio URL", type: "url", required: false, enabled: true, options: [], defaultValue: "" },
  { id: "github", label: "GitHub URL", placeholder: "Enter GitHub URL", type: "url", required: false, enabled: true, options: [], defaultValue: "" },
  { id: "instagram", label: "Instagram URL", placeholder: "Enter Instagram URL", type: "url", required: false, enabled: true, options: [], defaultValue: "" },
];

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    subtitle: { type: String, default: "" },
    slug: { type: String, trim: true, lowercase: true, index: true },
    shortName: { type: String, required: true, trim: true, index: true },
    dateLabel: { type: String, default: "" },
    comingSoon: { type: Boolean, default: false, index: true },
    tagline: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    fullDescription: { type: String, default: "" },
    description: { type: String, default: "" },

    bannerImage: { type: String, default: "" },
    thumbnailImage: { type: String, default: "" },
    gallery: {
      type: [
        {
          url: { type: String, default: "" },
          alt: { type: String, default: "" },
        },
      ],
      default: [],
    },
    promoVideoUrl: { type: String, default: "" },

    date: { type: String, required: true },
    startDate: { type: Date, default: null, index: true },
    endDate: { type: Date, default: null },
    day: { type: String, default: "" },
    time: { type: String, required: true },
    timings: { type: String, default: "" },
    location: { type: String, default: "" },
    venue: { type: String, required: true },
    city: { type: String, default: "" },
    googleMapsLink: { type: String, default: "" },
    organizer: { type: String, default: "TechMNHub" },
    expectedParticipants: { type: String, default: "" },
    skillZones: { type: String, default: "" },
    prizes: { type: String, default: "" },

    category: {
      type: String,
      enum: ["Summer Camp", "Workshop", "Bootcamp", "Competition", "AI Training", "Seminar", "Webinar", ""],
      default: "",
      index: true,
    },
    highlights: stringArray,
    categories: stringArray,
    tags: stringArray,
    eventType: {
      type: String,
      enum: ["competition", "workshop", "summer_camp", "webinar"],
      default: "competition",
      index: true,
    },
    summerCampConfig: {
      heroMessage: { type: String, default: "" },
      keyHighlights: stringArray,
      campDates: { type: String, default: "" },
      mentorHighlights: stringArray,
      programFocus: { type: String, default: "" },
      callToActionText: { type: String, default: "Enroll Now" },
    },

    eligibility: {
      minClass: { type: String, default: "" },
      maxClass: { type: String, default: "" },
      boardsAccepted: stringArray,
      ageGroup: { type: String, default: "" },
    },

    dailySchedules: {
      type: [
        {
          dayTitle: { type: String, default: "" },
          activities: stringArray,
          sessionTimings: { type: String, default: "" },
          speakers: stringArray,
        },
      ],
      default: [],
    },

    certificates: stringArray,
    awards: stringArray,
    gifts: stringArray,
    rewardPrizes: stringArray,

    registrationSettings: {
      enabled: { type: Boolean, default: true },
      deadline: { type: Date, default: null },
      maxRegistrations: { type: Number, default: 0, min: 0 },
      waitingList: { type: Boolean, default: false },
      autoConfirmation: { type: Boolean, default: true },
    },
    referralCodes: { type: [referralCodeSchema], default: [] },
    displayOptions: {
      mediaTile: { type: Boolean, default: true },
      statsTile: { type: Boolean, default: true },
      eligibilityTile: { type: Boolean, default: true },
      highlightsTile: { type: Boolean, default: true },
      scheduleTile: { type: Boolean, default: true },
      passesTile: { type: Boolean, default: true },
      rewardsTile: { type: Boolean, default: true },
      seoTile: { type: Boolean, default: true },
      contactTile: { type: Boolean, default: true },
      registrationTile: { type: Boolean, default: true },
    },
    themeColor: { type: String, default: "#D4AF37", match: /^#(?:[0-9a-fA-F]{3}){1,2}$/ },
    registrationDeadline: { type: String, default: "" },
    registrationLink: { type: String, default: "" },
    refundPolicy: { type: String, default: "" },
    seatsAvailable: { type: Number, default: 0, min: 0 },

    contact: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: stringArray,
      openGraphImage: { type: String, default: "" },
    },

    entryFee: {
      pro: { type: String, default: "" },
      visitor: { type: String, default: "" },
    },
    ticketInventory: {
      pro: {
        price: { type: Number, default: 150 },
        total: { type: Number, default: 0 },
      },
      visitor: {
        price: { type: Number, default: 150 },
        total: { type: Number, default: 0 },
      },
    },
    ticketTypes: { type: [eventPassSchema], default: [] },
    seatsLeft: { type: Number, default: null, min: 0 },
    formFields: { type: [eventFormFieldSchema], default: () => DEFAULT_EVENT_FORM_FIELDS.map((field) => ({ ...field })) },

    status: {
      type: String,
      enum: ["draft", "published", "active", "closed", "archived"],
      default: "draft",
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },
    closedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    createdByAdminEmail: { type: String, default: "" },
    updatedByAdminEmail: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

eventSchema.index({ name: "text", shortName: "text", title: "text", slug: "text", category: "text" });
eventSchema.index({ status: 1, featured: -1, startDate: 1 });

module.exports = mongoose.model("Event", eventSchema);
