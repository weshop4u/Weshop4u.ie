import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Public order tracking page (no auth required)
  const { trackingRouter } = await import("../routers/tracking");
  app.use(trackingRouter);

  // Quick test print endpoint - no login required
  // Usage: GET /api/test-print?storeId=1
  app.get("/api/test-print", async (req, res) => {
    try {
      const storeId = parseInt(req.query.storeId as string) || 1;
      const { getDb } = await import("../db");
      const { printJobs, stores } = await import("../../drizzle/schema");
      const { formatReceipt } = await import("../routers/print");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) { res.status(500).json({ error: "Database not available" }); return; }

      // Get store info
      const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
      if (!store) { res.status(404).json({ error: `Store ${storeId} not found` }); return; }

      // Create a test order object
      const testOrder = {
        id: 99999,
        orderNumber: `WS4U/${store.shortCode || 'TST'}/TEST`,
        createdAt: new Date(),
        paymentMethod: 'cash',
        deliveryAddress: '123 Test Street, Balbriggan, Ireland',
        deliveryEircode: 'K32XE94',
        notes: 'This is a TEST PRINT - not a real order',
        allowSubstitutions: true,
        subtotal: '12.99',
        serviceFee: '1.30',
        deliveryFee: '3.50',
        total: '17.79',
      };
      const testItems = [
        { productName: 'Test Item 1 (Large)', quantity: 2, price: '4.99' },
        { productName: 'Test Item 2 (Small)', quantity: 1, price: '3.01' },
      ];
      const testCustomer = 'Test Customer';
      const testPhone = '089-4 626262';

      const content = formatReceipt(testOrder, store, testItems, testCustomer, testPhone);

      // Insert print job
      await db.insert(printJobs).values({
        storeId,
        orderId: 0,
        receiptContent: content,
        status: 'pending',
      });

      res.json({
        success: true,
        message: `Test print job created for ${store.name}. The POS should print it within 5 seconds.`,
        store: store.name,
        storeId,
      });
    } catch (error: any) {
      console.error('[TestPrint] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Serve static web files in production
  if (process.env.NODE_ENV === "production") {
    const webDistPath = path.resolve(__dirname, "..", "web-dist");
    if (fs.existsSync(webDistPath)) {
      console.log(`[web] Serving static files from ${webDistPath}`);
      // Serve static assets (JS, CSS, images, etc.)
      app.use(express.static(webDistPath, { maxAge: "1d" }));
      // For any non-API route, serve the matching HTML file or fall back to index.html (SPA)
      app.get("*", (req, res) => {
        // Skip API routes
        if (req.path.startsWith("/api/")) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        // Try to find an exact HTML file for this route
        const htmlPath = path.join(webDistPath, req.path.endsWith(".html") ? req.path : req.path + ".html");
        if (fs.existsSync(htmlPath)) {
          res.sendFile(htmlPath);
          return;
        }
        // Try index.html in a subdirectory
        const dirIndexPath = path.join(webDistPath, req.path, "index.html");
        if (fs.existsSync(dirIndexPath)) {
          res.sendFile(dirIndexPath);
          return;
        }
        // Fall back to root index.html for client-side routing
        const rootIndex = path.join(webDistPath, "index.html");
        if (fs.existsSync(rootIndex)) {
          res.sendFile(rootIndex);
          return;
        }
        res.status(404).send("Not Found");
      });
    } else {
      console.log(`[web] No web-dist directory found at ${webDistPath}, skipping static file serving`);
    }
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
