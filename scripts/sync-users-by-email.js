const { MongoClient } = require('mongodb');

const OLD_URI = 'mongodb+srv://techmnhub1team_db_user:M4Zbc8lrsyTdOzh5@cluster0.cpqnhqd.mongodb.net/?appName=Cluster0';
const NEW_URI = 'mongodb+srv://webdevs:WTTS%402026@cluster0.woktzgp.mongodb.net/?appName=Cluster0';
const DB_NAME = 'test';

async function main() {
  const oldClient = new MongoClient(OLD_URI);
  const newClient = new MongoClient(NEW_URI);

  try {
    await oldClient.connect();
    await newClient.connect();

    const oldUsers = oldClient.db(DB_NAME).collection('users');
    const newUsers = newClient.db(DB_NAME).collection('users');

    const sourceDocs = await oldUsers.find({}).toArray();
    const destinationBefore = await newUsers.countDocuments();

    let upserted = 0;
    let modified = 0;
    let matched = 0;

    if (sourceDocs.length > 0) {
      const operations = sourceDocs.map((doc) => {
        const { _id, ...rest } = doc;
        return {
          updateOne: {
            filter: { email: doc.email },
            update: {
              $set: rest,
              $setOnInsert: { _id },
            },
            upsert: true,
          },
        };
      });

      const result = await newUsers.bulkWrite(operations, { ordered: false });
      upserted = result.upsertedCount || 0;
      modified = result.modifiedCount || 0;
      matched = result.matchedCount || 0;
    }

    const destinationAfter = await newUsers.countDocuments();

    console.log(
      JSON.stringify(
        {
          database: DB_NAME,
          collection: 'users',
          sourceCount: sourceDocs.length,
          destinationBefore,
          destinationAfter,
          upserted,
          modified,
          matched,
        },
        null,
        2,
      ),
    );
  } finally {
    await oldClient.close().catch(() => {});
    await newClient.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
