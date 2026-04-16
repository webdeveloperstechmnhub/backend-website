const { MongoClient } = require('mongodb');

const SYSTEM_DATABASES = new Set(['admin', 'local', 'config']);

function inferDbName(uri, fallback = '') {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname.replace(/^\//, '').trim();
    return pathname || fallback;
  } catch {
    return fallback;
  }
}

async function inspectCollections(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = collections
    .map((collection) => collection.name)
    .filter((name) => !name.startsWith('system.'));

  const details = [];

  for (const collectionName of names) {
    const collection = db.collection(collectionName);
    const documentCount = await collection.estimatedDocumentCount().catch(() => 0);

    details.push({
      name: collectionName,
      documentCount,
    });
  }

  return details;
}

async function listDatabaseOverview(sourceUri) {
  if (!sourceUri) {
    throw new Error('Source MongoDB URI is required.');
  }

  const client = new MongoClient(sourceUri);

  try {
    await client.connect();

    const admin = client.db().admin();
    const databaseInfo = await admin.listDatabases();
    const databases = databaseInfo.databases || [];

    const detailedDatabases = [];

    for (const database of databases) {
      const dbName = String(database.name || '').trim();
      if (!dbName) continue;

      const db = client.db(dbName);
      const collections = await inspectCollections(db);

      detailedDatabases.push({
        name: dbName,
        sizeOnDisk: database.sizeOnDisk || 0,
        empty: Boolean(database.empty),
        isSystemDatabase: SYSTEM_DATABASES.has(dbName),
        collections,
      });
    }

    return {
      totalDatabases: detailedDatabases.length,
      systemDatabases: detailedDatabases.filter((database) => database.isSystemDatabase),
      databases: detailedDatabases.filter((database) => !database.isSystemDatabase),
      allDatabases: detailedDatabases,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function getCollectionPreview(sourceUri, dbName, collectionName, limit = 10) {
  const resolvedDbName = String(dbName || '').trim();
  const resolvedCollectionName = String(collectionName || '').trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  if (!sourceUri) {
    throw new Error('Source MongoDB URI is required.');
  }

  if (!resolvedDbName) {
    throw new Error('Database name is required.');
  }

  if (!resolvedCollectionName) {
    throw new Error('Collection name is required.');
  }

  const client = new MongoClient(sourceUri);

  try {
    await client.connect();

    const db = client.db(resolvedDbName);
    const collection = db.collection(resolvedCollectionName);
    const totalDocuments = await collection.estimatedDocumentCount().catch(() => 0);
    const documents = await collection.find({}).limit(safeLimit).toArray();

    return {
      databaseName: resolvedDbName,
      collectionName: resolvedCollectionName,
      totalDocuments,
      returnedDocuments: documents.length,
      limit: safeLimit,
      documents,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

module.exports = {
  inferDbName,
  listDatabaseOverview,
  getCollectionPreview,
};