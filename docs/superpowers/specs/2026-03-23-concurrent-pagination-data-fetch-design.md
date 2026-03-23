# Concurrent data.gov.sg Fetch

**Date:** 2026-03-23
**Status:** Approved

## Problem

The app fetches 2026 HDB resale data from data.gov.sg's CKAN API **one month at a time, sequentially**. This causes:

1. **Slow initial load** — N months = N sequential round-trips
2. **Growing bottleneck** — by December 2026 this will be 12 sequential calls

## Constraints

- Vercel Hobby tier: limited concurrent invocations — unbounded `Promise.all` over 12 months risks cold-start failures
- data.gov.sg rate limiting: already observed (`TOO_MANY_REQUESTS` with retry logic in place) — concurrent calls amplify this risk
- data.gov.sg only supports month-level filtering (no year-level or range queries)
- HDB resale transactions per month are typically 2,000–4,000, well under the existing `limit=10000` per call — no pagination needed

## Solution

**Bounded concurrency of 3 months at a time.**

- Months are processed in chunks of 3 via `Promise.allSettled`
- No changes to the server or the per-month fetch function
- One file changes: `src/hooks/useHdbData.ts`

## Architecture

### `src/hooks/useHdbData.ts` — bounded concurrent `fetchMonths`

**Import change:** No change — `fetchHdbDataByMonth` is unchanged and stays as-is.

**Scope of change:** `fetchMonths` is called from two places:
- `loadInitialData` (line 97) — initial 2026 load on mount
- `ensureDataForRange` (line 141) — incremental load when user expands the date range

Both call sites automatically gain concurrency because `fetchMonths` is the shared function. No changes needed at the call sites.

**Change:** Replace the sequential `for` loop in `fetchMonths` with chunk-based concurrent fetching using `Promise.allSettled`:

```
months = [Jan, Feb, Mar, Apr, May, Jun, ...]
chunk 1: Promise.allSettled([Jan, Feb, Mar]) → await all
chunk 2: Promise.allSettled([Apr, May, Jun]) → await all
...
```

- Chunk size = 3 (constant, not configurable). Handles non-multiples of 3 naturally.
- **Why `Promise.allSettled` instead of `Promise.all`:** With `Promise.all`, a single failing month silently discards records from the other successfully-resolved months in that chunk. `Promise.allSettled` collects all outcomes first; fulfilled months contribute their records, then the lowest-index rejected reason is thrown (iterate results in input order, pick first `status === 'rejected'`). This matches the existing sequential loop's behaviour where completed months are not discarded.
- Loading message updates per chunk using the existing convention: `"Fetching data for 2026-01 – 2026-03..."`
- Records from all chunks are accumulated into a local array and passed to `setRawRecords` once at the end — preserving the single-update pattern and avoiding intermediate re-renders.

**Future months (2026-04 through 2026-12):** `allMonthsToFetch` generates all 12 months of 2026 regardless of current date. With concurrency, requests for future months (0 records) fire in parallel. This is acceptable — empty responses are fast and cheap. Capping at current month is deferred as a separate optimisation.

## Data Flow

```
useHdbData.fetchMonths(months)
  → chunk months into groups of 3
  → for each chunk: Promise.allSettled(months.map(fetchHdbDataByMonth))
    → collect fulfilled records, surface lowest-index rejection if any
  → accumulate records across all chunks
  → return all records
```

## Error Handling

- No change to existing retry logic in `api/getHdbData.ts`
- A failure in any month propagates via the existing `catch` in `ensureDataForRange` / `loadInitialData`
- Successful months within a failed chunk are not discarded (`Promise.allSettled`)

## What Does Not Change

- `api/getHdbData.ts` — no changes
- `src/services/hdbService.ts` — no changes
- 2020–2025 MongoDB fetch path — no changes
- `ensureDataForRange` routing logic — no changes
- All filter state, chart logic, and UI components — no changes

## Testing

**Concurrency:** Load the dashboard and observe the network tab — requests for months within the same chunk should fire simultaneously, not sequentially.

**Partial success:** Simulate a 429 on one month mid-chunk (via browser DevTools request blocking). Verify other months in the chunk still load their data and only the blocked month is missing.

**Empty month:** Verify a future 2026 month returns an empty array without causing an error or hang.
