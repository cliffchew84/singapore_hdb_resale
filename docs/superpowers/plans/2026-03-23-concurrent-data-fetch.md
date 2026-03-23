# Concurrent data.gov.sg Fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sequential month-by-month fetch in `useHdbData` with bounded concurrent fetching (3 months at a time) to speed up initial and incremental 2026 data loads.

**Architecture:** The `fetchMonths` function inside `useHdbData.ts` currently iterates months sequentially with a `for` loop. We replace this with a chunk loop that fires each group of 3 months as a `Promise.all`, then awaits before the next chunk. No other files change.

**Tech Stack:** React 18, TypeScript — no new dependencies.

---

### Task 1: Replace sequential `fetchMonths` with chunked concurrent fetching

**Files:**
- Modify: `src/hooks/useHdbData.ts` (the `fetchMonths` function, currently lines 75–83)

- [ ] **Step 1: Open `src/hooks/useHdbData.ts` and locate `fetchMonths`**

  The current implementation (lines 75–83):

  ```ts
  const fetchMonths = async (months: string[]) => {
      const newRecords: HdbResaleRecord[] = [];
      for (const month of months) {
          setLoadingMessage(`Fetching data for ${month}...`);
          const monthData = await fetchHdbDataByMonth(month);
          newRecords.push(...monthData);
      }
      return newRecords;
  };
  ```

- [ ] **Step 2: Replace the function body**

  Replace the entire `fetchMonths` function with:

  ```ts
  const fetchMonths = async (months: string[]) => {
      const newRecords: HdbResaleRecord[] = [];
      for (let i = 0; i < months.length; i += 3) {
          const chunk = months.slice(i, i + 3);
          const chunkResults = await Promise.all(chunk.map(m => fetchHdbDataByMonth(m)));
          newRecords.push(...chunkResults.flat());
      }
      return newRecords;
  };
  ```

  Note: The `setLoadingMessage` call inside the loop is removed — the existing spinner state set by the callers (`loadInitialData` and `ensureDataForRange`) is sufficient.

- [ ] **Step 3: Type-check**

  ```bash
  npm run lint
  ```

  Expected: no errors.

- [ ] **Step 4: Manual verification**

  Start the dev server:
  ```bash
  npm run dev
  ```

  Open the app in the browser and open DevTools → Network tab, filter by `getHdbData`.

  **Check 1 — Concurrency:** On initial load, the first batch of 2026 months (Jan, Feb, Mar) should appear as simultaneous requests in the Network tab, not staggered sequentially.

  **Check 2 — Data loads correctly:** The dashboard renders with 2026 data. No console errors.

  **Check 3 — Incremental load:** Use the date range selector to add an earlier year (e.g. 2025). The 2025 MongoDB path should be unaffected. Then verify that if you add more 2026 months via `ensureDataForRange`, they also fire concurrently in chunks.

- [ ] **Step 5: Commit**

  ```bash
  git add src/hooks/useHdbData.ts
  git commit -m "perf: fetch 2026 months in concurrent chunks of 3"
  ```
