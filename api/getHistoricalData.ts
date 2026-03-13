import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../src/lib/mongodb';
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;
if (process.env.VITE_POSTHOG_KEY && process.env.NODE_ENV !== 'development') {
  posthogClient = new PostHog(process.env.VITE_POSTHOG_KEY, {
    host: process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { db } = await connectToDatabase();
    
    const collectionName = req.query.collection as string;
    const year = req.query.year as string;
    
    if (!collectionName) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const collection = db.collection(collectionName);
    const query: any = {};
    
    if (year) {
      query.year = year;
    }

    console.time(`[MongoDB Query] ${collectionName} ${year || 'all'}`);
    const data = await collection.find(query).limit(10000).toArray();
    console.timeEnd(`[MongoDB Query] ${collectionName} ${year || 'all'}`);
    
    if (posthogClient) {
      posthogClient.capture({
        distinctId: 'server-backend',
        event: 'api_request_success',
        properties: {
          endpoint: 'getHistoricalData',
          cache_hit: false,
          requested_month: year || 'all', // using year as requested_month for historical data
          record_count: data.length
        }
      });
      await posthogClient.flush();
    }

    // Cache for 1 week on Vercel Edge Network
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    console.error('Error in getHistoricalData:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
