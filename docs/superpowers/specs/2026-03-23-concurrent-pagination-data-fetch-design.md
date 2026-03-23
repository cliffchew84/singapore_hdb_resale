# Concurrent + Paginated data.gov.sg Fetch

**Date:** 2026-03-23
**Status:** Approved

## Problem

The app fetches 2026 HDB resale data from data.gov.sg's CKAN API **one month at a time, sequentially**. This causes three issues:

1. **Slow initial load** — N months = N sequential round-trips
2. **No pagination safety net** — `limit=10000` is hardcoded; if a month ever exceeds 10k records, data is silently truncated
3. **Growing bottleneck** — by December 2026 this will be 12 sequential calls

## Constraints

- Vercel Hobby tier: **10-second serverless function timeout** — pagination must be client-driven, not server-driven
- Vercel free tier: limited concurrent invocations — unbounded `Promise.all` over 12 months risks cold-start failures
- data.gov.sg rate limiting: already observed (`TOO_MANY_REQUESTS` with retry logic in place) — concurrent calls amplify this risk
- data.gov.sg only supports month-level filtering (no year-level or range queries)

## Solution

**Bounded concurrency of 3 months at a time, with client-side pagination per month.**

- Months are processed in chunks of 3 via `Promise.all`
- Each month fetch paginates automatically if the response hits the 10k limit
- The server adds `offset` param support; pagination is orchestrated by the browser

## Architecture

### `api/getHdbData.ts` — add `offset` support

**Change:** Accept an `offset` query parameter (default `0`) and pass it to data.gov.sg.

```
GET /api/getHdbData?month=2026-01&offset=0
GET /api/getHdbData?month=2026-01&offset=10000
```

**Cache key:** Change from `month` to `${month}-${offset}` so each page is cached independently.

**data.gov.sg URL:** Append `&offset=${offset}` to the existing query string. No other server changes needed.

### `src/services/hdbService.ts` — paginated fetch

**Change:** Replace `fetchHdbDataByMonth(month)` with a paginated variant:

1. Fetch page at `offset=0`
2. If `response.length === LIMIT` (10,000), fetch next page at `offset += LIMIT`
3. Repeat until `response.length < LIMIT`
4. Return all pages concatenated

The `LIMIT` constant (10,000) should be defined once and shared between the pagination check and the API call.

### `src/hooks/useHdbData.ts` — bounded concurrent `fetchMonths`

**Change:** Replace the sequential `for` loop in `fetchMonths` with chunk-based concurrent fetching:

```
months = [Jan, Feb, Mar, Apr, May, Jun, ...]
chunk 1: Promise.all([Jan, Feb, Mar]) → await all
chunk 2: Promise.all([Apr, May, Jun]) → await all
...
```

- Chunk size = 3 (constant, not configurable)
- Loading message updates per chunk: `"Fetching 2026-01 – 2026-03..."`
- Records from each chunk are accumulated and appended to state after all chunks complete (same as current behaviour — single `setRawRecords` call at the end of `fetchMonths`)

## Data Flow

```
useHdbData.fetchMonths(months)
  → chunk months into groups of 3
  → for each chunk: Promise.all(months.map(fetchHdbDataByMonthPaginated))
    → fetchHdbDataByMonthPaginated(month)
      → GET /api/getHdbData?month=M&offset=0
        → data.gov.sg CKAN API (filtered by month, offset N)
      → if records.length === 10000: repeat with offset+=10000
      → return all pages merged
  → accumulate records across chunks
  → return all records
```

## Error Handling

- No change to existing retry logic in `api/getHdbData.ts` (handles `TOO_MANY_REQUESTS` and network errors)
- A failure in any month within a chunk propagates via the existing `catch` in `ensureDataForRange` / `loadInitialData`
- Pagination stops on error (does not partially return data for a month)

## What Does Not Change

- 2020–2025 data continues to be fetched year-at-a-time from MongoDB — no changes to `mongoService.ts` or `getHistoricalData.ts`
- `ensureDataForRange` routing logic (2026 → HDB API, pre-2026 → MongoDB) is unchanged
- All filter state, chart logic, and UI components are unchanged
