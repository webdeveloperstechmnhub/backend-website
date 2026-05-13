const User = require('../models/User');
const Event = require('../models/Event');

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractPrice = (value, fallback = 150) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(value, 0);
  }

  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    if (match) {
      return Math.max(Number(match[0]), 0);
    }
  }

  return fallback;
};

const slugifyTicketKey = (value, fallback = 'ticket') => {
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const normalizeEventTicketTypes = (event) => {
  const ticketTypes = Array.isArray(event?.ticketTypes) ? event.ticketTypes : [];
  if (ticketTypes.length > 0) {
    return ticketTypes.map((ticketType, index) => ({
      key: slugifyTicketKey(ticketType.key || ticketType.name, `ticket-${index + 1}`),
      name: ticketType.name,
      price: extractPrice(ticketType.price, 0),
      total: Math.max(Number(ticketType.total || 0), 0),
      appliesTo: ["Participation", "Visitor", "All"].includes(ticketType.appliesTo)
        ? ticketType.appliesTo
        : 'All',
    }));
  }

  return [
    {
      key: 'pro-participation',
      name: 'Pro Participation',
      price: extractPrice(event?.ticketInventory?.pro?.price, extractPrice(event?.entryFee?.pro, 150)),
      total: Math.max(Number(event?.ticketInventory?.pro?.total || 0), 0),
      appliesTo: 'Participation',
    },
    {
      key: 'visitor-pass',
      name: 'Visitor Pass',
      price: extractPrice(event?.ticketInventory?.visitor?.price, extractPrice(event?.entryFee?.visitor, 150)),
      total: Math.max(Number(event?.ticketInventory?.visitor?.total || 0), 0),
      appliesTo: 'Visitor',
    },
  ];
};

const isLegacyZonexEvent = (event) => (event?.shortName || '').toLowerCase().includes('zonex');

const getEventScopeQuery = (event) => {
  const scope = {
    $or: [
      { eventId: String(event._id) },
      { eventShortName: event.shortName },
    ],
  };

  if (isLegacyZonexEvent(event)) {
    scope.$or.push(
      { eventId: { $exists: false } },
      { eventId: null },
      { eventId: '' },
      { eventShortName: { $exists: false } },
      { eventShortName: null },
      { eventShortName: '' },
    );
  }

  return scope;
};

const getPassScopeQuery = (ticketType) => {
  if (ticketType.key === 'visitor' || ticketType.key === 'visitor-pass') {
    return {
      $or: [
        { passType: ticketType.key },
        { passType: 'visitor' },
        { passName: { $regex: /visitor/i } },
        { category: { $regex: /visitor/i } },
      ],
    };
  }

  if (ticketType.key === 'pro' || ticketType.key === 'pro-participation') {
    return {
      $or: [
        { passType: ticketType.key },
        { passType: 'pro' },
        { passName: { $regex: /pro|participation/i } },
        { category: { $regex: /participation|individual|team/i } },
      ],
    };
  }

  return {
    $or: [
      { passType: ticketType.key },
      { passName: { $regex: new RegExp(`^${escapeRegex(ticketType.name)}$`, 'i') } },
    ],
  };
};

const getTicketQuantity = (ticketType, category, selectedSubCategories = [], selectedTeamMembers = []) => {
  const hasHackathon = Array.isArray(selectedSubCategories)
    && selectedSubCategories.some((item) => String(item).toLowerCase() === 'hackathon');

  if (category !== 'Visitor' && ticketType?.appliesTo !== 'Visitor' && hasHackathon) {
    const teamSize = Array.isArray(selectedTeamMembers)
      ? selectedTeamMembers.filter((name) => String(name || '').trim().length > 0).length
      : 0;
    return Math.max(teamSize, 1);
  }

  return 1;
};

const getSoldTicketCount = async (eventScope, passScope, excludeUserId = null) => {
  const match = {
    $and: [
      eventScope,
      { paymentStatus: { $in: ['pending', 'paid'] } },
      passScope,
      ...(excludeUserId ? [{ _id: { $ne: excludeUserId } }] : []),
    ],
  };

  const result = await User.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $gt: ['$ticketQuantity', 0] },
              '$ticketQuantity',
              1,
            ],
          },
        },
      },
    },
  ]);

  return result[0]?.total || 0;
};

const calculateReferralDiscount = async ({ targetEvent, email, referralCode, baseAmount }) => {
  const code = String(referralCode || '').trim().toUpperCase();
  if (!targetEvent || !code) {
    return { code: '', discountAmount: 0, finalAmount: baseAmount, referral: null };
  }

  const referral = (targetEvent.referralCodes || []).find(
    (item) => item.active !== false && String(item.code || '').toUpperCase() === code,
  );

  if (!referral) {
    throw new Error('Invalid referral code.');
  }

  if (referral.maxUses > 0 && referral.usedCount >= referral.maxUses) {
    throw new Error('Referral code usage limit reached.');
  }

  const alreadyUsed = await User.findOne({
    email,
    eventId: String(targetEvent._id),
    referralCode: code,
    referralCodeApplied: true,
  });

  if (alreadyUsed) {
    throw new Error('This referral code has already been used by this user.');
  }

  const rawDiscount = referral.discountType === 'percent'
    ? Math.round((baseAmount * referral.discountValue) / 100)
    : referral.discountValue;
  const discountAmount = Math.min(Math.max(Number(rawDiscount) || 0, 0), baseAmount);

  return {
    code,
    discountAmount,
    finalAmount: Math.max(baseAmount - discountAmount, 0),
    referral,
  };
};

exports.registerUser = async (req, res) => {
  try {
    const { 
      email, 
      passType: incomingPassType,
      amountPaid, 
      subCategory,
      teamMembers,
      passName,
      eventId,
      eventShortName,
      referralCode, 
      ...rest 
    } = req.body;

    // Stop new registrations if the target event is closed.
    let targetEvent = null;
    if (eventId) {
      targetEvent = await Event.findById(eventId);
      if (!targetEvent) {
        return res.status(404).json({ msg: 'Event not found' });
      }
    } else if (eventShortName) {
      targetEvent = await Event.findOne({
        shortName: { $regex: new RegExp(`^${escapeRegex(eventShortName.trim())}$`, 'i') },
      });
    }

    if ((eventId || eventShortName) && !targetEvent) {
      return res.status(404).json({ msg: 'Event not found' });
    }

    if (
      targetEvent?.comingSoon
      || targetEvent?.registrationSettings?.enabled === false
      || ['draft', 'closed', 'archived'].includes(targetEvent?.status)
    ) {
      return res.status(403).json({
        msg: targetEvent?.comingSoon
          ? 'Registration for this event is coming soon.'
          : 'Registration for this event is closed',
      });
    }

    const incomingAmountPaid = Number(amountPaid);

    // 👇 Validate amountPaid
    if (!Number.isFinite(incomingAmountPaid) || incomingAmountPaid < 0) {
      return res.status(400).json({ msg: 'Valid amountPaid is required' });
    }

    let user = await User.findOne({ email });
    const normalizedTicketTypes = targetEvent ? normalizeEventTicketTypes(targetEvent) : [];
    const selectedTicketType = normalizedTicketTypes.find((ticketType) => {
      return ticketType.key === incomingPassType
        || ticketType.name.toLowerCase() === String(passName || '').toLowerCase();
    });

    const fallbackTicketType = normalizedTicketTypes[0] || {
      key: slugifyTicketKey(incomingPassType || passName || 'pro-participation'),
      name: passName || 'Pro Participation',
      price: incomingAmountPaid,
      total: 0,
      appliesTo: rest.category === 'Visitor' ? 'Visitor' : 'Participation',
    };

    const resolvedTicketType = selectedTicketType || fallbackTicketType;
    const ticketQuantity = getTicketQuantity(resolvedTicketType, rest.category, subCategory, teamMembers);
    const originalAmountPaid = resolvedTicketType.price * ticketQuantity;
    let payableAmount = originalAmountPaid;
    let referralDiscountAmount = 0;
    let normalizedReferralCode = '';
    let matchedReferral = null;

    if (targetEvent) {
      let referralResult;
      try {
        referralResult = await calculateReferralDiscount({
          targetEvent,
          email,
          referralCode,
          baseAmount: originalAmountPaid,
        });
      } catch (referralError) {
        return res.status(400).json({ msg: referralError.message });
      }

      payableAmount = referralResult.finalAmount;
      referralDiscountAmount = referralResult.discountAmount;
      normalizedReferralCode = referralResult.code;
      matchedReferral = referralResult.referral;

      if (resolvedTicketType.price > 0 && incomingAmountPaid !== payableAmount) {
        return res.status(400).json({
          msg: `Invalid ticket price. Expected Rs ${payableAmount} after referral discount.`,
          expectedAmount: payableAmount,
          originalAmount: originalAmountPaid,
          referralDiscountAmount,
        });
      }

      if (resolvedTicketType.total > 0) {
        const soldCount = await getSoldTicketCount(
          getEventScopeQuery(targetEvent),
          getPassScopeQuery(resolvedTicketType),
          user?._id,
        );

        if (soldCount + ticketQuantity > resolvedTicketType.total) {
          return res.status(403).json({ msg: `${resolvedTicketType.name} tickets are sold out for this event` });
        }
      }
    }

    if (user) {
      if (user.paymentStatus === 'paid') {
        return res.status(400).json({ msg: 'You have already registered and paid.' });
      }
      
      // Update existing user
      Object.assign(user, rest, { 
        amountPaid: payableAmount,
        originalAmountPaid,
        referralDiscountAmount,
        subCategory: subCategory || [],
        teamMembers: teamMembers || [],
        passName: resolvedTicketType.name,
        passType: resolvedTicketType.key,
        ticketQuantity,
        eventId: eventId || user.eventId || null,
        eventShortName: eventShortName || user.eventShortName || 'Zonex 2026',
        referralCode: normalizedReferralCode,
        referralCodeApplied: Boolean(normalizedReferralCode),
      });
      
      await user.save();
      if (matchedReferral && normalizedReferralCode) {
        await Event.updateOne(
          { _id: targetEvent._id, 'referralCodes.code': normalizedReferralCode },
          { $inc: { 'referralCodes.$.usedCount': 1 } },
        );
      }
      return res.status(200).json(user);
    }

    // Generate registration ID
    const registrationId = `ZNX-${Date.now()}`;
    
    // Team leader set karo (first team member)
    const teamLeader = teamMembers && teamMembers.length > 0 ? teamMembers[0] : rest.fullName;

    user = new User({
      ...rest,
      email,
      amountPaid: payableAmount,
      originalAmountPaid,
      referralDiscountAmount,
      subCategory: subCategory || [],
      teamMembers: teamMembers || [],
      teamLeader,
      passName: resolvedTicketType.name,
      passType: resolvedTicketType.key,
      ticketQuantity,
      eventId: eventId || null,
      eventShortName: eventShortName || 'Zonex 2026',
      registrationId,
      paymentStatus: payableAmount === 0 ? 'paid' : 'pending',
      referralCode: normalizedReferralCode,
      referralCodeApplied: Boolean(normalizedReferralCode),
    });

    await user.save();
    if (matchedReferral && normalizedReferralCode) {
      await Event.updateOne(
        { _id: targetEvent._id, 'referralCodes.code': normalizedReferralCode },
        { $inc: { 'referralCodes.$.usedCount': 1 } },
      );
    }
    res.status(201).json(user);

  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ msg: err.message });
  }
};
