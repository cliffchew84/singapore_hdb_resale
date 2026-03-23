# Concurrent data.gov.sg Fetch

**Date:** 2026-03-23
**Status:** Approved

## Problem

The app fetches 2026 HDB resale data from data.gov.sg's CKAN API one month at a time, sequentially. With up to 12 months by December 2026, this is an unnecessary bottleneck.

## Solution

Process months in chunks of 3 concurrently using `Promise.all`. One file changes: `src/hooks/useHdbData.ts`, specifically the `fetchMonths` function.

## Design

Replace the sequential `for` loop in `fetchMonths` with chunk-based concurrent fetching:

```
chunk 1: Promise.all([Jan, Feb, Mar]) → await
chunk 2: Promise.all([Apr, May, Jun]) → await
...
```

- Chunk size = 3. Handles non-multiples of 3 naturally (last chunk has 1 or 2 months).
- If any month in a chunk fails, `Promise.all` rejects immediately — consistent with the existing sequential behaviour.
- No changes to loading messages — the existing spinner remains as-is.
- Records accumulate into a local array across all chunks; `setRawRecords` is called once at the end.

Both `loadInitialData` and `ensureDataForRange` call `fetchMonths`, so both gain concurrency automatically.

## What Does Not Change

- `api/getHdbData.ts`, `src/services/hdbService.ts`, MongoDB fetch path, all UI components.

## Testing

- Network tab: months within a chunk should fire simultaneously.
- If one month is blocked (DevTools), the chunk fails and an error is shown — no partial state.
