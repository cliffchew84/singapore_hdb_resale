import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient, db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const password = process.env.MONGO_PASSWORD;
  if (!password) {
    throw new Error('MONGO_PASSWORD environment variable is missing');
  }

  const base_url = "mongodb+srv://cliffchew84:";
  const end_url = "cliff-nlb.t0whddv.mongodb.net/?retryWrites=true&w=majority";
  const uri = `${base_url}${password}@${end_url}`;

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('nlb');

  cachedClient = client;
  cachedDb = db;

  console.log('Connected successfully to MongoDB (Serverless Cache)');
  return { client, db };
}
