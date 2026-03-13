import { MongoClient } from 'mongodb';

async function testConnection() {
  const password = process.env.MONGO_PASSWORD;
  if (!password) {
    console.error('MONGO_PASSWORD environment variable is not set.');
    process.exit(1);
  }

  const base_url = "mongodb+srv://cliffchew84:";
  const end_url = "cliff-nlb.t0whddv.mongodb.net/?retryWrites=true&w=majority";
  const mongo_url = `${base_url}${password}@${end_url}`;

  const client = new MongoClient(mongo_url);

  try {
    await client.connect();
    console.log('Connected successfully to MongoDB');
    
    const db = client.db('nlb');
    const collections = await db.listCollections().toArray();
    console.log('Collections in "nlb" database:', collections.map(c => c.name));
    
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  } finally {
    await client.close();
  }
}

testConnection();
