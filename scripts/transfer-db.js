const readline = require('readline');
const { MongoClient } = require('mongodb');

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

function inferDbName(uri, fallback) {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname.replace(/^\//, '').trim();
    return pathname || fallback;
  } catch {
    return fallback;
  }
}

async function copyCollection(sourceDb, destinationDb, collectionName) {
  const sourceCollection = sourceDb.collection(collectionName);
  const destinationCollection = destinationDb.collection(collectionName);

  const indexes = await sourceCollection.listIndexes().toArray();
  const documents = await sourceCollection.find({}).toArray();

  if (await destinationCollection.estimatedDocumentCount().catch(() => 0)) {
    await destinationCollection.deleteMany({});
  }

  if (documents.length > 0) {
    await destinationCollection.insertMany(documents, { ordered: false });
  }

  const extraIndexes = indexes
    .filter((index) => index.name !== '_id_')
    .map((index) => {
      const { v, key, name, ns, ...rest } = index;
      return { key, name, ...rest };
    });

  if (extraIndexes.length > 0) {
    await destinationCollection.createIndexes(extraIndexes);
  }

  return {
    documents: documents.length,
    indexes: extraIndexes.length,
  };
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const sourceUri = await ask(rl, 'Source MongoDB URI: ');
    const destinationUri = await ask(rl, 'Destination MongoDB URI: ');
    const sourceDbNameInput = await ask(rl, 'Source database name (press Enter to infer from URI): ');
    const destinationDbNameInput = await ask(rl, 'Destination database name (press Enter to infer from URI): ');

    if (!sourceUri || !destinationUri) {
      throw new Error('Both source and destination URIs are required.');
    }

    const sourceDbName = sourceDbNameInput || inferDbName(sourceUri, 'source_db');
    const destinationDbName = destinationDbNameInput || inferDbName(destinationUri, sourceDbName);

    const sourceClient = new MongoClient(sourceUri);
    const destinationClient = new MongoClient(destinationUri);

    await sourceClient.connect();
    await destinationClient.connect();

    const sourceDb = sourceClient.db(sourceDbName);
    const destinationDb = destinationClient.db(destinationDbName);

    const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
    const names = collections
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));

    console.log(`Copying ${names.length} collection(s) from ${sourceDbName} to ${destinationDbName}...`);

    for (const name of names) {
      const result = await copyCollection(sourceDb, destinationDb, name);
      console.log(`- ${name}: ${result.documents} document(s), ${result.indexes} extra index(es)`);
    }

    console.log('Transfer complete.');

    await sourceClient.close();
    await destinationClient.close();
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Transfer failed:', error.message);
  process.exit(1);
});
