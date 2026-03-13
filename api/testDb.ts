import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../src/lib/mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { db } = await connectToDatabase();
    const collections = await db.listCollections().toArray();
    const colName = collections[0]?.name || 'hdb_resale_records';
    const doc = await db.collection(colName).findOne({});
    res.status(200).json({ collections: collections.map(c => c.name), firstDoc: doc });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
