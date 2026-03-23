# Architecture: Static JSON Files for Historical HDB Data

**Date:** 2026-03-22
**Status:** Proposed (not yet implemented)
**Applies to:** 2020–2025 historical data

---

## Context

The dashboard fetches HDB resale transaction data for two sources:

| Year | Source | Mechanism |
|---|---|---|
| 2026 (current year) | data.gov.sg | Month-by-month API calls via `/api/getHdbData` |
| 2020–2025 (historical) | MongoDB `hdb_hist_v3` | Year-level query via `/api/getHistoricalData` |

After switching historical data to MongoDB, per-year queries return 20,000–28,000 raw records that are sent to the browser for client-side filtering. This payload (4MB uncompressed per year) makes the first load of any historical year feel slow.

Client-side filtering **cannot be removed** — users filter by town, flat type, and remaining lease across arbitrary date ranges. Pre-aggregating in MongoDB would break this.

---

## Decision

Serve historical JSON as **static files from `public/data/`**, one file per year. Vercel serves these from its global CDN edge network, bypassing MongoDB queries and serverless function cold starts entirely.

Files are generated once from MongoDB, committed into the repo, and served as static assets. Historical data (2020–2025) does not change retroactively, making this safe.

---

## How It Works

```
Browser clicks "2024"
    → fetch /data/2024.json          ← served from Vercel CDN edge (closest to user)
    → browser caches file
    → filter/render in-memory

Browser clicks "2024" again
    → served from browser cache      ← zero network cost
```

Compared to the MongoDB path:

```
Browser clicks "2024"
    → POST /api/getHistoricalData?year=2024
    → Vercel spins up serverless function (cold start: 200–800ms)
    → Function queries MongoDB Atlas (round-trip: 200–500ms)
    → Function serializes 25k records to JSON
    → Browser receives and parses response
```

---

## Implementation

### Step 1: Export data from MongoDB

Run this once per year (or when the MongoDB dataset is updated). Requires Python and the `pymongo` and `polars` packages.

```python
import pymongo
import polars as pl
import json
import os

client = pymongo.MongoClient(os.environ["MONGODB_URI"])
db = client["nlb"]
collection = db["hdb_hist_v3"]

YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

for year in YEARS:
    docs = list(collection.find({"year": year}, {"_id": 0}))

    # Normalize float fields to strings to match HdbResaleRecord type
    for doc in docs:
        doc["resale_price"] = str(doc["resale_price"])
        doc["floor_area_sqm"] = str(doc["floor_area_sqm"])

    output_path = f"public/data/{year}.json"
    with open(output_path, "w") as f:
        json.dump(docs, f)

    print(f"{year}: {len(docs)} records → {output_path}")
```

Verify counts match data.gov.sg before committing, especially for 2025 (most likely year to have late-arriving records).

### Step 2: Create the directory and files

```
public/
  data/
    2020.json
    2021.json
    2022.json
    2023.json
    2024.json
    2025.json
```

Files in `public/` are served by Vite (local dev) and Vercel (production) as static assets with no additional configuration.

### Step 3: Update `src/services/mongoService.ts`

Replace the API call with a static file fetch:

```typescript
import { HdbResaleRecord } from '../types.ts';

export const fetchHistoricalData = async (year: string): Promise<HdbResaleRecord[]> => {
  try {
    const response = await fetch(`/data/${year}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};
```

No other files need to change. `useHdbData.ts` and `api/getHistoricalData.ts` are unaffected.

### Step 4: Keep `/api/getHistoricalData` working

Do not delete the API endpoint. It remains useful for:
- Verifying MongoDB data integrity
- Refreshing a single year without full redeployment (if you use Vercel Blob in future)
- Debugging data issues

---

## Storage and Cost Impact

| Metric | Value |
|---|---|
| Raw JSON size per year | ~4MB |
| After brotli compression (served by Vercel CDN) | ~400–600KB |
| Total for 6 years (compressed) | ~3MB |
| Vercel Hobby deployment limit | 100MB |
| Deployment size used | ~3% |
| Vercel Hobby bandwidth limit | 100GB/month |
| Cost impact | None |

---

## Performance Impact on Other Areas

None. Files in `public/` are:

- **Not bundled by Vite** — JS bundle size is unchanged
- **Not fetched on initial page load** — only loaded when a user clicks a historical year button
- **Served from CDN, not serverless functions** — no cold start, no 10-second timeout risk, no MongoDB connection

Lighthouse scores, initial load time, and all other routes are unaffected.

---

## Risks and Mitigations

### Data staleness

**Risk:** Static files are frozen at deployment time. If MongoDB data is corrected after files are generated, the files go stale.

**Likelihood:** Low. HDB historical data (2020–2024) is government data that does not change retroactively. 2025 data may have late-arriving records if data.gov.sg published entries after your MongoDB import.

**Mitigation:** Before generating files, verify record counts against data.gov.sg for each year. Regenerate and redeploy if corrections are needed (takes ~5 minutes). Keep `/api/getHistoricalData` as a fallback for debugging.

### Browser cache invalidation

**Risk:** If a file is updated (e.g., 2025 data corrected), users who already downloaded the old version will serve from cache until expiry.

**Likelihood:** Rare for historical data.

**Mitigation:** If a correction is critical, rename the file (e.g., `2025-v2.json`) and update the fetch URL in `mongoService.ts`. This busts the browser cache.

### Security

No concern. All HDB resale transaction data is publicly available on data.gov.sg. The JSON files are accessible at `/data/2024.json` directly — this is intentional and acceptable.

---

## Adding a New Year

When 2026 becomes historical (i.e., the current year rolls to 2027):

1. Ensure 2026 data is complete in MongoDB `hdb_hist_v3`
2. Run the export script for year `2026`
3. Add `/data/2026.json` to `public/data/`
4. Update `VALID_YEARS` in `api/getHistoricalData.ts` if needed
5. Update `allMonthsToFetch` in `useHdbData.ts` to extend the range
6. The routing logic in `useHdbData.ts` (`year === '2026'` → HDB API) will need updating to `year === '2027'`
7. Deploy

---

## What Stays on MongoDB

`/api/getHistoricalData` and the MongoDB `hdb_hist_v3` collection remain in place. They are the source of truth for generating static files and for data verification. MongoDB is not removed from the architecture — it just moves from the hot path (user request) to the cold path (data export).
