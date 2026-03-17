const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    date: { type: String, required: true },
    day: { type: String, default: "" },
    time: { type: String, required: true },
    location: { type: String, default: "" },
    venue: { type: String, required: true },
    city: { type: String, required: true },
    organizer: { type: String, default: "TechMNHub" },
    expectedParticipants: { type: String, default: "" },
    skillZones: { type: String, default: "" },
    prizes: { type: String, default: "" },
    description: { type: String, default: "" },
    highlights: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    registrationDeadline: { type: String, default: "" },
    refundPolicy: { type: String, default: "" },
    registrationLink: { type: String, default: "" },
    contact: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
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
    ticketTypes: {
      type: [
        {
          key: { type: String, required: true },
          name: { type: String, required: true },
          price: { type: Number, default: 0 },
          total: { type: Number, default: 0 },
          appliesTo: {
            type: String,
            enum: ["Participation", "Visitor", "All"],
            default: "All",
          },
          description: { type: String, default: "" },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Event", eventSchema);
