# PRD: Incremental Data Loading for HDB Resale Dashboard

## 1. Overview
The HDB Resale Dashboard currently fetches all available data upon initial load. As the dataset grows, this results in a long "cold-start" time. This feature introduces **Incremental Data Loading**, allowing users to interact with the dashboard after a minimal initial load (6 months of data) and fetch additional data on-demand without interrupting their current session.

## 2. Problem Statement
*   **High Time-to-Interactive (TTI):** Users must wait for the entire historical dataset to be fetched and processed before they can perform any analysis.
*   **Perceived Performance:** The long initial loading time negatively impacts user retention and satisfaction.

## 3. Goals & Objectives
*   **Improve TTI:** Reduce initial load time by ~70-80% by only fetching the most recent 6 months of data initially.
*   **Maintain Responsiveness:** Ensure the dashboard remains fully interactive during background data fetching.
*   **Seamless Integration:** Automatically update charts, statistics, and **filter options** as new data arrives without requiring a page refresh or resetting user filters.

## 4. User Stories
*   **As a user**, I want to see the most recent HDB resale trends immediately upon landing on the page, so I don't have to wait for the entire history to load.
*   **As a user**, I want to be able to load more historical data if I need to perform a deeper analysis, without losing my current filter settings or chart interactions.
*   **As a user**, I want the filter options (e.g., Town, Flat Type) to automatically update when I load more data, so I can filter by newly available categories.

## 5. Functional Requirements
1.  **Initial Load:** On component mount, the application shall fetch and render only the most recent 6 months of data.
2.  **Date Range Trigger:** The UI shall provide a "Date Range" selector (e.g., '6M', '12M'). Selecting a range that requires data not yet loaded shall trigger the fetching of the necessary historical data.
3.  **User Prompt:** Upon selecting a range requiring additional data, the UI shall prompt the user (via toast or modal) that background data fetching has started.
4.  **Background Updates:** When a fetch is triggered, the data fetching shall occur in the background. The charts shall remain interactive.
5.  **Automatic UI Sync:** Upon successful fetching and processing of new data, the charts and statistics shall automatically update to include the new data points.
6.  **Dynamic Filter Updates:** The filter controls (e.g., available towns, flat types, date range) shall be updated dynamically to reflect the full set of options available in the combined dataset (initial + incrementally loaded).
7.  **Loading State:** The UI shall display a clear loading indicator when background fetching is in progress.

## 6. Technical Implementation Plan

### A. Data Fetching Hook (`useHdbData.ts`)
*   **Refactor `useEffect`**: Modify the initial `useEffect` to only fetch the first 6 months of data.
*   **New Function `ensureDataForRange`**:
    *   Accepts the requested date range as an argument.
    *   Checks if the required data is already present in `rawRecords`.
    *   If missing, triggers the fetch for the required months.
    *   Appends new records to the `rawRecords` state.
    *   Updates `loadingMore` state.

### B. UI Component (`Dashboard.tsx` / `FilterPanel.tsx`)
*   **Date Range Selector**: Update the selector to call `ensureDataForRange` when a user selects a range.
*   **User Feedback**: Integrate a toast notification or modal to inform the user that background fetching has started.
*   **Loading Indicator**: Integrate a spinner within the selector or near the charts.

### C. Reactivity & State Synchronization
*   **Filter Options**: Ensure that the filter component's options (e.g., list of towns, flat types) are derived from the *entire* `rawRecords` state using `useMemo`, ensuring they update automatically when `rawRecords` changes.
*   **Chart Reactivity**: Since `filteredRecords` and `processedData` are derived via `useMemo` from `rawRecords`, no changes are needed to the chart components. They will automatically re-render when `rawRecords` is updated.

## 7. UX/UI Considerations
*   **Non-Blocking**: The background fetch must not block the main thread.
*   **Visual Feedback**: The charts should not "jump" or flicker significantly when data is appended.
*   **Filter Persistence**: User-selected filters (Town, Flat Type) must be preserved across data updates.
*   **Prompting**: A non-intrusive toast notification is preferred to inform the user of the background fetch.

## 8. Success Metrics
*   **Time-to-Interactive**: Measured as the time from page load to the dashboard being fully interactive with the first 6 months of data.
*   **User Engagement**: Number of times the "Load More" button is clicked per session.
*   **Filter Accuracy**: Verify that filter options correctly reflect the *entire* loaded dataset at any given time.

## 9. Impact/Effort Score
*   **Impact**: **High** (Significantly improves TTI and perceived performance)
*   **Effort**: **Medium** (Requires refactoring data fetching logic and UI state management)
