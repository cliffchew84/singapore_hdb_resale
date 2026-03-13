# HDB Resale Dashboard: Maintenance & Optimization Guide

This document provides a comprehensive roadmap for maintaining, optimizing, and deploying the HDB Resale Price Dashboard. It covers strategies for backend efficiency, frontend performance, and serverless deployment.

---

## 1. Data Caching & Backend Efficiency

Efficient data handling is the foundation of a responsive dashboard. Since HDB resale data for past months is immutable, caching is our most effective optimization.

### Server-Side Caching (COMPLETED ✅)
*   **Status**: Implemented in `server.ts` using an in-memory `hdbCache`.
*   **Impact**: **High**. Eliminated redundant network calls to `data.gov.sg` for the same month.
*   **Effort**: **Low**.

### Serverless (Vercel) Caching (COMPLETED ✅)
*   **Status**: Implemented `Cache-Control` headers in `server.ts` and `vercel.json`.
*   **Strategy**: Traditional in-memory caching is unreliable in serverless environments due to statelessness. Use **Edge Network Caching** instead:
    *   **Strategy**: Add a `Cache-Control` header to API responses.
    *   **Implementation**: `res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');`
    *   **Benefit**: Zero-latency delivery from Vercel's global CDN and zero serverless execution cost for cached hits.

### External Persistent Cache (Upstash Redis)
For complex state or raw data objects that need to persist across function instances:
*   **Implementation**: Use a serverless-friendly Redis provider like [Upstash](https://upstash.com/).
*   **Best For**: Sharing state between different API routes or storing processed data structures.

### Data Compression (COMPLETED ✅)
*   **Status**: Implemented `compression` middleware in `server.ts` and optimized the API payload by stripping unused fields.
*   **Impact**: **Medium**. Reduces bandwidth usage by ~70-80% and speeds up data delivery.
*   **Effort**: **Low**.

---

## 2. Data Fetching & State Management

How we load and store data in the browser directly impacts the user's perceived performance.

### Batched State Updates (COMPLETED ✅)
*   **Status**: Implemented in `useHdbData.ts`. UI now updates every 4 months of data instead of every month.
*   **Impact**: **Medium**. Significantly reduced UI flickering and CPU load during initial data load.
*   **Effort**: **Low**.

### Optimized Sorting (COMPLETED ✅)
*   **Status**: Removed redundant `new Date()` conversions and complex sort callbacks.
*   **Strategy**: Avoid re-sorting the entire dataset on every incremental update. Since data is fetched chronologically, use append-only logic to maintain order.

---

## 3. Data Processing & Filtering Logic

Processing thousands of records in the browser requires efficient algorithms.

### Single-Pass Data Processing (COMPLETED ✅)
*   **Status**: Implemented `processDashboardData` in `dataProcessor.ts`.
*   **Impact**: **High**. Reduced data iteration from 5 passes to 1 pass per filter change.
*   **Effort**: **Medium**.

### Efficient Comparisons (COMPLETED ✅)
*   **Status**: Implemented string-based comparisons for all month filtering and sorting.
*   **Strategy**: Use string-based comparisons for `YYYY-MM` formats instead of converting to `Date` objects inside tight loops.
*   **Benefit**: Reduces garbage collection and CPU cycles.

### Filter Execution Order
*   **Strategy**: Order filter conditions in `useHdbData.ts` from cheapest (e.g., string match) to most expensive (e.g., complex parsing).

---

## 4. Frontend & Rendering Performance

Optimizing the UI ensures smooth interactions even with dense datasets.

### Component Memoization (COMPLETED ✅)
*   **Status**: Wrapped all chart components (`BoxPlot`, `LineChart`, `StackedBarChart`) and `SummaryStats` in `React.memo`.
*   **Impact**: **Medium**. Prevents unnecessary re-renders when unrelated state (like sidebar toggle) changes.
*   **Effort**: **Low**.

### Canvas-Based Rendering (D3)
*   **Strategy**: If the dataset grows beyond 5,000 individual points, switch from SVG to Canvas rendering in D3.
*   **Benefit**: Maintains 60fps interactions by bypassing the overhead of thousands of DOM elements.

---

## 5. Vercel Deployment Configuration (COMPLETED ✅)

To ensure the best performance on Vercel, use a `vercel.json` configuration to manage function limits and global headers.

```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=1, stale-while-revalidate=59" }
      ]
    }
  ]
}
```

---

## 6. Optimization Summary Table

| Optimization | Impact | Effort | Priority |
| :--- | :--- | :--- | :--- |
| **Server-Side Caching** | High | Low | **DONE ✅** |
| **Serverless Caching** | High | Low | **DONE ✅** |
| **Batched State Updates** | Medium | Low | **DONE ✅** |
| **Single-Pass Processing** | High | Medium | **DONE ✅** |
| **React.memo** | Medium | Low | **DONE ✅** |
| **Data Compression** | Medium | Medium | **DONE ✅** |
| **Optimized Sorting** | Medium | Low | **DONE ✅** |
| **String Comparisons** | Medium | Low | **DONE ✅** |
| **Vercel Config** | Medium | Low | **DONE ✅** |
| **Canvas Rendering** | High | High | **SKIPPED** |

---
*Last Updated: March 2026*
