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

- **Hardcode collection** to `hdb_hist_v3` — remove dynamic `collection` query param
- **Cast `year` param to int** via `parseInt(year)` before querying MongoDB, to hit the `year` index and avoid a full collection scan
- **Normalize numeric fields** in the response: convert `resale_price` and `floor_area_sqm` from `float` to `string` so the existing `HdbResaleRecord` type and `dataProcessor.ts` require zero changes
- Keep existing 1-week `Cache-Control` header

### `api/getHdbData.ts`

No changes. Continues to serve 2026 data.

---

## Section 2: Service Layer

### `src/services/mongoService.ts` (updated)

- Remove dynamic `collectionName` parameter — always uses `hdb_hist_v3`
- Accept `year: string` as the only parameter
- Calls `/api/getHistoricalData?year=<year>`
- Keep existing error handling

### `src/services/hdbService.ts`

No changes.

---

## Section 3: Hook Layer (`src/hooks/useHdbData.ts`)

### New function: `fetchYearFromMongo(year: string)`

Calls `mongoService.fetchHistoricalData(year)` and returns `HdbResaleRecord[]`.

### Updated: `handleYearSelect(year: string)`

```
if year === '2026' → fetchMonths() via HDB API (existing behaviour)
else               → fetchYearFromMongo() via MongoDB
```

### Updated: `ensureDataForRange(startDate, endDate)`

- Groups missing months by year
- For each year with missing months:
  - If `2026` → fetch missing months via HDB API
  - If `2020–2025` → fetch entire year via MongoDB (one call per year)
- Appends new records to `rawRecords` state

### Initial load on mount

No changes. Fetches all 2026 months from HDB API on startup.

---

## Section 4: Testing

### API-level (manual)
- Hit `/api/getHistoricalData?year=2024` directly
- Verify `resale_price` and `floor_area_sqm` are returned as strings
- Verify record count is non-zero (confirms `year` int cast works)

### Visual smoke test (dashboard)
- Click a historical year (e.g. 2024) → data loads without errors
- Box plot, line chart, stacked bar chart all render correctly
- Room Type, Town, and Remaining Lease filters work
- Comparison mode works with both panels

### Data accuracy spot-check
- Pick a known month (e.g. `2024-03`)
- Compare record count from MongoDB vs data.gov.sg for the same month — should match

---

## Files Changed

| File | Change |
|---|---|
| `api/getHistoricalData.ts` | Hardcode collection, cast year to int, normalize floats to strings |
| `src/services/mongoService.ts` | Remove collection param, accept year only |
| `src/hooks/useHdbData.ts` | Add `fetchYearFromMongo`, update routing in `handleYearSelect` and `ensureDataForRange` |

## Files Unchanged

- `api/getHdbData.ts`
- `src/services/hdbService.ts`
- `src/types.ts`
- `src/utils/dataProcessor.ts`
- All chart components
