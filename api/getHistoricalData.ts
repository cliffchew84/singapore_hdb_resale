import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../src/lib/mongodb';
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;
if (process.env.VITE_POSTHOG_KEY && process.env.NODE_ENV !== 'development') {
  posthogClient = new PostHog(process.env.VITE_POSTHOG_KEY, {
    host: process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  });
}

const VALID_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const yearParam = req.query.year as string;

    if (!yearParam) {
      return res.status(400).json({ error: 'year parameter is required' });
    }

    const yearInt = parseInt(yearParam, 10);

    if (isNaN(yearInt) || !VALID_YEARS.includes(yearInt)) {
      return res.status(400).json({ error: `year must be one of: ${VALID_YEARS.join(', ')}` });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('hdb_hist_v3');

    console.time(`[MongoDB Query] hdb_hist_v3 ${yearInt}`);
    const data = await collection.find({ year: yearInt }).toArray();
    console.timeEnd(`[MongoDB Query] hdb_hist_v3 ${yearInt}`);

    // Normalize float fields to strings to match HdbResaleRecord type
    const normalized = data.map(doc => ({
      ...doc,
      resale_price: String(doc.resale_price),
      floor_area_sqm: String(doc.floor_area_sqm),
    }));

    if (posthogClient) {
      posthogClient.capture({
        distinctId: 'server-backend',
        event: 'api_request_success',
        properties: {
          endpoint: 'getHistoricalData',
          cache_hit: false,
          requested_year: yearInt,
          record_count: data.length,
        }
      });
      await posthogClient.flush();
    }

    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    res.status(200).json(normalized);
  } catch (err) {
    console.error('Error in getHistoricalData:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
