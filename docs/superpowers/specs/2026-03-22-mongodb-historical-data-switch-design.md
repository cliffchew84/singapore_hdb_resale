# Design: Switch Historical Data Source to MongoDB

**Date:** 2026-03-22
**Status:** Approved

## Overview

Switch the data source for historical HDB resale data (2020–2025) from the data.gov.sg API to MongoDB (`hdb_hist_v3` collection). Data for the current year (2026) continues to be fetched from data.gov.sg month-by-month. The change improves performance by replacing up to 72 sequential HTTP calls with targeted year-level MongoDB queries.

---

## MongoDB Schema (`hdb_hist_v3`)

| Field | Type | Notes |
|---|---|---|
| `month` | string | Format: `YYYY-MM` |
| `town` | string | e.g. `BISHAN` |
| `resale_price` | float | e.g. `650000.0` |
| `remaining_lease` | string | e.g. `69 years 04 months` |
| `flat_type` | string | e.g. `4 ROOM` |
| `floor_area_sqm` | float | e.g. `92.0` |
| `year` | int | e.g. `2024` — indexed for fast queries |

---

## Data Source Routing

| Year | Source | Fetch Granularity |
|---|---|---|
| 2026 | data.gov.sg via `/api/getHdbData` | Month-by-month (unchanged) |
| 2020–2025 | MongoDB `hdb_hist_v3` via `/api/getHistoricalData` | Whole year per call |

Once a year is loaded into `rawRecords` state, no further API calls are made for it. All date range changes and filter interactions operate on in-memory data via `useMemo`.

---

## Section 1: API Layer

### `api/getHistoricalData.ts` (updated)

**Changes required (none of these exist in current code):**

1. **Hardcode collection to `hdb_hist_v3`** — remove the dynamic `collection` query param entirely, eliminating the potential to query arbitrary collections

2. **Require and validate `year` param:**
   - Return `400` if `year` is missing
   - Return `400` if `year` is not a valid integer in the range 2020–2025
   - This replaces the current `collection` required-param validation

3. **Cast `year` to `int` before querying:** use `parseInt(year, 10)` so the query matches MongoDB's `year: int` index. Without this cast, MongoDB receives a string, the index is bypassed, and a full collection scan occurs.

4. **Remove the `.limit(10000)` cap:** a single year in `hdb_hist_v3` can contain 20,000–28,000 records. The current hard-coded `.limit(10000)` would silently truncate data, causing under-counted charts. Remove the limit entirely for year-level queries — MongoDB Atlas can handle full-year result sets.

5. **Normalize numeric fields in the response:** convert `resale_price` and `floor_area_sqm` from `float` to `string` (e.g. `String(doc.resale_price)`) before sending the JSON response. This keeps the existing `HdbResaleRecord` type and `dataProcessor.ts` unchanged. Note: JavaScript's `parseFloat()` in `dataProcessor.ts` would handle numeric values too, but normalizing at the API boundary is safer and more explicit.

6. **Rename the PostHog analytics property** from `requested_month` to `requested_year` in the success event, and remove the outdated comment alongside it.

7. **Keep the existing 1-week `Cache-Control` header.**

### `api/getHdbData.ts`

No changes. Continues to serve 2026 data.

---

## Section 2: Service Layer

### `src/services/mongoService.ts` (updated)

- Remove the dynamic `collectionName` parameter — always uses `hdb_hist_v3`
- Accept `year: string` as the only parameter
- Return type: `Promise<HdbResaleRecord[]>` (import `HdbResaleRecord` from `src/types.ts`)
- Calls `/api/getHistoricalData?year=<year>`
- Keep existing error handling

### `src/services/hdbService.ts`

No changes.

---

## Section 3: Hook Layer (`src/hooks/useHdbData.ts`)

### New function: `fetchYearFromMongo(year: string)`

- Imports and calls `fetchHistoricalData(year)` from `src/services/mongoService.ts` (add this import — currently missing from `useHdbData.ts`)
- Returns `HdbResaleRecord[]`

### Routing: `ensureDataForRange` is the single canonical routing point

`ensureDataForRange(startDate, endDate)` is updated to handle both sources. `handleYearSelect` continues to delegate to `ensureDataForRange` unchanged — no routing logic lives in `handleYearSelect` itself.

**Updated `ensureDataForRange` logic:**
1. **Concurrency guard:** if `isIncrementalLoading` is already `true`, return early — do not issue duplicate fetches for in-flight requests
2. Determine required months for the given range (sourced from `allMonthsToFetch`, which spans 2020-01 to 2026-12)
3. Diff against already-loaded months in `rawRecords` to find missing months
4. Group missing months by year
5. For each year that has missing months:
   - If `year === '2026'` → call `fetchMonths(missingMonthsForThisYear)` (HDB API, one call per month)
   - Otherwise (2020–2025) → call `fetchYearFromMongo(year)` (MongoDB, **one call for the entire year** regardless of how many months are missing — the full year is fetched and stored, so future requests for other months in that year are already covered)
6. Append all new records to `rawRecords`

**Routing guard rationale:** The check `year === '2026'` is the complete routing condition. Years outside 2020–2026 cannot appear because `allMonthsToFetch` is hard-coded to that range — no fallback or else-if branch is needed.

**Why fetch the full year from MongoDB even if only one month is missing:** fetching the whole year costs the same single round-trip, and avoids a follow-up call if the user later expands their date range within the same year.

### Initial load on mount

No changes. Fetches all 2026 months from HDB API on startup.

---

## Section 4: Testing

### API-level (manual)

Hit `/api/getHistoricalData?year=2024` directly and verify:
- `resale_price` and `floor_area_sqm` are returned as strings
- All other fields are strings
- Record count is well above 10,000 (confirms the limit cap has been removed and the `year` int cast is working)
- Verify `/api/getHistoricalData` with no `year` param returns `400`
- Verify `/api/getHistoricalData?year=2019` returns `400` (out of range)

### Visual smoke test (dashboard)

- Click a historical year (e.g. 2024) → data loads without errors
- Box plot, line chart, stacked bar chart all render correctly
- Room Type, Town, and Remaining Lease filters work
- Comparison mode works with both panels

### Data accuracy spot-check

- Pick a known month (e.g. `2024-03`) and compare record count between MongoDB and data.gov.sg for the same month — they should match
- Pick a full year (e.g. `2023`) and compare the total record count between MongoDB and data.gov.sg — confirms no truncation from the removed limit

### Error handling

- Simulate a MongoDB failure (e.g. wrong password temporarily) and verify the dashboard shows an error state rather than silently rendering empty charts — the existing `catch` block in `ensureDataForRange` should handle this for the new MongoDB code path the same as it does today for HDB failures

---

## Files Changed

| File | Change |
|---|---|
| `api/getHistoricalData.ts` | Hardcode collection, add year validation, cast year to int, remove 10k limit, normalize floats to strings |
| `src/services/mongoService.ts` | Remove collection param, accept year only |
| `src/hooks/useHdbData.ts` | Add import for `mongoService`, add `fetchYearFromMongo`, update `ensureDataForRange` with source routing |

## Files Unchanged

- `api/getHdbData.ts`
- `src/services/hdbService.ts`
- `src/types.ts`
- `src/utils/dataProcessor.ts`
- All chart components
