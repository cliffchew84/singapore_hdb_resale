import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;
if (process.env.VITE_POSTHOG_KEY && process.env.NODE_ENV !== 'development') {
  posthogClient = new PostHog(process.env.VITE_POSTHOG_KEY, {
    host: process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  });
}

// Simple in-memory cache for hot invocations
const hdbCache: Record<string, any[]> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const dataset_id = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
  const df_cols = ["month", "town", "resale_price", "flat_type", "floor_area_sqm", "remaining_lease"];
  const param_fields = df_cols.join(",");
  const limit = 10000;
  
  const requestedMonth = req.query.month as string;

  if (requestedMonth && hdbCache[requestedMonth]) {
    console.log(`[Cache Hit] Serving data for ${requestedMonth}`);
    
    if (posthogClient) {
      posthogClient.capture({
        distinctId: 'server-backend',
        event: 'api_request_success',
        properties: {
          endpoint: 'getHdbData',
          cache_hit: true,
          requested_month: requestedMonth,
          record_count: hdbCache[requestedMonth].length
        }
      });
      await posthogClient.flush();
    }

    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    return res.status(200).json(hdbCache[requestedMonth]);
  }
  
  let url = `https://data.gov.sg/api/action/datastore_search?resource_id=${dataset_id}&fields=${param_fields}&limit=${limit}`;
  
  if (requestedMonth) {
    const filters = JSON.stringify({ month: requestedMonth });
    url += `&filters=${encodeURIComponent(filters)}`;
  }

  const options = {
    headers: {
      'x-api-key': process.env.DATAGOV_API_KEY || ''
    }
  };

  const fetchWithRetry = (url: string, options: any, retries = 0): Promise<any> => {
    return new Promise((resolve, reject) => {
      https.get(url, options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => data += chunk);
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.success) {
              resolve(parsed.result.records);
            } else if ((parsed.error?.name === 'TOO_MANY_REQUESTS' || parsed.name === 'TOO_MANY_REQUESTS') && retries < 3) {
              console.log(`[Retry] Rate limit hit, retrying in 10s... (Attempt ${retries + 1})`);
              
              if (posthogClient) {
                posthogClient.capture({
                  distinctId: 'server-backend',
                  event: 'api_rate_limit_hit',
                  properties: {
                    endpoint: 'getHdbData',
                    retry_attempt: retries + 1
                  }
                });
              }

              setTimeout(() => {
                fetchWithRetry(url, options, retries + 1).then(resolve).catch(reject);
              }, 10000);
            } else {
              reject(parsed.error || parsed || { message: 'Unknown API error' });
            }
          } catch (e) {
            if (retries < 3) {
              console.log(`[Retry] Invalid JSON received (Status: ${apiRes.statusCode}), retrying in 5s... (Attempt ${retries + 1})`);
              setTimeout(() => {
                fetchWithRetry(url, options, retries + 1).then(resolve).catch(reject);
              }, 5000);
            } else {
              reject({ 
                message: `API returned invalid JSON (Status ${apiRes.statusCode}): ${data.substring(0, 100)}...`,
                errorMsg: `Data.gov.sg is currently unavailable or returning invalid data. Please try again later.`,
                posthogErrorType: 'invalid_json',
                posthogStatusCode: apiRes.statusCode
              });
            }
          }
        });
      }).on('error', (err) => {
        if (retries < 3) {
          console.log(`[Retry] Network error, retrying in 5s... (Attempt ${retries + 1})`);
          setTimeout(() => {
            fetchWithRetry(url, options, retries + 1).then(resolve).catch(reject);
          }, 5000);
        } else {
          reject({
            message: err.message || 'Network error',
            errorMsg: 'Network error occurred while fetching data.',
            posthogErrorType: 'network_error',
            posthogStatusCode: 0,
            originalError: err
          });
        }
      });
    });
  };

  console.log(`[Cache Miss] Fetching data for ${requestedMonth || 'all'} from data.gov.sg`);

  try {
    const records = await fetchWithRetry(url, options);
    
    if (requestedMonth) {
      hdbCache[requestedMonth] = records;
      console.log(`[Cache Store] Data for ${requestedMonth} saved to memory`);
      res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    }
    
    if (posthogClient) {
      posthogClient.capture({
        distinctId: 'server-backend',
        event: 'api_request_success',
        properties: {
          endpoint: 'getHdbData',
          cache_hit: false,
          requested_month: requestedMonth || 'all',
          record_count: records.length
        }
      });
      await posthogClient.flush();
    }

    res.status(200).json(records);
  } catch (error: any) {
    console.error('[API Error]', error);
    
    if (posthogClient) {
      posthogClient.capture({
        distinctId: 'server-backend',
        event: 'api_error_fallback',
        properties: {
          endpoint: 'getHdbData',
          error_type: error.posthogErrorType || 'unknown',
          status_code: error.posthogStatusCode || 500
        }
      });
      await posthogClient.flush();
    }

    res.status(500).json({ 
      error: 'API Error', 
      message: error.errorMsg || error.message || 'Unknown API error',
      details: error 
    });
  }
}
