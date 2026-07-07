# DuckDB‑Wasm Refactor Plan for HDB Resale Price Dashboard

**Goal**  
Replace the existing REST‑API based data fetching workflow with a client‑side solution that:

1. **Downloads** a Parquet file stored in Cloudflare R2 once (or lazily loads partitions).  
2. **Queries** that Parquet in the browser using **DuckDB‑Wasm**.  
3. **Feeds** the resulting rows into the current React components without any change to the UI.

---

## 🚀 Refactor Progress

- [x] **Phase 1: Infrastructure**
    - [x] Install `@duckdb/duckdb-wasm`
    - [x] Configure Vite/Webpack for Wasm support
- [x] **Phase 2: Data Layer**
    - [x] Implement `src/services/parquetHdbService.ts`
    - [ ] Verify remote Parquet fetching and SQL query generation
- [ ] **Phase 3: Integration**
    - [ ] Update `src/hooks/useHdbData.ts` to consume `queryHdb`
    - [ ] Implement async loading and error states in UI
- [ ] **Phase 4: Optimization & QA**
    - [ ] Implement browser caching / IndexedDB fallback
    - [ ] Verify data integrity vs legacy API
    - [ ] Performance benchmarking (TTV & Memory)
- [ ] **Phase 5: Cleanup**
    - [ ] Decommission legacy REST API endpoints
    - [ ] Final production deployment & smoke test

---

## Table of Contents
1. [Preparation – Create & Upload the Parquet File](#preparation--create--upload-the-parquet-file)  
2. [Add DuckDB‑Wasm to the Front‑End Stack](#add-duckdb‑wasm-to-the-front‑end-stack)  
3. [Build a Parquet Query Service](#build-a-parquet-query-service)  
4. [Migrate Data Loading Logic](#migrate-data-loading-logic)  
5. [Cache & Incremental Loading Strategies](#cache--incremental-loading-strategies)  
6. [Testing & Validation](#testing--validation)  
7. [Decommission the Legacy API](#decommission-the-legacy-api)  
8. [Optional Enhancements](#optional-enhancements)  

---

<a name="preparation--create--upload-the-parquet-file"></a>
✅ Preparation Already Completed

## 📋 Next Steps

- The Parquet file is already stored in Cloudflare R2 and updated daily.
- It is accessible at `/data/hdb-data.parquet` (adjust `PARQUET_URL` in the code if needed).
- Ensure the file is publicly readable or expose a signed URL via a Worker if the data is private.
- Cache‑busting can be handled with a version query parameter (`?v=YYYYMMDD`) when the file changes.
- **Proceed to**: Add DuckDB‑Wasm, build the query service, migrate data‑loading logic, etc. (see the rest of this doc for details).

| Step | Command / Action | Details |
|------|------------------|---------|
| 1️⃣  | Export current JSON API responses to `hdb-resale.json` | Use your existing backend script or a one‑off fetch script (`node fetch-hdb-data.js`). |
| 2️⃣  | Convert JSON → Parquet (`hdb-data.parquet`) | Use **Apache Arrow** or **pandas** (Python) or **duckdb** CLI: <br>`duckdb -c "COPY (SELECT * FROM read_json_auto('hdb-resale.json')) TO 'hdb-data.parquet' (FORMAT parquet)"` |
| 3️⃣  | Upload to Cloudflare R2 bucket | `aws s3 cp hdb-data.parquet s3://my-r2-bucket/hdb-data.parquet --endpoint-url https://<account>.r2.cloudflarestorage.com` (or use Cloudflare dashboard). |
| 4️⃣  | Make the file publicly readable **or** generate a signed URL via a tiny worker if the data is sensitive. | For private data: <br>```js // Cloudflare Worker (worker.js)```<br>`addEventListener('fetch', e => { if (e.request.method === 'GET') e.respondWith(handleGet(e.request)) })`<br>`async function handleGet(req) { const url = new URL(req.url); if (url.pathname === '/hdb-data.parquet') { const signed = await signURL('hdb-data.parquet'); return Response.redirect(signed); } }``` |
| 5️⃣  | Set a cache‑busting version header if you plan to replace the file later (`?v=2024-09`). | This allows instant roll‑outs when a new Parquet is uploaded. |

---

<a name="add-duckdb‑wasm-to-the-front‑end-stack"></a>
## 2️⃣ Add DuckDB‑Wasm to the Front‑End Stack

| Command | What it does |
|---------|--------------|
| `npm i duckdb-wasm` *(or `yarn add duckdb-wasm`)* | Installs the JS‑/Wasm package that exposes DuckDB in the browser. |
| Ensure your bundler includes the generated `.wasm` file | Vite automatically bundles WebAssembly; add `import DuckDB from 'duckdb-wasm'` and the bundler will handle it. |
| (Optional) Add TypeScript typings | `npm i -D @types/duckdb-wasm` if you want strict typing. |

**Vite configuration snippet (if needed)**  

```js
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // makes importing duckdb-wasm clearer
      'duckdb': resolve(__dirname, 'node_modules/duckdb-wasm/dist/index.js')
    }
  }
});
```

---

<a name="build-a-parquet-query-service"></a>
## 3️⃣ Build a Parquet Query Service

**File:** `src/services/parquetHdbService.ts`

```ts
// src/services/parquetHdbService.ts
import * as duckdb from '@duckdb/duckdb-wasm';
import type { HdbResaleRecord, HdbFilter } from '../types';

// URL of the parquet file (public or signed)
const PARQUET_URL = '/data/hdb-data.parquet'; 

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

/** 
 * Initializes DuckDB-Wasm. 
 * This is expensive and should only be done once.
 */
async function initDb() {
  if (db) return { db, conn };

  // 1. Select the appropriate bundle based on browser capabilities
  const bundle = await duckdb.selectBundle({
    mvpMode: false, 
  });

  // 2. Create a worker and instantiate the database
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  
  conn = await db.connect();
  return { db, conn };
}

/** Turns the UI filter into a safe SQL WHERE clause */
function buildWhereClause(f: HdbFilter): string {
  const parts: string[] = [];

  if (f.startMonth) parts.push(`month >= '${f.startMonth}'`);
  if (f.endMonth)   parts.push(`month <= '${f.endMonth}'`);
  if (f.selectedTowns?.length) parts.push(`town IN (${f.selectedTowns.map(t => `'${t}'`).join(',')})`);
  if (f.selectedFlatTypes?.length) parts.push(`flat_type IN (${f.selectedFlatTypes.map(t => `'${t}'`).join(',')})`);
  if (f.selectedLeaseRange?.[0] !== undefined) parts.push(`remaining_lease >= ${f.selectedLeaseRange[0] * 12}`);
  if (f.selectedLeaseRange?.[1] !== undefined) parts.push(`remaining_lease <= ${f.selectedLeaseRange[1] * 12}`);

  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

/**
 * Queries the remote Parquet file and returns the result set.
 */
export async function queryHdb(filter: HdbFilter): Promise<HdbResaleRecord[]> {
  const { conn } = await initDb();
  if (!conn) throw new Error('Failed to initialize DuckDB connection');

  // Create a view of the remote Parquet file
  // DuckDB-Wasm can query HTTP URLs directly via the read_parquet function
  await conn.query(`CREATE OR REPLACE VIEW hdb_raw AS SELECT * FROM read_parquet('${PARQUET_URL}');`);

  const where = buildWhereClause(filter);
  const sql = `SELECT * FROM hdb_raw ${where}`;
  
  const result = await conn.query(sql);
  
  // Convert DuckDB Apache Arrow table to standard JS array of objects
  return result.toArray().map(row => row as HdbResaleRecord);
}
```

**Key points**

- The service returns an `AsyncIterable<HdbResaleRecord>` so you can `await for await` or spread into an array.
- `buildWhereClause` sanitises inputs (single‑quotes around string literals) – you can expand it with prepared statements if you need stricter safety.
- The view `hdb_raw` is created **per query**; DuckDB will automatically drop it when the connection closes.

---

<a name="migrate-data-loading-logic"></a>
## 4️⃣ Migrate Data Loading Logic

### 4.1 Replace `fetchHdbDataByMonth`

Locate the import in `src/services/hdbService.ts` and remove it:

```ts
// src/services/hdbService.ts   <-- DELETE or comment out
// import { fetchHdbDataByMonth } from './hdbApi';
```

Create a **new import** in your data hook (or the service that supplies data) :

```ts
import { queryHdb } from '../services/parquetHdbService';
import type { HdbFilter } from '../types';
```

### 4.2 Build a **single** filter object and handle async state

In `useHdbData.ts` (or wherever you centralise data fetching), move from synchronous `useMemo` to an asynchronous `useEffect` pattern:

```ts
// Example inside useHdbData.ts
const [rawRecords, setRawRecords] = useState<HdbResaleRecord[]>([]);
const [isLoading, setIsLoading] = useState(false);

// 1. Memoise the filter object to prevent unnecessary effect triggers
const currentFilter: HdbFilter = useMemo(() => ({
  startMonth: selectedDateRange?.[0] ?? '',
  endMonth:   selectedDateRange?.[1] ?? '',
  selectedTowns: selectedTowns,
  selectedFlatTypes: selectedFlatTypes,
  selectedLeaseRange: selectedLeaseRange,
}), [selectedDateRange, selectedTowns, selectedFlatTypes, selectedLeaseRange]);

// 2. Trigger the async query whenever the filter changes
useEffect(() => {
  let isMounted = true;
  
  async function fetchData() {
    setIsLoading(true);
    try {
      const data = await queryHdb(currentFilter);
      if (isMounted) setRawRecords(data);
    } catch (error) {
      console.error("DuckDB Query Error:", error);
    } finally {
      if (isMounted) setIsLoading(false);
    }
  }

  fetchData();
  return () => { isMounted = false; };
}, [JSON.stringify(currentFilter)]);
```

> **Tip:** Using `JSON.stringify(currentFilter)` in the dependency array ensures the query only re-runs when actual filter values change, regardless of object reference changes.

### 4.3 Keep UI components untouched

All chart and stats components already consume `rawRecords` via `useMemo` and `processDashboardData`. No changes required – only the source of `rawRecords` shifts from an API call to a DuckDB query.

---

<a name="cache--incremental-loading-strategies"></a>
## 5️⃣ Cache & Incremental Loading Strategies

| Need | Technique | Sample Implementation |
|------|-----------|-----------------------|
| **Browser cache of the Parquet file** | Add `Cache-Control: max-age=31536000, immutable` response header on the R2 object (or enable Cloudflare caching). | In Cloudflare Dashboard → Rules → Cache → Set TTL. |
| **Reuse previously fetched partitions** | Partition the Parquet by month/year and load **only the needed partitions**. Use a small manifest (`index.json`) that maps partition URLs to month identifiers. | ```ts async function* queryHdb(filter){ const needed = filter.startMonth + '-' + filter.endMonth; for (const part of neededPartitions) { const data = await fetch(part.url); const rows = await duckdb.query iterator(`SELECT * FROM read_parquet(data, ...)`); yield*; } }``` |
| **Persist query results** | Store the produced row set in `IndexedDB` (e.g., via `idb-keyval`) keyed by a hash of the filter JSON. On subsequent loads, read from IDB and skip network. | `import { get, set } from 'idb-keyval'; const hash = crypto.createHash('sha256').update(JSON.stringify(filter)).digest('hex'); const cached = await get<HdbResaleRecord[]>(hash); if (cached) return cached;` |
| **Debounce rapid filter changes** | If users toggle many towns/lease ranges quickly, debounce the query to avoid spamming DuckDB. | `const debouncedQuery = useCallback(debounce(() => queryHdb(currentFilter), 300), []);` |

---

<a name="testing--validation"></a>
## 6️⃣ Testing & Validation

### 6.1 Unit Tests (`parquetHdbService.test.ts`)
- **SQL Generation**: Test `buildWhereClause` with various `HdbFilter` combinations to ensure the generated `WHERE` clause is logically correct and uses correct quoting.
- **Data Integrity**: Using a small mock Parquet file, verify that `queryHdb` returns the exact number of records and correct field values as expected.
- **Error Resilience**: Mock a `404` or `500` response for the Parquet URL and verify the service throws a descriptive error.

### 6.2 End-to-End (E2E) Validation
- **Network Verification**: Open Chrome DevTools → Network. Ensure that after the initial page load, clicking filters triggers **no new API calls** to the backend, and only a **single GET request** for `hdb-data.parquet` is made (subsequent requests should be `304 Not Modified` or served from cache).
- **Visual Regression**: Compare the charts rendered by the new DuckDB-Wasm service against the legacy API version. The number of data points and the trend lines must be **identical**.
- **Filter Stress Test**: Rapidly toggle multiple town and flat type filters to ensure no race conditions occur in the `useEffect` update loop.

### 6.3 Performance Benchmarks
- **TTV (Time to View)**: Measure the time from "Filter Change" to "Chart Render". Target: **< 300ms** for typical queries.
- **Memory Footprint**: Use Chrome Memory Profiler. Ensure the Wasm heap and JS heap combined stay below **250MB** during active filtering.
- **Initialization Overhead**: Measure the first-load delay (Wasm bundle download + instantiation). Target: **< 1.5s** on a 4G connection.

### 6.4 Edge-Case Matrix
| Scenario | Expected Behavior |
|----------|------------------|
| **Empty Result Set** | Query returns `[]`, UI shows "No data available" without crashing. |
| **Max Date Range** | Querying the entire dataset doesn't freeze the browser tab. |
| **Malformed Parquet** | Error caught by `try-catch` in `useHdbData`, UI displays a friendly "Data loading error" toast. |
| **Offline Mode** | If PWA caching is enabled, the dashboard should remain functional using the cached Parquet file. |  

---

<a name="decommission-the-legacy-api"></a>
## 7️⃣ Decommission the Legacy API

| Step | Action |
|------|--------|
| 1️⃣ | Remove the route file that exports `fetchHdbDataByMonth` (e.g., `src/routes/hdbRoute.ts`). |
| 2️⃣ | Delete any related serverless function definitions in the infra repo (e.g., `api/hdb/*`). |
| 3️⃣ | Update API documentation / Swagger to reflect that this endpoint is **deprecated**. |
| 4️⃣ | Add a comment in the README about the new data source (DuckDB‑Wasm + R2). |
| 5️⃣ | After a release, monitor analytics for any residual calls and remove the corresponding logging/metrics. |

---

<a name="optional-enhancements"></a>
## 8️⃣ Optional Enhancements

| Feature | Why it matters | How to add it |
|---------|----------------|---------------|
| **Columnar encryption / masking** | Protect personally identifiable data (e.g., owner names). | Encrypt fields in the source JSON before writing Parquet; decrypt in DuckDB with a custom `decrypt(x)` UDF (requires embedding JavaScript in the DuckDB SQL). |
| **Partitioned Montly Parquet files** | Reduce initial download size for users who only view a subset of years. | Generate `hdb-2024-01.parquet`, `hdb-2024-02.parquet`, …; modify `queryHdb` to fetch only partitions intersecting the requested date range. |
| **Server‑side signed URLs for private data** | Allow you to keep the raw file private while still serving to authenticated users. | Cloudflare Worker signs URLs with an expiring token (`signature = HMAC(secret, timestamp+path)`). |
| **Pre‑aggregated materialised views** | Speed up heavy chart calculations (e.g., median price per town). | Create an extra Parquet view like `CREATE VIEW hdb_agg AS SELECT town, year, median(price) AS median_price FROM hdb_raw GROUP BY town, year;` and query that view instead when needed. |
| **Progressive Web App (PWA) caching** | Allow offline reuse of previously loaded data. | Register a Service Worker that intercepts fetches to `/data/hdb-data.parquet` and stores the response in `CacheStorage`. |

---

## 🎉 Summary

- **Step 1:** Convert your current JSON dump into a single Parquet file stored on Cloudflare R2.  
- **Step 2:** Add `duckdb-wasm` (`npm i duckdb-wasm`).  
- **Step 3:** Implement `parquetHdbService.ts` that fetches the Parquet, registers it as a DuckDB view, and yields rows filtered by SQL generated from UI state.  
- **Step 4:** Replace all `fetchHdbDataByMonth` calls with `queryHdb(filter)`.  
- **Step 5:** Cache the Parquet download and optionally cache or partition queries for incremental loading.  
- **Step 6:** Run unit & integration tests, verify UI stays identical, then retire the old API.  

By following this markdown guide you’ll move from a **network‑first** REST pattern to a **browser‑native** data engine, dramatically reducing latency, eliminating server costs, and keeping full filter flexibility for your users. Happy refactoring! 🚀