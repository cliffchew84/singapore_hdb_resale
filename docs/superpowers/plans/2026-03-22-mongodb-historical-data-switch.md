# MongoDB Historical Data Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route HDB resale data for 2020–2025 through MongoDB (`hdb_hist_v3`) instead of data.gov.sg, replacing up to 72 sequential API calls with fast year-level MongoDB queries.

**Architecture:** The API handler (`getHistoricalData.ts`) is updated to be a dedicated MongoDB endpoint — hardcoded collection, validated year param, no record limit, float-to-string normalization. The service layer (`mongoService.ts`) is simplified to a single-param call. The hook (`useHdbData.ts`) adds source routing: `ensureDataForRange` groups missing months by year and dispatches to MongoDB or HDB API accordingly, with a concurrency guard to prevent duplicate in-flight fetches.

**Tech Stack:** TypeScript, Node.js, MongoDB (`mongodb` npm package), React, Vercel serverless functions, Express (local dev via `server.ts`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `api/getHistoricalData.ts` | Modify | MongoDB API handler — validation, query, normalization |
| `src/services/mongoService.ts` | Modify | Thin fetch wrapper for `/api/getHistoricalData` |
| `src/hooks/useHdbData.ts` | Modify | Data routing logic — MongoDB vs HDB by year |

---

## Task 1: Rewrite `api/getHistoricalData.ts`

**Files:**
- Modify: `api/getHistoricalData.ts`

This is the bottom of the stack — implement and manually verify it works before touching the layers above.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `api/getHistoricalData.ts` with:

```typescript
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
```

- [ ] **Step 2: Start the dev server (if not already running)**

```bash
npm run dev
```

Expected: `Server running on http://localhost:3000`

- [ ] **Step 3: Verify — missing year returns 400**

```bash
curl -s http://localhost:3000/api/getHistoricalData | python3 -m json.tool
```

Expected:
```json
{"error": "year parameter is required"}
```
HTTP status 400.

- [ ] **Step 4: Verify — out-of-range year returns 400**

```bash
curl -s http://localhost:3000/api/getHistoricalData?year=2019 | python3 -m json.tool
```

Expected:
```json
{"error": "year must be one of: 2020, 2021, 2022, 2023, 2024, 2025"}
```

- [ ] **Step 5: Verify — valid year returns records with correct types**

```bash
curl -s "http://localhost:3000/api/getHistoricalData?year=2024" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('Record count:', len(data))
print('First record:', json.dumps(data[0], indent=2))
print('resale_price type:', type(data[0]['resale_price']).__name__)
print('floor_area_sqm type:', type(data[0]['floor_area_sqm']).__name__)
"
```

Expected:
- Record count well above 10,000
- `resale_price` type: `str`
- `floor_area_sqm` type: `str`
- All fields present: `month`, `town`, `resale_price`, `remaining_lease`, `flat_type`, `floor_area_sqm`, `year`

- [ ] **Step 6: Commit**

```bash
git add api/getHistoricalData.ts
git commit -m "feat: rewrite getHistoricalData for hdb_hist_v3 MongoDB collection

- Hardcode collection to hdb_hist_v3
- Add year validation (required, must be 2020-2025)
- Cast year to int to hit MongoDB index
- Remove 10k record limit
- Normalize resale_price and floor_area_sqm floats to strings
- Rename PostHog property requested_month -> requested_year"
```

---

## Task 2: Update `src/services/mongoService.ts`

**Files:**
- Modify: `src/services/mongoService.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/services/mongoService.ts` with:

```typescript
import { HdbResaleRecord } from '../types.ts';

export const fetchHistoricalData = async (year: string): Promise<HdbResaleRecord[]> => {
  try {
    const response = await fetch(`/api/getHistoricalData?year=${year}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch historical data');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/services/mongoService.ts
git commit -m "feat: simplify mongoService to year-only param for hdb_hist_v3"
```

---

## Task 3: Update `src/hooks/useHdbData.ts`

**Files:**
- Modify: `src/hooks/useHdbData.ts`

Three targeted changes: add import, add `fetchYearFromMongo`, replace `ensureDataForRange`.

- [ ] **Step 1: Add the import for `fetchHistoricalData`**

Find the existing import block at the top of the file:

```typescript
import { fetchHdbDataByMonth } from '../services/hdbService.ts';
```

Add the mongoService import directly after it:

```typescript
import { fetchHdbDataByMonth } from '../services/hdbService.ts';
import { fetchHistoricalData } from '../services/mongoService.ts';
```

- [ ] **Step 2: Add `fetchYearFromMongo` function**

Find the existing `fetchMonths` function:

```typescript
    // Function to fetch data for a specific set of months
    const fetchMonths = async (months: string[]) => {
```

Add `fetchYearFromMongo` directly after the closing brace of `fetchMonths`:

```typescript
    // Function to fetch a full year of data from MongoDB (2020-2025)
    const fetchYearFromMongo = async (year: string): Promise<HdbResaleRecord[]> => {
        setLoadingMessage(`Fetching data for ${year}...`);
        return await fetchHistoricalData(year);
    };
```

- [ ] **Step 3: Replace `ensureDataForRange`**

Find the existing function:

```typescript
    // Function to ensure data is loaded for a given range
    const ensureDataForRange = async (startDate: string, endDate: string) => {
        const requiredMonths = allMonthsToFetch.filter(m => m >= startDate && m <= endDate);
        const loadedMonths = [...new Set(rawRecords.map(r => r.month))];
        const missingMonths = requiredMonths.filter(m => !loadedMonths.includes(m));

        if (missingMonths.length > 0) {
            setIsIncrementalLoading(true);
            try {
                const newRecords = await fetchMonths(missingMonths);
                setRawRecords(prev => [...prev, ...newRecords]);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            } finally {
                setIsIncrementalLoading(false);
                setLoadingMessage('');
            }
        }
    };
```

Replace it with:

```typescript
    // Function to ensure data is loaded for a given range.
    // Routes to MongoDB (year-level) for 2020-2025, HDB API (month-level) for 2026.
    const ensureDataForRange = async (startDate: string, endDate: string) => {
        if (isIncrementalLoading) return;

        const requiredMonths = allMonthsToFetch.filter(m => m >= startDate && m <= endDate);
        const loadedMonths = [...new Set(rawRecords.map(r => r.month))];
        const missingMonths = requiredMonths.filter(m => !loadedMonths.includes(m));

        if (missingMonths.length === 0) return;

        // Group missing months by year
        const missingYears = [...new Set(missingMonths.map(m => m.split('-')[0]))];

        setIsIncrementalLoading(true);
        try {
            const allNewRecords: HdbResaleRecord[] = [];
            for (const year of missingYears) {
                if (year === '2026') {
                    // HDB API: fetch only the specific missing months
                    const monthsForYear = missingMonths.filter(m => m.startsWith(year));
                    const records = await fetchMonths(monthsForYear);
                    allNewRecords.push(...records);
                } else {
                    // MongoDB: fetch the entire year in one call.
                    // Full year is stored so future range expansions within this year are free.
                    const records = await fetchYearFromMongo(year);
                    allNewRecords.push(...records);
                }
            }
            setRawRecords(prev => [...prev, ...allNewRecords]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsIncrementalLoading(false);
            setLoadingMessage('');
        }
    };
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHdbData.ts
git commit -m "feat: route 2020-2025 data fetches to MongoDB in useHdbData

- Add fetchYearFromMongo using mongoService
- Update ensureDataForRange with year-level routing and concurrency guard
- 2026 continues to use HDB API month-by-month"
```

---

## Task 4: Manual Verification

No automated test infrastructure exists in this project. Verify correctness manually via the running dev server.

- [ ] **Step 1: Open the dashboard**

Navigate to `http://localhost:3000`. Confirm the app loads and 2026 data appears in the charts.

- [ ] **Step 2: Click a historical year button (e.g. 2024)**

In the sidebar, click `2024`. Watch the browser's Network tab (DevTools → Network).

Expected:
- One request to `/api/getHistoricalData?year=2024` (NOT multiple `/api/getHdbData` calls)
- Charts update with data spanning 2024–2026
- No console errors

- [ ] **Step 3: Click another historical year (e.g. 2023)**

Expected:
- One request to `/api/getHistoricalData?year=2023`
- Charts now show 2023–2026 data

- [ ] **Step 4: Click 2024 again**

Expected:
- **Zero new network requests** — data already in memory
- Charts remain correct

- [ ] **Step 5: Verify filters work on historical data**

With 2024 data loaded:
- Change Room Type filter → charts update
- Change Town filter → charts update
- Adjust Remaining Lease slider → charts update

- [ ] **Step 6: Verify comparison mode**

Toggle Comparison Mode on. Set Panel A to one town, Panel B to another. Confirm both panels render correctly for historical data.

- [ ] **Step 7: Spot-check record counts**

Pick a known month (e.g. `2024-03`). Compare the record count visible in the dashboard (Summary Stats) against the data.gov.sg record count for the same month. They should be close (minor differences are acceptable if your MongoDB data was built from the same source).

- [ ] **Step 8: Check server logs**

In the terminal running `npm run dev`, confirm you see log lines like:

```
[MongoDB Query] hdb_hist_v3 2024: 24XXXms
```

And NOT multiple `[Cache Miss] Fetching data for 2024-XX` lines when clicking historical year buttons.

---

## Task 5: Final Commit

- [ ] **Step 1: Verify clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Confirm all three tasks are committed**

```bash
git log --oneline -5
```

Expected to see the three feature commits from Tasks 1, 2, and 3.
