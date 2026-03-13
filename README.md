<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1vO4PDsjytUSntY1zcnLSAJK5fS7fkQ-r

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Maintenance & Deployment

For detailed instructions on performance optimization and serverless caching strategies, please refer to [MAINTENANCE.md](MAINTENANCE.md).

### Deploying to Vercel

When you are ready to push your codebase to Vercel, you need to configure your environment variables in the Vercel project settings. 

1. Push your code to a GitHub repository.
2. Import the repository into Vercel.
3. Before deploying, go to the **Environment Variables** section in your Vercel project settings and add the following keys:

| Variable Name | Description |
| :--- | :--- |
| `DATAGOV_API_KEY` | Your Data.gov.sg API key for fetching HDB data. |
| `MONGO_PASSWORD` | Your MongoDB password (if applicable for historical data). |
| `VITE_POSTHOG_KEY` | Your PostHog Project API Key. |
| `VITE_POSTHOG_HOST` | Your PostHog Host URL (e.g., `https://us.i.posthog.com`). |

**Note on PostHog Tracking:** 
By default, Vercel sets `NODE_ENV` to `production` during deployment. The PostHog tracking code is configured to only run when `NODE_ENV !== 'development'`. This means **tracking will automatically activate once deployed to Vercel**, but will remain disabled while you are testing locally to prevent polluting your analytics.
