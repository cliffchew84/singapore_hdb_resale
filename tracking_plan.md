# PostHog Tracking Plan - HDB Resale Dashboard

## 1. Objective
To understand how users interact with the HDB Resale Dashboard, which data segments are most valuable to them, and to monitor the reliability of our backend connection to the `data.gov.sg` API.

## 2. Implementation Strategy
We will use a **Hybrid Tracking Approach**:
*   **Client-Side (React):** To track user experience (UX), UI interactions, and data filtering preferences.
*   **Server-Side (Vercel Serverless):** To track API reliability, cache performance, and external API rate limits, bypassing ad-blockers for critical system metrics.
*   **Environment Segregation:** Tracking will be disabled when `NODE_ENV === 'development'` to prevent local testing from polluting production data.

---

## 3. Client-Side Events (Frontend / React)

These events help us understand *what* the users are looking for and *how* they use the UI.

### A. Core Data Filtering
*   **Event Name:** `filters_applied`
    *   **Trigger:** Fired when the user updates their global search filters (debounced to avoid spamming on every click).
    *   **Properties:**
        *   `towns` (Array of strings): e.g., `['BISHAN', 'ANG MO KIO']`
        *   `flat_types` (Array of strings): e.g., `['4 ROOM', '5 ROOM']`
        *   `start_month` (String): e.g., `'2024-01'`
        *   `end_month` (String): e.g., `'2024-12'`
        *   `min_lease` (Number): e.g., `50`
        *   `max_lease` (Number): e.g., `99`
        *   `is_comparison_mode` (Boolean): `true` | `false`
        *   `segment_b_towns` (Array of strings): (Only if comparison mode is true)
        *   `segment_b_flat_types` (Array of strings): (Only if comparison mode is true)
        *   `segment_b_min_lease` (Number): (Only if comparison mode is true)
        *   `segment_b_max_lease` (Number): (Only if comparison mode is true)
        *   `active_years` (Array of numbers): e.g., `[2024, 2023]`
        *   `active_years_count` (Number): e.g., `2`
    *   **Purpose:** Identifies the most popular towns, flat types, lease ranges, and how many years of historical data users typically analyze.

*   **Event Name:** `year_toggled`
    *   **Trigger:** Fired when a user clicks to add or remove a specific year of historical data.
    *   **Properties:**
        *   `year` (Number): e.g., `2023`
        *   `action` (String): `'added'` | `'removed'`
    *   **Purpose:** Tracks which specific historical years users are most interested in loading.

*   **Event Name:** `comparison_mode_toggled`
    *   **Trigger:** Fired when a user turns the A/B Comparison Mode on or off.
    *   **Properties:**
        *   `is_comparison_mode` (Boolean): `true` | `false`
    *   **Purpose:** Measures the adoption rate of the comparison feature.

### B. Chart Interactions
*   **Event Name:** `metric_toggled`
    *   **Trigger:** Fired when a user changes the metric on the Price Distribution (Box Plot) chart.
    *   **Properties:**
        *   `chart_name` (String): `'price_distribution'`
        *   `selected_metric` (String): `'resale_price'` | `'price_psf'` | `'price_per_lease'`
    *   **Purpose:** Determines if users value absolute price, size efficiency (PSF), or age efficiency (Price/Lease) the most.

*   **Event Name:** `chart_mode_toggled`
    *   **Trigger:** Fired when a user toggles the view mode on the Transaction Volume (Stacked Bar) chart.
    *   **Properties:**
        *   `chart_name` (String): `'transaction_volume'`
        *   `selected_mode` (String): `'count'` | `'percentage'`
    *   **Purpose:** Understands if users prefer absolute volume or relative market share.

### C. UI Layout Preferences
*   **Event Name:** `section_toggled`
    *   **Trigger:** Fired when a user expands or collapses a `CollapsibleSection`.
    *   **Properties:**
        *   `section_title` (String): e.g., `'Price Trend'`, `'Transaction Volume'`
        *   `is_open` (Boolean): `true` | `false`
    *   **Purpose:** Identifies which charts are ignored (frequently collapsed) vs. highly valued (always kept open).

---

## 4. Server-Side Events (Backend / Vercel Serverless)

These events help us monitor the health of our application and the reliability of the `data.gov.sg` API.

### A. API Performance & Caching
*   **Event Name:** `api_request_success`
    *   **Trigger:** Fired when `/api/getHdbData` or `/api/getHistoricalData` successfully returns data.
    *   **Properties:**
        *   `endpoint` (String): `'getHdbData'` | `'getHistoricalData'`
        *   `cache_hit` (Boolean): `true` (served from memory) | `false` (fetched from Gov API)
        *   `requested_month` (String): e.g., `'2024-01'`
        *   `record_count` (Number): Number of records returned.
    *   **Purpose:** Measures how effective our in-memory caching is and tracks raw backend usage.

### B. External API Reliability (data.gov.sg)
*   **Event Name:** `api_rate_limit_hit`
    *   **Trigger:** Fired when the `data.gov.sg` API returns a `TOO_MANY_REQUESTS` error and triggers our retry logic.
    *   **Properties:**
        *   `endpoint` (String): `'getHdbData'`
        *   `retry_attempt` (Number): `1`, `2`, or `3`
    *   **Purpose:** Alerts us if the Gov API is heavily throttling us, indicating we might need a more robust database cache (like Redis or MongoDB) for recent months.

*   **Event Name:** `api_error_fallback`
    *   **Trigger:** Fired when all 3 retries fail (e.g., due to invalid JSON/HTML error pages or persistent network drops).
    *   **Properties:**
        *   `endpoint` (String): `'getHdbData'`
        *   `error_type` (String): `'invalid_json'` | `'network_error'` | `'unknown'`
        *   `status_code` (Number): e.g., `502`, `503`
    *   **Purpose:** Tracks hard outages of the `data.gov.sg` API so we can correlate user drop-offs with external downtime.

---

## 5. Next Steps for Implementation (When ready)
1.  Create a PostHog account and obtain the **Project API Key** and **Instance Host URL**.
2.  Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to `.env.example`.
3.  Install `posthog-js` (Frontend) and `posthog-node` (Backend).
4.  Wrap the React `App` in `<PostHogProvider>`.
5.  Implement the `posthog.capture()` calls in the React components and Vercel serverless functions (ensuring `await posthog.flush()` is used in the backend).
