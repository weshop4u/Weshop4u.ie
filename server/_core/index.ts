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
import { initializeDualDatabases, getDatabaseHealth } from "../db-dual-write";

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
  // Initialize dual database system (Manus primary + Railway PostgreSQL backup)
  // Force Railway redeploy - v2
  await initializeDualDatabases();
  const dbHealth = getDatabaseHealth();
  console.log("[Server] Database health:", dbHealth);

  // Check if web-dist exists, if not try to build it
  const webDistPath = path.resolve(process.cwd(), "web-dist");
  if (!fs.existsSync(webDistPath)) {
    console.log("[Server] web-dist not found, attempting to build...");
    try {
      // Try to run the web build script
      const { execSync } = await import("child_process");
      console.log("[Server] Running pnpm build:web...");
      execSync("pnpm build:web", { cwd: process.cwd(), stdio: "inherit" });
      console.log("[Server] ✓ web-dist built successfully");
    } catch (error) {
      console.warn("[Server] ⚠ Failed to build web-dist:", error instanceof Error ? error.message : error);
    }
  } else {
    console.log("[Server] ✓ web-dist found at", webDistPath);
  }

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
    const dbHealth = getDatabaseHealth();
    res.json({ 
      ok: true, 
      timestamp: Date.now(),
      database: dbHealth
    });
  });

  // Debug endpoint to check server environment
  app.get("/api/debug", (_req, res) => {
    const cwdContents = fs.readdirSync(process.cwd()).filter(f => !f.startsWith('.')).slice(0, 20);
    const dirnameContents = fs.readdirSync(__dirname).filter(f => !f.startsWith('.')).slice(0, 20);
    res.json({
      __dirname: __dirname,
      cwd: process.cwd(),
      env: process.env.NODE_ENV,
      files: {
        webDistInDirname: fs.existsSync(path.resolve(__dirname, "web-dist")),
        webDistInCwd: fs.existsSync(path.resolve(process.cwd(), "web-dist")),
        webDistInCwdDist: fs.existsSync(path.resolve(process.cwd(), "dist", "web-dist")),
        distFolderInCwd: fs.existsSync(path.resolve(process.cwd(), "dist")),
      },
      cwdContents: cwdContents,
      dirnameContents: dirnameContents,
    });
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

  // Redirect root /api/ to /api/web/ so users always land on the web app
  app.get("/api", (_req, res) => res.redirect("/api/web/"));

  // Serve static web files - the deployment platform only routes /api/* to Express,
  // so we serve the web app under /api/web/ prefix
  {
    // Try multiple locations for web-dist
    console.log(`[web] __dirname = ${__dirname}`);
    console.log(`[web] process.cwd() = ${process.cwd()}`);
    
    // Check all possible locations
    const locations = [
      path.resolve(__dirname, "web-dist"),                    // Production: dist/web-dist
      path.resolve(__dirname, "..", "web-dist"),             // Dev: server/../web-dist
      path.resolve(__dirname, "..", "..", "web-dist"),      // Dev root: server/../../web-dist
      path.resolve(process.cwd(), "web-dist"),                // From cwd
      path.resolve(process.cwd(), "dist", "web-dist"),        // From cwd/dist
    ];
    
    let webDistPath = "";
    for (const loc of locations) {
      console.log(`[web] Checking: ${loc} - exists: ${fs.existsSync(loc)}`);
      if (fs.existsSync(loc)) {
        webDistPath = loc;
        break;
      }
    }
    
    if (webDistPath && fs.existsSync(webDistPath)) {
      console.log(`[web] ✓ Found web-dist at ${webDistPath}`);
      console.log(`[web] Serving static files from ${webDistPath} under /api/web/`);
      // Serve static assets under /api/web/
      app.use("/api/web", express.static(webDistPath, { maxAge: "1d" }));
      // Root /api/web/ serves index.html
      app.get("/api/web", (_req, res) => {
        const rootIndex = path.join(webDistPath, "index.html");
        if (fs.existsSync(rootIndex)) {
          res.sendFile(rootIndex);
        } else {
          res.status(404).send("Web app not found");
        }
      });
      // For any /api/web/* route, serve the matching HTML file or fall back to index.html
      app.get("/api/web/*", (req, res) => {
        const subPath = req.path.replace(/^\/api\/web/, "") || "/";
        // Try to find an exact HTML file for this route
        const htmlPath = path.join(webDistPath, subPath.endsWith(".html") ? subPath : subPath + ".html");
        if (fs.existsSync(htmlPath)) {
          res.sendFile(htmlPath);
          return;
        }
        // Try index.html in a subdirectory
        const dirIndexPath = path.join(webDistPath, subPath, "index.html");
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
// Force Railway rebuild - 1774948853
// Cache buster: 1774956851884318274
