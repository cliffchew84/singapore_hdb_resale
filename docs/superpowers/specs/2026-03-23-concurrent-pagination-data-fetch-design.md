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

**`offset` parameter parsing and cache key:** The `offset` must be parsed and the cache key constructed **before** the cache-read branch. The ordering is:

```ts
const offset = parseInt(req.query.offset as string, 10);
const safeOffset = isNaN(offset) || offset < 0 ? 0 : offset;
const cacheKey = `${requestedMonth}-${safeOffset}`;
// cache read must use cacheKey, not requestedMonth
if (requestedMonth && hdbCache[cacheKey]) { ... }
// cache write must also use cacheKey
hdbCache[cacheKey] = records;
```

Do not forward an unvalidated string to data.gov.sg — an invalid offset produces an unretried upstream error. Mirror the `year` validation pattern in `api/getHistoricalData.ts`. **Both** the cache read (currently line 23) and cache write (currently line 128) in `api/getHdbData.ts` must use `cacheKey`.

**`Cache-Control` header:** The `s-maxage=604800` header must be set for all `(month, offset)` combinations, not just offset-0, since all pages are equally stable historical data.

**data.gov.sg URL:** Append `&offset=${offset}` to the existing query string. No other server changes needed.

### `src/services/hdbService.ts` — paginated fetch

**Change:** Replace `fetchHdbDataByMonth(month)` with a paginated variant (`fetchHdbDataByMonthPaginated`):

1. Fetch page at `offset=0`
2. If `response.length === LIMIT` (10,000), fetch next page at `offset += LIMIT`
3. Repeat until `response.length < LIMIT`
4. Return all pages concatenated

**Pagination termination edge cases:**
- If `response.length === 0` on any page (including the first), the loop terminates and returns whatever was accumulated so far (empty array for first page). This is correct — it handles months with no transactions, and also handles the case where the last real page contains exactly `LIMIT` records (one extra 0-record request is made, which terminates cleanly).
- Pagination stops on error and does not return partial data for a month (the rejection propagates up).

**`LIMIT` constant:** Define `LIMIT = 10000` in `src/services/hdbService.ts`. The same value exists as a local `const limit = 10000` in `api/getHdbData.ts`. These are in separate runtime environments (browser vs. Node.js serverless) and cannot share a module import. **Duplicate the constant in both files** with a comment: `// Must match LIMIT in src/services/hdbService.ts`. A shared `src/constants.ts` is not worth the complexity for a single value.

### `src/hooks/useHdbData.ts` — bounded concurrent `fetchMonths`

**Import change:** Replace the `fetchHdbDataByMonth` import with `fetchHdbDataByMonthPaginated`. The old `fetchHdbDataByMonth` function in `hdbService.ts` is deleted — it is not used anywhere else.

**Scope of change:** `fetchMonths` is called from two places in `useHdbData.ts`: the initial load path (`loadInitialData`, line 97) and the incremental load path (`ensureDataForRange`, line 141). Both call sites automatically gain pagination and concurrency support because `fetchMonths` is the shared function being updated. No changes are needed at the call sites themselves.

**Change:** Replace the sequential `for` loop in `fetchMonths` with chunk-based concurrent fetching using `Promise.allSettled`:

```
months = [Jan, Feb, Mar, Apr, May, Jun, ...]
chunk 1: Promise.allSettled([Jan, Feb, Mar]) → await all
chunk 2: Promise.allSettled([Apr, May, Jun]) → await all
...
```

**Why `Promise.allSettled` instead of `Promise.all`:** With `Promise.all`, a single failing month in a chunk silently discards records from the other months in that chunk that resolved successfully. `Promise.allSettled` collects all outcomes; fulfilled months contribute their records, rejected months surface their errors. If any month in a chunk fails, the **lowest-index** rejected reason is thrown after accumulating the successful records from that chunk (i.e., iterate `results` in input order, pick the first entry with `status === 'rejected'`). This preserves parity with the sequential loop, where the first failure in iteration order throws and stops. When multiple months in the same chunk fail, subsequent rejection reasons are discarded.

- Chunk size = 3 (constant, not configurable). Handles non-multiples of 3 naturally — the last chunk will have 1 or 2 months.
- Loading message updates per chunk using the existing convention: `"Fetching data for 2026-01 – 2026-03..."`. Pagination progress within a chunk is intentionally not surfaced to the user (loading indicator remains visible during multi-page fetches).
- Records from all chunks are accumulated into a local array and passed to `setRawRecords` once at the end — preserving the existing single-update pattern and avoiding intermediate re-renders.

**Future months (2026-04 through 2026-12):** `allMonthsToFetch` currently generates all 12 months of 2026 regardless of the current date. With concurrency, requests for future months (which return 0 records) are now issued in parallel rather than sequentially. This is acceptable — 0-record responses are fast, cheap, and handled cleanly by the pagination termination condition. Capping `allMonthsToFetch` at the current month is deferred as a separate optimisation.

## Data Flow

```
useHdbData.fetchMonths(months)
  → chunk months into groups of 3
  → for each chunk: Promise.allSettled(months.map(fetchHdbDataByMonthPaginated))
    → collect fulfilled results, surface any rejections
    → fetchHdbDataByMonthPaginated(month)
      → GET /api/getHdbData?month=M&offset=0
        → data.gov.sg CKAN API (filtered by month, offset N)
      → if records.length === LIMIT: repeat with offset+=LIMIT
      → if records.length === 0 or < LIMIT: stop
      → return all pages merged
  → accumulate records across chunks
  → return all records
```

## Error Handling

- No change to existing retry logic in `api/getHdbData.ts` (handles `TOO_MANY_REQUESTS` and network errors)
- A failure in any month propagates via the existing `catch` in `ensureDataForRange` / `loadInitialData`
- Successful months within a failed chunk are not discarded (preserved by `Promise.allSettled`)
- Pagination stops on error and does not return partial data for a month

## Testing

**Pagination boundary:** Temporarily lower `LIMIT` to a small value (e.g. 100) and fetch a month with known record count > 100. Verify all records are returned and the paginated pages appear in the server cache (check logs for multiple `[Cache Miss]` entries for the same month with different offsets).

**Concurrency:** Load the dashboard and observe the network tab — requests for months within the same chunk should fire simultaneously, not sequentially.

**`Promise.allSettled` partial success:** Simulate a 429 on one month mid-chunk (via browser DevTools request blocking). Verify that other months in the chunk still load their data and only the blocked month is missing.

**Empty month:** Request a future 2026 month (e.g. 2026-12). Verify it returns an empty array and does not cause an error or hang.

**`offset` validation:** Send a request to `/api/getHdbData?month=2026-01&offset=abc`. Verify the server treats it as `offset=0` and returns valid data (not a 500).

## What Does Not Change

- 2020–2025 data continues to be fetched year-at-a-time from MongoDB — no changes to `mongoService.ts` or `getHistoricalData.ts`
- `ensureDataForRange` routing logic (2026 → HDB API, pre-2026 → MongoDB) is unchanged
- All filter state, chart logic, and UI components are unchanged
