const { MongoClient } = require('mongodb');

function inferDbName(uri, fallback = '') {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname.replace(/^\//, '').trim();
    return pathname || fallback;
  } catch {
    return fallback;
  }
}

async function cloneCollection(sourceDb, destinationDb, collectionName) {
  const sourceCollection = sourceDb.collection(collectionName);
  const destinationCollection = destinationDb.collection(collectionName);

  let processed = 0;
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) {
      return;
    }

    await destinationCollection.bulkWrite(batch, { ordered: false });
    batch = [];
  };

  const cursor = sourceCollection.find({});

  for await (const doc of cursor) {
    batch.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    });

    processed += 1;

    if (batch.length >= 250) {
      await flush();
    }
  }

  await flush();

  return { documents: processed };
}

async function cloneDatabase({ sourceUri, sourceDbName, destinationDb }) {
  const resolvedSourceDbName = String(sourceDbName || inferDbName(sourceUri)).trim();

  if (!sourceUri) {
    throw new Error('Source MongoDB URI is required.');
  }

  if (!resolvedSourceDbName) {
    throw new Error('Source database name is required when the URI does not include one.');
  }

  if (!destinationDb || !destinationDb.databaseName) {
    throw new Error('Destination database is not available.');
  }

  const sourceClient = new MongoClient(sourceUri);

  try {
    await sourceClient.connect();

    const sourceDb = sourceClient.db(resolvedSourceDbName);
    const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collections
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));

    const summaries = [];

    for (const collectionName of collectionNames) {
      const summary = await cloneCollection(sourceDb, destinationDb, collectionName);
      summaries.push({ collectionName, ...summary });
    }

    return {
      sourceDbName: resolvedSourceDbName,
      destinationDbName: destinationDb.databaseName,
      collections: summaries,
    };
  } finally {
    await sourceClient.close().catch(() => {});
  }
}

async function cloneDatabaseBetweenUris({
  sourceUri,
  sourceDbName,
  destinationUri,
  destinationDbName,
  selectedCollections,
}) {
  const resolvedSourceDbName = String(sourceDbName || inferDbName(sourceUri)).trim();
  const resolvedDestinationDbName = String(destinationDbName || inferDbName(destinationUri)).trim();

  if (!sourceUri || !destinationUri) {
    throw new Error('Both source and destination MongoDB URIs are required.');
  }

  if (!resolvedSourceDbName) {
    throw new Error('Source database name is required when the source URI does not include one.');
  }

  if (!resolvedDestinationDbName) {
    throw new Error('Destination database name is required when the destination URI does not include one.');
  }

  if (sourceUri === destinationUri && resolvedSourceDbName === resolvedDestinationDbName) {
    throw new Error('Source and destination point to the same database.');
  }

  const sourceClient = new MongoClient(sourceUri);
  const destinationClient = new MongoClient(destinationUri);

  try {
    await sourceClient.connect();
    await destinationClient.connect();

    const sourceDb = sourceClient.db(resolvedSourceDbName);
    const destinationDb = destinationClient.db(resolvedDestinationDbName);

    const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
    const availableCollectionNames = collections
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));

    const requestedCollections = Array.isArray(selectedCollections)
      ? selectedCollections.map((name) => String(name || '').trim()).filter(Boolean)
      : [];

    const collectionNames = requestedCollections.length > 0
      ? requestedCollections.filter((name) => availableCollectionNames.includes(name))
      : availableCollectionNames;

    if (requestedCollections.length > 0 && collectionNames.length === 0) {
      throw new Error('None of the requested collections were found in the source database.');
    }

    const summaries = [];

    for (const collectionName of collectionNames) {
      const summary = await cloneCollection(sourceDb, destinationDb, collectionName);
      summaries.push({ collectionName, ...summary });
    }

    return {
      sourceDbName: resolvedSourceDbName,
      destinationDbName: resolvedDestinationDbName,
      collections: summaries,
    };
  } finally {
    await sourceClient.close().catch(() => {});
    await destinationClient.close().catch(() => {});
  }
}

async function exportDatabaseData({
  sourceUri,
  sourceDbName,
  selectedCollections,
}) {
  const resolvedSourceDbName = String(sourceDbName || inferDbName(sourceUri)).trim();

  if (!sourceUri) {
    throw new Error('Source MongoDB URI is required.');
  }

  if (!resolvedSourceDbName) {
    throw new Error('Source database name is required when the source URI does not include one.');
  }

  const sourceClient = new MongoClient(sourceUri);

  try {
    await sourceClient.connect();

    const sourceDb = sourceClient.db(resolvedSourceDbName);
    const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
    const availableCollectionNames = collections
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));

    const requestedCollections = Array.isArray(selectedCollections)
      ? selectedCollections.map((name) => String(name || '').trim()).filter(Boolean)
      : [];

    const collectionNames = requestedCollections.length > 0
      ? requestedCollections.filter((name) => availableCollectionNames.includes(name))
      : availableCollectionNames;

    if (requestedCollections.length > 0 && collectionNames.length === 0) {
      throw new Error('None of the requested collections were found in the source database.');
    }

    const data = {};
    const summaries = [];

    for (const collectionName of collectionNames) {
      const documents = await sourceDb.collection(collectionName).find({}).toArray();
      data[collectionName] = documents;
      summaries.push({ collectionName, documents: documents.length });
    }

    return {
      sourceDbName: resolvedSourceDbName,
      exportedAt: new Date().toISOString(),
      collections: summaries,
      data,
    };
  } finally {
    await sourceClient.close().catch(() => {});
  }
}

module.exports = {
  cloneDatabase,
  cloneDatabaseBetweenUris,
  exportDatabaseData,
  inferDbName,
};