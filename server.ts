import express from "express";
import { createServer as createViteServer } from "vite";
import compression from "compression";

// Import the Vercel serverless handlers
import getHdbDataHandler from "./api/getHdbData";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use compression middleware to reduce payload size
  app.use(compression());
  
  app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
  });

  // Mount the Vercel handlers as Express routes
  // We cast req and res to any to bridge the slight type differences 
  // between Express and VercelRequest/VercelResponse
  app.get("/api/getHdbData", async (req, res) => {
    await getHdbDataHandler(req as any, res as any);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
