const { MongoClient } = require('mongodb');

require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('Missing MONGO_URI in environment.');
}

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const slugify = (value = 'zonex-2026') => String(value || 'zonex-2026')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'zonex-2026';

const buildEventKey = (doc) => {
  if (doc.eventId) {
    return `event:${String(doc.eventId).trim()}`;
  }

  if (doc.eventShortName) {
    return `short:${slugify(doc.eventShortName)}`;
  }

  return 'short:zonex-2026';
};

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();

    const db = client.db();
    const users = db.collection('users');

    try {
      await users.dropIndex('email_1');
    } catch (error) {
      if (!/index not found/i.test(String(error.message || ''))) {
        throw error;
      }
    }

    const allUsers = await users.find({}).sort({ createdAt: 1, _id: 1 }).toArray();
    const seenKeys = new Map();
    let backfilled = 0;
    let removedDuplicates = 0;

    for (const doc of allUsers) {
      const email = normalizeEmail(doc.email);
      if (!email) {
        continue;
      }

      const eventKey = buildEventKey(doc);
      const dedupeKey = `${email}::${eventKey}`;

      if (seenKeys.has(dedupeKey)) {
        await users.deleteOne({ _id: doc._id });
        removedDuplicates += 1;
        continue;
      }

      seenKeys.set(dedupeKey, doc._id);

      await users.updateOne(
        { _id: doc._id },
        { $set: { email, eventKey } },
      );
      backfilled += 1;
    }

    await users.createIndex({ email: 1, eventKey: 1 }, { unique: true, sparse: true, name: 'email_1_eventKey_1' });

    console.log(JSON.stringify({ backfilled, removedDuplicates, migrated: true }, null, 2));
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});