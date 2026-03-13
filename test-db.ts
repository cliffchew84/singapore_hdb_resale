import { connectToDatabase } from './src/lib/mongodb';

async function test() {
  const { db } = await connectToDatabase();
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));
  
  if (collections.length > 0) {
    const colName = collections[0].name;
    const doc = await db.collection(colName).findOne({});
    console.log(`First doc in ${colName}:`, doc);
  }
  process.exit(0);
}
test();
